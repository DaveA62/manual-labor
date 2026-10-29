import { BOTTLING } from "./definitions.ts";
import {
  automated,
  bottlePayout,
  definition,
  earnings,
  fullyAutomated,
  initialBottle,
} from "./machines.ts";
import type { MachineInstance, ManualAction } from "./types.ts";

/** Pure family mechanics; simulation and cloud replay share this exact implementation. */
export function completeBottlerPhase(m: MachineInstance): MachineInstance {
  const phases = definition(m).phases;
  const payout = m.phase === "collect" ? bottlePayout(m) : 0;
  const bills = m.bills + (payout > 0 ? 1 : 0);
  return {
    ...m,
    phase: phases[(phases.indexOf(m.phase) + 1) % phases.length],
    progress: 0,
    bills,
    lifetime: m.lifetime + payout,
    bottler:
      payout > 0
        ? initialBottle(bills)
        : m.phase === "fill"
          ? { ...m.bottler!, valve: 0, dripMs: 0 }
          : m.bottler,
  };
}
export function operateBottler(
  m: MachineInstance,
  action: ManualAction,
): MachineInstance {
  const b = m.bottler!;
  if (
    action.type === "transfer" &&
    Number.isFinite(action.amount) &&
    m.phase === "fill" &&
    !automated(m) &&
    b.valve === 0 &&
    b.dripMs === 0
  ) {
    m = { ...m, phase: "transfer", progress: 0 };
  }
  if (automated(m)) return m;
  if (
    action.type === "valve" &&
    m.phase === "fill" &&
    Number.isFinite(action.amount)
  ) {
    const raw = Math.max(0, Math.min(1, b.valve + action.amount));
    const valve = raw < 1e-6 ? 0 : raw > 1 - 1e-6 ? 1 : raw;
    if (valve === b.valve) return m;
    return {
      ...m,
      bottler: { ...b, valve, dripMs: valve === 0 ? BOTTLING.residualMs : 0 },
    };
  }
  if (
    (action.type === "transfer" && m.phase === "transfer") ||
    (action.type === "cap" && m.phase === "cap")
  ) {
    if (!Number.isFinite(action.amount)) return m;
    const progress = Math.max(0, Math.min(1, m.progress + action.amount));
    return progress >= 1 - 1e-9 ? completeBottlerPhase(m) : { ...m, progress };
  }
  if (
    (action.type === "load" && m.phase === "load") ||
    (action.type === "collect" && m.phase === "collect")
  )
    return completeBottlerPhase(m);
  return m;
}
export function advanceBottler(
  machine: MachineInstance,
  elapsedMs: number,
): MachineInstance {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return machine;
  let m = machine,
    remaining = elapsedMs;
  while (remaining > 1e-7) {
    if (m.phase === "load" && m.progress === 0 && fullyAutomated(m)) {
      // Deterministic size sequence: three cycles contain exactly 80% + 100% + 120% capacity.
      const duration =
        3 * Object.values(definition(m).durationMs).reduce((a, b) => a + b, 0);
      const groups = Math.floor(remaining / duration);
      if (groups > 0) {
        const count = groups * 3;
        m = {
          ...m,
          bills: m.bills + count,
          lifetime: m.lifetime + count * earnings(m),
          bottler: initialBottle(m.bills + count),
        };
        remaining -= groups * duration;
        continue;
      }
    }
    const b = m.bottler!;
    if (m.phase === "fill") {
      const fillMs = definition(m).durationMs.fill! * BOTTLING.capacity[b.size];
      if (automated(m)) {
        const needed = Math.max(0, (BOTTLING.regulatedFill - b.fill) * fillMs);
        const time = Math.min(remaining, needed);
        const fill = Math.min(BOTTLING.regulatedFill, b.fill + time / fillMs);
        m = {
          ...m,
          progress: Math.min(0.999999, fill),
          bottler: {
            ...b,
            fill,
            valve: time < needed ? 1 : 0,
            dripMs: 0,
            regulated: true,
          },
        };
        remaining -= time;
        if (time + 1e-7 >= needed) m = completeBottlerPhase(m);
        else break;
      } else {
        // An open manual valve can fill/spill unattended, but can never transfer or pay.
        const dripTime = b.valve === 0 ? Math.min(remaining, b.dripMs) : 0;
        const fill = Math.min(
          BOTTLING.maxFill,
          b.fill +
            (b.valve > 0
              ? remaining * b.valve
              : dripTime * BOTTLING.residualRate) /
              fillMs,
        );
        const dripMs = Math.max(0, b.dripMs - remaining);
        if (fill !== b.fill || dripMs !== b.dripMs)
          m = {
            ...m,
            progress: Math.min(0.999999, fill),
            bottler: { ...b, fill, dripMs },
          };
        // Closing a nonempty bottle is the manual handoff. An installed capper
        // owns transfer as well as sealing; it must not need a carriage nudge.
        if (
          b.valve === 0 &&
          dripMs === 0 &&
          fill > 0 &&
          m.upgrades.includes("auto-capper")
        ) {
          m = { ...m, phase: "transfer", progress: 0 };
          remaining -= dripTime;
          continue;
        }
        break;
      }
    } else {
      if (!automated(m)) break;
      const duration = definition(m).durationMs[m.phase]!;
      const needed = (1 - m.progress) * duration;
      if (remaining + 1e-7 >= needed) {
        remaining = Math.max(0, remaining - needed);
        m = completeBottlerPhase(m);
      } else {
        m = { ...m, progress: m.progress + remaining / duration };
        break;
      }
    }
  }
  return m;
}
