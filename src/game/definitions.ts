import type { MachineType, Phase, UpgradeId } from './types.ts';

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  cost: number;
  description: string;
  icon: string;
}
export interface MachineDefinition {
  type: MachineType;
  name: string;
  price: number;
  baseEarnings: number;
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
  price: 50,
  baseEarnings: 5,
  phases: ['feed', 'raise', 'stamp', 'lift', 'collect'],
  durationMs: { feed: 650, raise: 1100, stamp: 450, lift: 1100, collect: 650 },
  automation: { feed: 'feeder', raise: 'motor', stamp: 'stamper', lift: 'motor', collect: 'collector' },
  upgrades: [
    { id: 'feeder', name: 'Auto Feeder', cost: 15, description: 'Fresh paper. Right where you need it.', icon: 'feed' },
    { id: 'motor', name: 'Motorized Lift', cost: 35, description: 'Let a motor do the heavy lifting.', icon: 'motor' },
    { id: 'collector', name: 'Auto Collector', cost: 75, description: 'Every bill, straight to your pocket.', icon: 'collect' },
    { id: 'stamper', name: 'Auto Stamper', cost: 125, description: 'The final step to a hands-free shift.', icon: 'stamp' },
    { id: 'printing', name: 'Improved Printing', cost: 150, description: 'Better ink. Double the payday.', icon: 'print' },
  ],
};
export const MACHINE_DEFINITIONS: Record<MachineType, MachineDefinition> = { 'money-press': MONEY_PRESS };
export function slotPrice(capacity: number) {
  const extra = Math.max(0, capacity - ECONOMY.startingSlots);
  return Math.ceil(ECONOMY.slotBasePrice * ECONOMY.slotPriceMultiplier ** extra / ECONOMY.slotPriceRounding) * ECONOMY.slotPriceRounding;
}
