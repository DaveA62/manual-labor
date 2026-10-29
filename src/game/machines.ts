import {
  cents,
  NEUTRAL,
  payoutFactor,
  timedDuration,
  upgradeFactor,
  prestigeFactor,
} from "./service/stats.ts";
import type { ProductionModifiers } from "./service/stats.ts";
import type { ServiceProgress } from "./service/types.ts";
import { BOTTLING, PRESS_BALANCE, MACHINE_DEFINITIONS } from "./definitions.ts";
import type {
  MachineInstance,
  MachineType,
  Phase,
  UpgradeId,
} from "./types.ts";

let idSequence = 0;
/** randomUUID requires HTTPS; getRandomValues also works in local HTTP previews. */
export function newMachineId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return (
      "press-" +
      [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    );
  }
  return `press-${Date.now().toString(36)}-${(++idSequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export function createMachine(
  id: string,
  type: MachineType = "money-press",
): MachineInstance {
  return {
    id,
    type,
    tier: MACHINE_DEFINITIONS[type].tiers[0].id,
    upgrades: [],
    phase: MACHINE_DEFINITIONS[type].phases[0],
    progress: 0,
    lifetime: 0,
    bills: 0,
    ...(type === "bottler" ? { bottler: initialBottle(0) } : {}),
  };
}
export function initialBottle(cycles: number) {
  return {
    size: BOTTLING.sizes[cycles % BOTTLING.sizes.length],
    fill: 0,
    valve: 0,
    dripMs: 0,
    regulated: false,
  };
}
export function bottleQuality(fill: number) {
  return fill >= BOTTLING.quality.preciseMin - BOTTLING.quality.epsilon &&
    fill <= BOTTLING.quality.preciseMax + BOTTLING.quality.epsilon
    ? "Precise"
    : fill >= BOTTLING.quality.acceptableMin - BOTTLING.quality.epsilon &&
        fill <= BOTTLING.quality.acceptableMax + BOTTLING.quality.epsilon
      ? "Acceptable"
      : "Poor";
}
export function bottlePayout(
  machine: MachineInstance,
  modifiers: ProductionModifiers = NEUTRAL,
) {
  const b = machine.bottler!;
  const quality = bottleQuality(b.fill);
  return (
    Math.round(
      tier(machine).baseEarnings *
        payoutFactor(machine, modifiers) *
        (b.regulated
          ? 1
          : quality === "Precise"
            ? BOTTLING.payout.precise
            : quality === "Acceptable"
              ? BOTTLING.payout.acceptable
              : BOTTLING.payout.poor) *
        100,
    ) / 100
  );
}
export const definition = (machine: MachineInstance) =>
  MACHINE_DEFINITIONS[machine.type];
export const tier = (machine: MachineInstance) =>
  definition(machine).tiers.find((item) => item.id === machine.tier)!;
export const nextTier = (machine: MachineInstance) => {
  const tiers = definition(machine).tiers;
  return tiers[tiers.findIndex((item) => item.id === machine.tier) + 1];
};
export const upgradePrice = (
  machine: MachineInstance,
  upgradeId: UpgradeId,
  service?: ServiceProgress,
) => {
  const upgrade = definition(machine).upgrades.find(
    (item) => item.id === upgradeId,
  );
  return upgrade
    ? cents(
        upgrade.cost *
          tier(machine).upgradePriceMultiplier *
          upgradeFactor(machine, service),
      )
    : Infinity;
};
export const refitPrice = (
  machine: MachineInstance,
  service?: ServiceProgress,
) =>
  cents((nextTier(machine)?.refit?.fee ?? Infinity) * prestigeFactor(service));
export const canRefit = (
  machine: MachineInstance,
  cash: number,
  service?: ServiceProgress,
) => {
  const requirements = nextTier(machine)?.refit;
  return (
    !!requirements &&
    cash >= refitPrice(machine, service) &&
    requirements.requiredUpgrades.every((id) => machine.upgrades.includes(id))
  );
};
export const earnings = (
  machine: MachineInstance,
  modifiers: ProductionModifiers = NEUTRAL,
) =>
  cents(
    tier(machine).baseEarnings *
      payoutFactor(machine, modifiers) *
      (machine.upgrades.includes("printing")
        ? PRESS_BALANCE.printingMultiplier
        : 1),
  );
export const direction = (machine: MachineInstance) =>
  machine.bills % 2 === 0 ? 1 : -1;
export const automated = (
  machine: MachineInstance,
  phase: Phase = machine.phase,
) =>
  !!definition(machine).automation[phase] &&
  machine.upgrades.includes(definition(machine).automation[phase]!);
export const fullyAutomated = (machine: MachineInstance) =>
  definition(machine).phases.every((phase) => automated(machine, phase));
export const cycleDuration = (
  machine: MachineInstance,
  modifiers: ProductionModifiers = NEUTRAL,
) =>
  definition(machine).phases.reduce(
    (total, phase) =>
      total +
      timedDuration(
        definition(machine).durationMs[phase]! *
          (machine.type === "bottler" && phase === "fill"
            ? BOTTLING.capacity[machine.bottler!.size]
            : 1),
        modifiers,
      ),
    0,
  );
export const averageCycleDuration = (
  machine: MachineInstance,
  modifiers: ProductionModifiers = NEUTRAL,
) =>
  machine.type === "bottler"
    ? BOTTLING.sizes.reduce(
        (total, size) =>
          total +
          definition(machine).phases.reduce(
            (sum, phase) =>
              sum +
              timedDuration(
                definition(machine).durationMs[phase]! *
                  (phase === "fill" ? BOTTLING.capacity[size] : 1),
                modifiers,
              ),
            0,
          ),
        0,
      ) / BOTTLING.sizes.length
    : cycleDuration(machine, modifiers);
export const earningsPerMinute = (
  machine: MachineInstance,
  modifiers: ProductionModifiers = NEUTRAL,
) =>
  fullyAutomated(machine)
    ? (earnings({ ...machine, manualCycle: false }, modifiers) * 60000) /
      averageCycleDuration(machine, modifiers)
    : 0;
export const machineStatus = (machine: MachineInstance) =>
  fullyAutomated(machine)
    ? "Fully Automated"
    : automated(machine)
      ? "Running"
      : "Needs Input";
export const phaseLabel: Record<Phase, string> = {
  feed: "Loading paper",
  raise: "Raising head",
  stamp: "Stamping",
  lift: "Lifting head",
  collect: "Collecting output",
  load: "Loading bottle",
  fill: "Regulating flow",
  transfer: "Moving carriage",
  cap: "Sealing bottle",
};
