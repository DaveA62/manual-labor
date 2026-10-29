import { reducer } from "../game/engine.ts";
import { MACHINE_DEFINITIONS } from "../game/definitions.ts";
import { tier } from "../game/machines.ts";
import { decodeSave } from "../game/codec.ts";
import type { WorkshopState } from "../game/types.ts";
import { OFFLINE_CAP_MS } from "./protocol.ts";
import type { PlayerAction, ShiftReport, TimedAction } from "./protocol.ts";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 128;
/** Untrusted network intent is parsed before reaching the shared reducer. */
export function validAction(v: unknown): v is PlayerAction {
  if (!record(v)) return false;
  if (v.type === "buy-slot" || v.type === "reset") return true;
  if (v.type === "buy-machine")
    return v.machineType === "money-press" && id(v.id);
  if (!id(v.machineId)) return false;
  if (v.type === "move")
    return Number.isSafeInteger(v.to) && (v.to as number) >= 0;
  if (v.type === "refit")
    return typeof v.fromTier === "string" && v.fromTier.length <= 64;
  if (v.type === "buy-upgrade")
    return MACHINE_DEFINITIONS["money-press"].upgrades.some(
      (u) => u.id === v.upgradeId,
    );
  if (v.type !== "operate" || !record(v.action)) return false;
  return (
    ["feed", "stamp", "collect"].includes(String(v.action.type)) ||
    (v.action.type === "turn" &&
      typeof v.action.amount === "number" &&
      Number.isFinite(v.action.amount) &&
      Math.abs(v.action.amount) <= 1)
  );
}
export function validEvents(value: unknown): value is TimedAction[] {
  if (!Array.isArray(value) || value.length > 10000) return false;
  const ids = new Set<string>();
  let last = 0;
  return value.every((e) => {
    if (
      !record(e) ||
      !id(e.id) ||
      ids.has(e.id) ||
      typeof e.at !== "number" ||
      !Number.isFinite(e.at) ||
      e.at < last ||
      e.at > Number.MAX_SAFE_INTEGER ||
      !validAction(e.action)
    )
      return false;
    last = e.at;
    ids.add(e.id);
    return true;
  });
}
export function validatedState(value: unknown): WorkshopState {
  const decoded = decodeSave(
    JSON.stringify({ ...(record(value) ? value : {}), version: 3 }),
  );
  if (!decoded) throw new Error("Invalid save data.");
  return decoded;
}
/** Only the server supplies elapsedMs for authoritative currency. Client event positions are clamped to that budget. */
export function replay(
  state: WorkshopState,
  events: readonly TimedAction[],
  elapsedMs: number,
) {
  let current = state,
    cursor = 0;
  const budget = Math.min(OFFLINE_CAP_MS, Math.max(0, elapsedMs));
  const autoEarnings = new Map<string, number>();
  function advance(to: number) {
    const next = reducer(current, { type: "tick", elapsedMs: to - cursor });
    next.machines.forEach((m) => {
      const before = current.machines.find((old) => old.id === m.id);
      const earned = m.lifetime - (before?.lifetime ?? m.lifetime);
      if (earned > 0)
        autoEarnings.set(m.id, (autoEarnings.get(m.id) ?? 0) + earned);
    });
    current = next;
    cursor = to;
  }
  for (const event of events) {
    advance(Math.max(cursor, Math.min(budget, event.at)));
    current = reducer(current, event.action);
    if (event.action.type === "reset") autoEarnings.clear();
  }
  advance(budget);
  return { state: current, autoEarnings };
}
export function offlineReport(
  before: WorkshopState,
  after: WorkshopState,
  elapsedMs: number,
  reportId: string,
  earnings?: Map<string, number>,
): ShiftReport | null {
  const machines = after.machines
    .map((m, index) => ({
      id: m.id,
      name: `${tier(m).name} #${index + 1}`,
      earnings:
        earnings?.get(m.id) ??
        Math.max(
          0,
          m.lifetime -
            (before.machines.find((old) => old.id === m.id)?.lifetime ??
              m.lifetime),
        ),
    }))
    .filter((m) => m.earnings > 0);
  const total = machines.reduce((n, m) => n + m.earnings, 0);
  return total > 0
    ? {
        id: reportId,
        elapsedMs: Math.max(0, elapsedMs),
        eligibleMs: Math.min(OFFLINE_CAP_MS, Math.max(0, elapsedMs)),
        total,
        machines,
      }
    : null;
}

export function validReport(value: unknown): value is ShiftReport {
  if (
    !record(value) ||
    !id(value.id) ||
    !Number.isSafeInteger(value.total) ||
    (value.total as number) <= 0 ||
    typeof value.elapsedMs !== "number" ||
    !Number.isFinite(value.elapsedMs) ||
    value.elapsedMs < 0 ||
    typeof value.eligibleMs !== "number" ||
    !Number.isFinite(value.eligibleMs) ||
    value.eligibleMs < 0 ||
    value.eligibleMs > OFFLINE_CAP_MS ||
    !Array.isArray(value.machines)
  )
    return false;
  return value.machines.every(
    (m) =>
      record(m) &&
      id(m.id) &&
      typeof m.name === "string" &&
      m.name.length <= 256 &&
      Number.isSafeInteger(m.earnings) &&
      (m.earnings as number) > 0,
  );
}
export function pristineSave(state: WorkshopState) {
  const m = state.machines[0];
  return (
    state.cash === 0 &&
    state.lifetime === 0 &&
    state.bills === 0 &&
    state.slots.length === 2 &&
    state.machines.length === 1 &&
    m.id === "press-initial" &&
    m.tier === "cash" &&
    m.upgrades.length === 0 &&
    m.phase === "feed" &&
    m.progress === 0
  );
}
