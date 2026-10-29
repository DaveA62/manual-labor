import type { MachineType, Phase, UpgradeId } from "../../game/types.ts";

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  cost: number;
  description: string;
  icon: string;
}
export interface MachineTier {
  id: string;
  name: string;
  baseEarnings: number;
  upgradePriceMultiplier: number;
  finish: "mint" | "silver" | "gold";
  /** Requirements for entering this tier from the preceding tier. */
  refit?: { fee: number; requiredUpgrades: readonly UpgradeId[] };
}
export interface MachineDefinition {
  type: MachineType;
  name: string;
  model: string;
  price: number;
  unit: string;
  stepNames: readonly string[];
  tiers: readonly MachineTier[];
  phases: readonly Phase[];
  durationMs: Partial<Record<Phase, number>>;
  automation: Partial<Record<Phase, UpgradeId>>;
  upgrades: readonly UpgradeDefinition[];
}
