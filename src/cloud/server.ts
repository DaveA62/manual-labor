import { applyServiceCommand } from "../game/service/progression.ts";
import { validServiceCommand } from "./service.ts";
import { derivedStats } from "../game/service/stats.ts";
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
  if (![RULES_VERSION, 1, 2].includes(request.rulesVersion))
    throw new Error("Game update required. Reload before syncing.");
  if (
    !/^[0-9a-f-]{36}$/i.test(request.id) ||
    !Number.isSafeInteger(request.revision) ||
    request.revision < 0 ||
    !validEvents(request.events) ||
    typeof request.offline !== "boolean" ||
    (request.command !== undefined && !validServiceCommand(request.command))
  )
    throw new Error("Invalid synchronization request.");
  const loaded = await repository.read(playerId, request.id);
  if (loaded.receipt) return loaded.receipt;
  const old = loaded.record;
  if (request.rulesVersion < 3 && (old?.state.service || request.command))
    throw Error("Game update required. Reload before syncing.");
  if (!old && request.initial?.service)
    throw Error(
      "Permanent service progress cannot be imported from a device save.",
    );
  // Rules v1 has identical Press semantics. Keep already-open Press-only clients working.
  if (
    request.rulesVersion === 1 &&
    ((old?.state ?? request.initial)?.machines.some(
      (m) => m.type !== "money-press",
    ) ||
      request.events.some(
        (e) =>
          (e.action.type === "buy-machine" &&
            e.action.machineType !== "money-press") ||
          (e.action.type === "buy-upgrade" &&
            !["feeder", "motor", "collector", "stamper", "printing"].includes(
              e.action.upgradeId,
            )) ||
          (e.action.type === "operate" &&
            !["feed", "turn", "stamp", "collect"].includes(
              e.action.action.type,
            )),
      ))
  )
    throw new Error("Game update required. Reload before syncing.");
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
  const isOffline = request.offline || elapsed >= 30000;
  const advanced = replay(initial, request.events, elapsed, isOffline);
  // All wall time consumes Seniority, even beyond the production cap.
  if (advanced.state.service && !advanced.state.service.session)
    advanced.state = {
      ...advanced.state,
      service: {
        ...advanced.state.service,
        careerMs:
          advanced.state.service.careerMs +
          Math.max(0, elapsed - derivedStats(initial.service).offlineMs),
      },
    };
  if (request.command)
    advanced.state = applyServiceCommand(
      advanced.state,
      request.command,
      request.id,
      loaded.now,
    );
  validatedState(advanced.state);
  const report =
    !request.command && isOffline && elapsed > 0
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
    reports:
      request.command?.type === "retire"
        ? []
        : [...(old?.reports ?? []), ...(report ? [report] : [])],
  });
}
