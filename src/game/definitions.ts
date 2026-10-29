import type { MachineType, Phase, UpgradeId } from './types.ts';

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
  finish: 'mint' | 'silver' | 'gold';
  /** Requirements for entering this tier from the preceding tier. */
  refit?: { fee: number; requiredUpgrades: readonly UpgradeId[] };
}
export interface MachineDefinition {
  type: MachineType;
  name: string;
  model: string;
  price: number;
  tiers: readonly MachineTier[];
  phases: readonly Phase[];
  durationMs: Record<Phase, number>;
  automation: Record<Phase, UpgradeId>;
  upgrades: readonly UpgradeDefinition[];
}
export const ECONOMY = {
  startingSlots: 2,
  slotBasePrice: 50,
  slotPriceMultiplier: 1.8,
  slotPriceRounding: 5,
} as const;

export const MONEY_PRESS: MachineDefinition = {
  type: 'money-press',
  name: 'Money Press',
  model: 'MP-01',
  price: 50,
  tiers: [
    { id: 'cash', name: 'Cash Press', baseEarnings: 5, upgradePriceMultiplier: 1, finish: 'mint' },
    { id: 'silver', name: 'Silver Press', baseEarnings: 20, upgradePriceMultiplier: 3, finish: 'silver',
      refit: { fee: 750, requiredUpgrades: ['feeder', 'motor', 'collector', 'stamper'] } },
    { id: 'gold', name: 'Gold Press', baseEarnings: 75, upgradePriceMultiplier: 9, finish: 'gold',
      refit: { fee: 4000, requiredUpgrades: ['feeder', 'motor', 'collector', 'stamper'] } },
  ],
  phases: ['feed', 'raise', 'stamp', 'lift', 'collect'],
  durationMs: { feed: 650, raise: 1100, stamp: 450, lift: 1100, collect: 650 },
  automation: { feed: 'feeder', raise: 'motor', stamp: 'stamper', lift: 'motor', collect: 'collector' },
  upgrades: [
    { id: 'feeder', name: 'Auto Feeder', cost: 15, description: 'Loads blank paper.', icon: 'feed' },
    { id: 'motor', name: 'Motorized Lift', cost: 35, description: 'Automates both lift steps.', icon: 'motor' },
    { id: 'collector', name: 'Auto Collector', cost: 75, description: 'Collects printed bills.', icon: 'collect' },
    { id: 'stamper', name: 'Auto Stamper', cost: 125, description: 'Automates stamping.', icon: 'stamp' },
    { id: 'printing', name: 'Improved Printing', cost: 150, description: 'Doubles bill value.', icon: 'print' },
  ],
};
export const MACHINE_DEFINITIONS: Record<MachineType, MachineDefinition> = { 'money-press': MONEY_PRESS };
export function slotPrice(capacity: number) {
  const extra = Math.max(0, capacity - ECONOMY.startingSlots);
  return Math.ceil(ECONOMY.slotBasePrice * ECONOMY.slotPriceMultiplier ** extra / ECONOMY.slotPriceRounding) * ECONOMY.slotPriceRounding;
}
