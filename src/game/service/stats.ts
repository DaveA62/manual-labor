import { RETIREMENT } from "../../config/retirement.ts";
import { SKILLS } from "../../config/continuum/skills.ts";
import type { EffectGroup } from "../../config/continuum/skills.ts";
import { OFFLINE } from "../../config/production.ts";
import { MONEY_PRESS } from "../../config/machines/moneyPress.ts";
import { ECONOMY } from "../../config/economy.ts";
import type { WorkshopState, MachineInstance, MachineType } from "../types.ts";
import type { ServiceProgress } from "./types.ts";
import { MACHINE_DEFINITIONS, slotPrice } from "../definitions.ts";
export const cents = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export function derivedStats(service?: ServiceProgress) {
  const groups = Object.fromEntries(
    [
      "global",
      "manual",
      "automated",
      "offline",
      "speed",
      "earlySpeed",
      "machineDiscount",
      "upgradeDiscount",
      "prestigedUpgradeDiscount",
      "prestigeDiscount",
      "startingCash",
      "storage",
      "offlineMs",
      "startingPresses",
    ].map((g) => [g, 0]),
  ) as Record<EffectGroup, number>;
  for (const node of SKILLS)
    for (const effect of node.effects)
      groups[effect.group] += effect.value * (service?.skills[node.id] ?? 0);
  if (service?.recognition) groups.global += RETIREMENT.recognition;
  return {
    ...groups,
    machineDiscount: Math.min(
      RETIREMENT.purchaseDiscountCap,
      groups.machineDiscount,
    ),
    prestigeDiscount: Math.min(
      RETIREMENT.prestigeDiscountCap,
      groups.prestigeDiscount,
    ),
    offlineMs: Math.min(
      RETIREMENT.offlineCapMs,
      OFFLINE.capMs + groups.offlineMs,
    ),
    storage: ECONOMY.startingSlots + groups.storage,
    startingCash: cents(
      groups.startingCash *
        MONEY_PRESS.price *
        RETIREMENT.startingCashPriceMultiple,
    ),
  };
}
export interface ProductionModifiers {
  global: number;
  manual: number;
  automated: number;
  offline: number;
  speed: number;
  earlySpeed: number;
  offlineMode: boolean;
}
export const NEUTRAL: ProductionModifiers = {
  global: 1,
  manual: 1,
  automated: 1,
  offline: 1,
  speed: 1,
  earlySpeed: 1,
  offlineMode: false,
};
export function productionModifiers(
  state: Pick<WorkshopState, "service">,
  offline = false,
): ProductionModifiers {
  const s = derivedStats(state.service);
  return {
    global: 1 + s.global,
    manual: 1 + s.manual,
    automated: 1 + s.automated,
    offline: 1 + s.offline,
    speed:
      1 +
      s.speed +
      (state.service && state.service.careerMs < RETIREMENT.seniorityMs
        ? s.earlySpeed
        : 0),
    earlySpeed:
      1 +
      (state.service && state.service.careerMs < RETIREMENT.seniorityMs
        ? s.earlySpeed
        : 0),
    offlineMode: offline,
  };
}
export function payoutFactor(
  m: MachineInstance,
  p: ProductionModifiers = NEUTRAL,
) {
  const full = MACHINE_DEFINITIONS[m.type].phases.every((phase) =>
    m.upgrades.includes(MACHINE_DEFINITIONS[m.type].automation[phase]!),
  );
  return (
    p.global *
    (m.manualCycle ? p.manual : p.automated) *
    (p.offlineMode && full ? p.offline : 1)
  );
}
export const timedDuration = (
  duration: number,
  p: ProductionModifiers = NEUTRAL,
  automatic = true,
) =>
  Math.max(
    RETIREMENT.minimumPhaseMs,
    duration / (automatic ? p.speed : p.earlySpeed),
  );
export const machinePrice = (type: MachineType, service?: ServiceProgress) =>
  cents(
    MACHINE_DEFINITIONS[type].price *
      (1 - derivedStats(service).machineDiscount),
  );
export const upgradeFactor = (m: MachineInstance, service?: ServiceProgress) =>
  1 -
  Math.min(
    RETIREMENT.upgradeDiscountCap,
    derivedStats(service).upgradeDiscount +
      (m.tier !== MACHINE_DEFINITIONS[m.type].tiers[0].id
        ? derivedStats(service).prestigedUpgradeDiscount
        : 0),
  );
export const prestigeFactor = (service?: ServiceProgress) =>
  1 - derivedStats(service).prestigeDiscount;
export const storagePrice = (state: WorkshopState) =>
  slotPrice(
    state.slots.length -
      (derivedStats(state.service).storage - ECONOMY.startingSlots),
  );
