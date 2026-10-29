/** Compatibility registry facade. Tune balance in src/config, not in renderers. */
import type { MachineType } from './types.ts';
import type { MachineDefinition } from '../config/machines/types.ts';
import { MONEY_PRESS } from '../config/machines/moneyPress.ts';
import { BOTTLER } from '../config/machines/bottler.ts';
import { ECONOMY } from '../config/economy.ts';
export { ECONOMY } from '../config/economy.ts';
export { MONEY_PRESS, PRESS_BALANCE } from '../config/machines/moneyPress.ts';
export { BOTTLER, BOTTLING } from '../config/machines/bottler.ts';
export type { UpgradeDefinition, MachineTier, MachineDefinition } from '../config/machines/types.ts';
export const MACHINE_DEFINITIONS: Record<MachineType, MachineDefinition> = { 'money-press': MONEY_PRESS, bottler: BOTTLER };
export function slotPrice(capacity: number) {
  const extra = Math.max(0, capacity - ECONOMY.startingSlots);
  return Math.ceil(ECONOMY.slotBasePrice * ECONOMY.slotPriceMultiplier ** extra / ECONOMY.slotPriceRounding) * ECONOMY.slotPriceRounding;
}
