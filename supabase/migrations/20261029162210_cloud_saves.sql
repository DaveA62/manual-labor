-- All cash mutations pass through the authenticated Edge Function and shared TS reducer.
create table public.ml_saves (
  player_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null check (schema_version = 3),
  revision bigint not null check (revision > 0 and revision < 9007199254740991),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  production_checkpoint timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.ml_save_snapshots (
  player_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  state jsonb not null,
  production_checkpoint timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(player_id, revision)
);
create table public.ml_save_receipts (
  player_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  response jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(player_id, request_id)
);
create table public.ml_shift_reports (
  player_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null,
  report jsonb not null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  primary key(player_id, report_id)
);
create index ml_reports_pending on public.ml_shift_reports(player_id,created_at) where acknowledged_at is null;
create index ml_receipts_retention on public.ml_save_receipts(player_id,created_at desc);
alter table public.ml_saves enable row level security;
alter table public.ml_save_snapshots enable row level security;
alter table public.ml_save_receipts enable row level security;
alter table public.ml_shift_reports enable row level security;
create policy owner_read on public.ml_saves for select to authenticated using ((select auth.uid()) = player_id);
create policy owner_read on public.ml_save_snapshots for select to authenticated using ((select auth.uid()) = player_id);
create policy owner_read on public.ml_save_receipts for select to authenticated using ((select auth.uid()) = player_id);
create policy owner_read on public.ml_shift_reports for select to authenticated using ((select auth.uid()) = player_id);
revoke all on public.ml_saves, public.ml_save_snapshots, public.ml_save_receipts, public.ml_shift_reports from anon, authenticated;
grant select on public.ml_saves, public.ml_save_snapshots, public.ml_save_receipts, public.ml_shift_reports to authenticated;
grant all on public.ml_saves, public.ml_save_snapshots, public.ml_save_receipts, public.ml_shift_reports to service_role;

create function public.ml_read(p_player uuid, p_request uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.ml_saves; receipt jsonb; reports jsonb;
begin
 select response into receipt from public.ml_save_receipts where player_id=p_player and request_id=p_request;
 if receipt is not null then return jsonb_build_object('receipt',receipt); end if;
 select * into s from public.ml_saves where player_id=p_player;
 select coalesce(jsonb_agg(report order by created_at),'[]'::jsonb) into reports from public.ml_shift_reports where player_id=p_player and acknowledged_at is null;
 return jsonb_build_object('now',clock_timestamp(),'record',case when s.player_id is null then null else jsonb_build_object('state',s.state,'revision',s.revision,'checkpoint',s.production_checkpoint,'schemaVersion',s.schema_version,'reports',reports) end);
end $$;

create function public.ml_commit(p_player uuid, p_expected bigint, p_next jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.ml_saves; receipt jsonb; report jsonb; req uuid := (p_next->>'requestId')::uuid; stamp timestamptz := (p_next->>'checkpoint')::timestamptz;
begin
 -- Serializes initial creation as well as existing saves; one owner transaction at a time.
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,0));
 select response into receipt from public.ml_save_receipts where player_id=p_player and request_id=req;
 if receipt is not null then return receipt; end if;
 select * into s from public.ml_saves where player_id=p_player for update;
 if coalesce(s.revision,0) <> p_expected then raise exception 'SAVE_CONFLICT' using errcode='40001'; end if;
 if (p_next->>'revision')::bigint <> p_expected+1 or (p_next->>'schemaVersion')::integer <> 3 or stamp > clock_timestamp() or (s.production_checkpoint is not null and stamp < s.production_checkpoint) then raise exception 'INVALID_COMMIT'; end if;
 if s.player_id is not null then
   insert into public.ml_save_snapshots(player_id,revision,state,production_checkpoint) values(p_player,s.revision,s.state,s.production_checkpoint);
 end if;
 insert into public.ml_saves(player_id,schema_version,revision,state,production_checkpoint) values(p_player,3,p_expected+1,p_next->'state',stamp)
 on conflict(player_id) do update set revision=excluded.revision,state=excluded.state,production_checkpoint=excluded.production_checkpoint,updated_at=clock_timestamp();
 for report in select value from jsonb_array_elements(p_next->'reports') loop
   insert into public.ml_shift_reports(player_id,report_id,report) values(p_player,(report->>'id')::uuid,report) on conflict do nothing;
 end loop;
 insert into public.ml_save_receipts(player_id,request_id,response) values(p_player,req,p_next);
 delete from public.ml_save_snapshots where player_id=p_player and revision not in (select revision from public.ml_save_snapshots where player_id=p_player order by revision desc limit 10);
 delete from public.ml_save_receipts where player_id=p_player and request_id not in (select request_id from public.ml_save_receipts where player_id=p_player order by created_at desc limit 128);
 return p_next;
end $$;
create function public.ml_ack_report(p_player uuid,p_report uuid) returns void
language sql security invoker set search_path = '' as $$
 update public.ml_shift_reports set acknowledged_at=coalesce(acknowledged_at,clock_timestamp()) where player_id=p_player and report_id=p_report;
$$;
-- RLS is not the economy validator. These functions are unreachable with user/anon keys.
revoke all on function public.ml_read(uuid,uuid), public.ml_commit(uuid,bigint,jsonb), public.ml_ack_report(uuid,uuid) from public, anon, authenticated;
grant execute on function public.ml_read(uuid,uuid), public.ml_commit(uuid,bigint,jsonb), public.ml_ack_report(uuid,uuid) to service_role;
