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
  unit: string;
  stepNames: readonly string[];
  tiers: readonly MachineTier[];
  phases: readonly Phase[];
  durationMs: Partial<Record<Phase, number>>;
  automation: Partial<Record<Phase, UpgradeId>>;
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
  unit: 'bill',
  stepNames: ['Load', 'Raise', 'Stamp', 'Lift', 'Collect'],
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
export const BOTTLER: MachineDefinition = {
  type: 'bottler', name: 'Bottling Machine', model: 'BT-02', price: 250,
  unit: 'bottle', stepNames: ['Load', 'Fill', 'Slide', 'Cap', 'Collect'],
  tiers: [
    { id: 'water', name: 'Water Bottler', baseEarnings: 25, upgradePriceMultiplier: 1, finish: 'mint' },
    { id: 'soda', name: 'Soda Bottler', baseEarnings: 100, upgradePriceMultiplier: 3, finish: 'silver',
      refit: { fee: 3750, requiredUpgrades: ['bottle-loader', 'flow-regulator', 'auto-capper', 'crate-conveyor'] } },
    { id: 'premium', name: 'Premium Bottler', baseEarnings: 375, upgradePriceMultiplier: 9, finish: 'gold',
      refit: { fee: 20000, requiredUpgrades: ['bottle-loader', 'flow-regulator', 'auto-capper', 'crate-conveyor'] } },
  ],
  phases: ['load', 'fill', 'transfer', 'cap', 'collect'],
  durationMs: { load: 700, fill: 4000, transfer: 800, cap: 650, collect: 850 },
  automation: { load: 'bottle-loader', fill: 'flow-regulator', transfer: 'auto-capper', cap: 'auto-capper', collect: 'crate-conveyor' },
  upgrades: [
    { id: 'bottle-loader', name: 'Bottle Loader', cost: 75, description: 'Loads empty bottles.', icon: 'feed' },
    { id: 'flow-regulator', name: 'Flow Regulator', cost: 150, description: 'Fills to target. Base payout; no precision bonus.', icon: 'motor' },
    { id: 'auto-capper', name: 'Auto Capper', cost: 250, description: 'Transfers and seals bottles.', icon: 'stamp' },
    { id: 'crate-conveyor', name: 'Crate Conveyor', cost: 350, description: 'Collects sealed bottles.', icon: 'collect' },
  ],
};
export const BOTTLING = {
  sizes: ['standard', 'short', 'tall'] as const,
  capacity: { short: .8, standard: 1, tall: 1.2 },
  valveTravel: Math.PI * 1.5, residualMs: 240, residualRate: .12,
  maxFill: 1.25, regulatedFill: 1,
};
export const MACHINE_DEFINITIONS: Record<MachineType, MachineDefinition> = { 'money-press': MONEY_PRESS, bottler: BOTTLER };
export function slotPrice(capacity: number) {
  const extra = Math.max(0, capacity - ECONOMY.startingSlots);
  return Math.ceil(ECONOMY.slotBasePrice * ECONOMY.slotPriceMultiplier ** extra / ECONOMY.slotPriceRounding) * ECONOMY.slotPriceRounding;
}
