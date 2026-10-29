import { createWorkshop } from "../game/engine.ts";
import { CLOUD_SCHEMA, RULES_VERSION } from "./protocol.ts";
import type { CloudRecord, SyncRequest, SyncResult } from "./protocol.ts";
import { CloudConflict } from "./protocol.ts";
import {
  offlineReport,
  replay,
  validatedState,
  validEvents,
} from "./replay.ts";
export interface SaveRepository {
  read(
    playerId: string,
    requestId: string,
  ): Promise<{ now: string; record: CloudRecord | null; receipt?: SyncResult }>;
  /** Must lock the owner row, check revision, checkpoint and request ID, then commit atomically. */
  commit(
    playerId: string,
    expected: number,
    next: SyncResult,
  ): Promise<SyncResult>;
}
export async function synchronize(
  playerId: string,
  request: SyncRequest,
  repository: SaveRepository,
): Promise<SyncResult> {
  if (!request || typeof request !== "object")
    throw new Error("Invalid synchronization request.");
  if (request.rulesVersion !== RULES_VERSION)
    throw new Error("Game update required. Reload before syncing.");
  if (
    !/^[0-9a-f-]{36}$/i.test(request.id) ||
    !Number.isSafeInteger(request.revision) ||
    request.revision < 0 ||
    !validEvents(request.events)
  )
    throw new Error("Invalid synchronization request.");
  const loaded = await repository.read(playerId, request.id);
  if (loaded.receipt) return loaded.receipt;
  const old = loaded.record;
  if ((old?.revision ?? 0) !== request.revision) throw new CloudConflict(old!);
  const initial = old
    ? validatedState(old.state)
    : request.initial
      ? validatedState(request.initial)
      : createWorkshop();
  const elapsed = old
    ? Math.max(0, Date.parse(loaded.now) - Date.parse(old.checkpoint))
    : 0;
  if (!Number.isFinite(elapsed)) throw new Error("Invalid server checkpoint.");
  const advanced = replay(initial, request.events, elapsed);
  validatedState(advanced.state);
  const report =
    (request.offline || elapsed >= 30000) && elapsed > 0
      ? offlineReport(
          initial,
          advanced.state,
          elapsed,
          request.id,
          advanced.autoEarnings,
        )
      : null;
  return repository.commit(playerId, request.revision, {
    requestId: request.id,
    state: advanced.state,
    revision: request.revision + 1,
    checkpoint: loaded.now,
    schemaVersion: CLOUD_SCHEMA,
    reports: [...(old?.reports ?? []), ...(report ? [report] : [])],
  });
}
