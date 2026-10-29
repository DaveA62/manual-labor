-- Schema 5 adds account Service state. Existing rows and checkpoints remain intact.
alter table public.ml_saves drop constraint ml_saves_schema_version_check;
alter table public.ml_saves add constraint ml_saves_schema_version_check check (schema_version in (3,4,5));

create or replace function public.ml_commit(p_player uuid, p_expected bigint, p_next jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.ml_saves; receipt jsonb; report jsonb; req uuid := (p_next->>'requestId')::uuid; stamp timestamptz := (p_next->>'checkpoint')::timestamptz;
begin
 -- Serializes initial creation as well as existing saves; one owner transaction at a time.
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,0));
 select response into receipt from public.ml_save_receipts where player_id=p_player and request_id=req;
 if receipt is not null then return receipt; end if;
 select * into s from public.ml_saves where player_id=p_player for update;
 if coalesce(s.revision,0) <> p_expected then raise exception 'SAVE_CONFLICT' using errcode='40001'; end if;
 if (p_next->>'revision')::bigint <> p_expected+1 or (p_next->>'schemaVersion')::integer not in (3,4,5) or (s.schema_version is not null and (p_next->>'schemaVersion')::integer < s.schema_version) or stamp > clock_timestamp() or (s.production_checkpoint is not null and stamp < s.production_checkpoint) then raise exception 'INVALID_COMMIT'; end if;
 if s.state ? 'service' and (
   not ((p_next->'state') ? 'service') or
   (p_next->'state'->'service'->>'lifetimeYears')::bigint < (s.state->'service'->>'lifetimeYears')::bigint
 ) then raise exception 'SERVICE_DOWNGRADE'; end if;
 if s.player_id is not null then
   insert into public.ml_save_snapshots(player_id,revision,state,production_checkpoint) values(p_player,s.revision,s.state,s.production_checkpoint);
 end if;
 insert into public.ml_saves(player_id,schema_version,revision,state,production_checkpoint) values(p_player,(p_next->>'schemaVersion')::integer,p_expected+1,p_next->'state',stamp)
 on conflict(player_id) do update set schema_version=excluded.schema_version,revision=excluded.revision,state=excluded.state,production_checkpoint=excluded.production_checkpoint,updated_at=clock_timestamp();
 -- A retired factory cannot leave a pending earnings report in the next career.
 if (p_next->'state'->'service'->'session') is not null and (p_next->'state'->'service'->'session') <> 'null'::jsonb then
   update public.ml_shift_reports set acknowledged_at=coalesce(acknowledged_at,clock_timestamp()) where player_id=p_player and acknowledged_at is null;
 end if;
 for report in select value from jsonb_array_elements(p_next->'reports') loop
   insert into public.ml_shift_reports(player_id,report_id,report) values(p_player,(report->>'id')::uuid,report) on conflict do nothing;
 end loop;
 insert into public.ml_save_receipts(player_id,request_id,response) values(p_player,req,p_next);
 delete from public.ml_save_snapshots where player_id=p_player and revision not in (select revision from public.ml_save_snapshots where player_id=p_player order by revision desc limit 10);
 delete from public.ml_save_receipts where player_id=p_player and request_id not in (select request_id from public.ml_save_receipts where player_id=p_player order by created_at desc limit 128);
 return p_next;
end $$;

revoke all on function public.ml_commit(uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.ml_commit(uuid,bigint,jsonb) to service_role;
