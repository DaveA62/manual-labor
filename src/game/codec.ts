import { parseService } from "./service/codec.ts";
import { cents } from "./service/stats.ts";
import { BOTTLING, MACHINE_DEFINITIONS } from "./definitions.ts";
import { createWorkshop } from "./engine.ts";
import { createMachine } from "./machines.ts";
import type {
  MachineInstance,
  MachineType,
  Phase,
  UpgradeId,
  WorkshopState,
} from "./types.ts";
export const SAVE_VERSION = 5;
export const SAVE_KEY = "manual-labor:save:v2";
export const LEGACY_SAVE_KEY = "manual-labor:save:v1";
const nonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export const validCurrency = (value: unknown): value is number =>
  typeof value === "number" &&
  value >= 0 &&
  (Number.isSafeInteger(value) ||
    (Number.isSafeInteger(Math.round(value * 100)) &&
      Math.abs(value * 100 - Math.round(value * 100)) < 1e-5));
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function upgrades(value: unknown, type: MachineType): UpgradeId[] | null {
  return Array.isArray(value)
    ? MACHINE_DEFINITIONS[type].upgrades
        .filter((upgrade) => value.includes(upgrade.id))
        .map((upgrade) => upgrade.id)
    : null;
}
function parseMachine(value: unknown, version: number): MachineInstance | null {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 128 ||
    typeof value.type !== "string" ||
    !Object.hasOwn(MACHINE_DEFINITIONS, value.type)
  )
    return null;
  const type = value.type as MachineType;
  const tier =
    value.tier === undefined && version === 2
      ? MACHINE_DEFINITIONS[type].tiers[0].id
      : value.tier;
  if (
    typeof tier !== "string" ||
    !MACHINE_DEFINITIONS[type].tiers.some((item) => item.id === tier)
  )
    return null;
  const owned = upgrades(value.upgrades, type);
  if (
    !owned ||
    (value.manualCycle !== undefined &&
      typeof value.manualCycle !== "boolean") ||
    !MACHINE_DEFINITIONS[type].phases.includes(value.phase as Phase) ||
    typeof value.progress !== "number" ||
    !Number.isFinite(value.progress) ||
    value.progress < 0 ||
    value.progress >= 1 ||
    !validCurrency(value.lifetime) ||
    !nonnegative(value.bills)
  )
    return null;
  let bottler: MachineInstance["bottler"];
  if (type === "bottler") {
    const b = value.bottler;
    if (
      version < 4 ||
      !record(b) ||
      typeof b.size !== "string" ||
      !Object.hasOwn(BOTTLING.capacity, b.size) ||
      typeof b.fill !== "number" ||
      !Number.isFinite(b.fill) ||
      b.fill < 0 ||
      b.fill > BOTTLING.maxFill ||
      typeof b.valve !== "number" ||
      !Number.isFinite(b.valve) ||
      b.valve < 0 ||
      b.valve > 1 ||
      typeof b.dripMs !== "number" ||
      !Number.isFinite(b.dripMs) ||
      b.dripMs < 0 ||
      b.dripMs > BOTTLING.residualMs ||
      typeof b.regulated !== "boolean"
    )
      return null;
    bottler = {
      size: b.size as "short" | "standard" | "tall",
      fill: b.fill,
      valve: b.valve,
      dripMs: b.dripMs,
      regulated: b.regulated,
    };
  }
  return {
    ...(bottler ? { bottler } : {}),
    ...(value.manualCycle !== undefined
      ? { manualCycle: value.manualCycle as boolean }
      : {}),
    id: value.id,
    type,
    tier,
    phase: value.phase as Phase,
    progress: value.progress,
    lifetime: value.lifetime,
    bills: value.bills,
    upgrades: owned,
  };
}
/** Accepts legacy v1/v2 as well as v3/v4. Invalid saves never inject unvalidated state. */
export function decodeSave(raw: string | null): WorkshopState | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (
      !record(data) ||
      !validCurrency(data.cash) ||
      !validCurrency(data.lifetime) ||
      (data.lifetime < data.cash && data.service === undefined) ||
      !nonnegative(data.bills)
    )
      return null;
    if (data.version === 1) {
      const owned = upgrades(data.upgrades, "money-press");
      if (!owned) return null;
      const machine = {
        ...createMachine("press-legacy"),
        upgrades: owned,
        lifetime: data.lifetime,
        bills: data.bills,
      };
      return {
        ...createWorkshop(),
        cash: data.cash,
        lifetime: data.lifetime,
        bills: data.bills,
        machines: [machine],
        slots: [machine.id, null],
      };
    }
    if (
      (data.version !== 2 &&
        data.version !== 3 &&
        data.version !== 4 &&
        data.version !== 5) ||
      !Array.isArray(data.machines) ||
      (data.machines.length === 0 && !data.service) ||
      !Array.isArray(data.slots) ||
      data.slots.length < 2
    )
      return null;
    const service =
      data.version === 5 && data.service !== undefined
        ? parseService(data.service)
        : undefined;
    if (service === null || (data.version !== 5 && data.service !== undefined))
      return null;
    if (
      service &&
      (data.cash > cents(data.lifetime + service.grantedCash) ||
        (service.session &&
          (data.cash !== 0 ||
            data.machines.length !== 0 ||
            service.retiredEarnings !== data.lifetime ||
            service.retiredUnits !== data.bills ||
            service.careerMs !== 0)) ||
        (!service.session && data.machines.length === 0))
    )
      return null;
    const machines = data.machines.map((value) =>
      parseMachine(value, data.version as number),
    );
    if (machines.some((machine) => machine === null)) return null;
    const valid = machines as MachineInstance[];
    const ids = new Set(valid.map((machine) => machine.id));
    const slotted = data.slots.filter((id) => id !== null);
    if (
      ids.size !== valid.length ||
      slotted.length !== valid.length ||
      new Set(slotted).size !== slotted.length ||
      slotted.some((id) => typeof id !== "string" || !ids.has(id)) ||
      cents(
        valid.reduce(
          (sum, machine) => sum + machine.lifetime,
          service?.retiredEarnings ?? 0,
        ),
      ) !== data.lifetime ||
      valid.reduce(
        (sum, machine) => sum + machine.bills,
        service?.retiredUnits ?? 0,
      ) !== data.bills
    )
      return null;
    return {
      ...(service ? { service } : {}),
      cash: data.cash,
      lifetime: data.lifetime,
      bills: data.bills,
      machines: valid,
      slots: data.slots as (string | null)[],
    };
  } catch {
    return null;
  }
}
