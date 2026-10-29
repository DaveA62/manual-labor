import { getPlatform } from '../platform/index.ts';
import type { SaveStorage } from '../platform/contracts.ts';
import { MACHINE_DEFINITIONS } from './definitions.ts';
import { createWorkshop } from './engine.ts';
import { createMachine } from './machines.ts';
import type { MachineInstance, MachineType, Phase, UpgradeId, WorkshopState } from './types.ts';
export const SAVE_KEY = 'manual-labor:save:v2';
export const LEGACY_SAVE_KEY = 'manual-labor:save:v1';
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function upgrades(value: unknown, type: MachineType): UpgradeId[] | null {
  return Array.isArray(value) ? MACHINE_DEFINITIONS[type].upgrades.filter(upgrade => value.includes(upgrade.id)).map(upgrade => upgrade.id) : null;
}
function parseMachine(value: unknown, version: number): MachineInstance | null {
  if (!record(value) || typeof value.id !== 'string' || !value.id || value.id.length > 128 ||
    typeof value.type !== 'string' || !Object.hasOwn(MACHINE_DEFINITIONS, value.type)) return null;
  const type = value.type as MachineType;
  const tier = value.tier === undefined && version === 2 ? MACHINE_DEFINITIONS[type].tiers[0].id : value.tier;
  if (typeof tier !== 'string' || !MACHINE_DEFINITIONS[type].tiers.some(item => item.id === tier)) return null;
  const owned = upgrades(value.upgrades, type);
  if (!owned || !MACHINE_DEFINITIONS[type].phases.includes(value.phase as Phase) ||
    typeof value.progress !== 'number' || !Number.isFinite(value.progress) || value.progress < 0 || value.progress >= 1 ||
    !nonnegative(value.lifetime) || !nonnegative(value.bills)) return null;
  return { id: value.id, type, tier, phase: value.phase as Phase, progress: value.progress, lifetime: value.lifetime, bills: value.bills, upgrades: owned };
}
/** Accepts legacy v1/v2 as well as v3. Invalid saves never inject unvalidated state. */
export function decodeSave(raw: string | null): WorkshopState | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!record(data) || !nonnegative(data.cash) || !nonnegative(data.lifetime) || data.lifetime < data.cash || !nonnegative(data.bills)) return null;
    if (data.version === 1) {
      const owned = upgrades(data.upgrades, 'money-press');
      if (!owned) return null;
      const machine = { ...createMachine('press-legacy'), upgrades: owned, lifetime: data.lifetime, bills: data.bills };
      return { ...createWorkshop(), cash: data.cash, lifetime: data.lifetime, bills: data.bills, machines: [machine], slots: [machine.id, null] };
    }
    if ((data.version !== 2 && data.version !== 3) || !Array.isArray(data.machines) || data.machines.length === 0 || !Array.isArray(data.slots) || data.slots.length < 2) return null;
    const machines = data.machines.map(value => parseMachine(value, data.version as number));
    if (machines.some(machine => machine === null)) return null;
    const valid = machines as MachineInstance[];
    const ids = new Set(valid.map(machine => machine.id));
    const slotted = data.slots.filter(id => id !== null);
    if (ids.size !== valid.length || slotted.length !== valid.length || new Set(slotted).size !== slotted.length ||
      slotted.some(id => typeof id !== 'string' || !ids.has(id)) || valid.reduce((sum, machine) => sum + machine.lifetime, 0) !== data.lifetime ||
      valid.reduce((sum, machine) => sum + machine.bills, 0) !== data.bills) return null;
    return { cash: data.cash, lifetime: data.lifetime, bills: data.bills, machines: valid, slots: data.slots as (string | null)[] };
  } catch { return null; }
}
export function readSave(storage: SaveStorage = getPlatform().storage): WorkshopState {
  try { return decodeSave(storage.getItem(SAVE_KEY)) ?? decodeSave(storage.getItem(LEGACY_SAVE_KEY)) ?? createWorkshop(); }
  catch { return createWorkshop(); }
}
export function writeSave(state: WorkshopState, storage: SaveStorage = getPlatform().storage): boolean {
  try { storage.setItem(SAVE_KEY, JSON.stringify({ version: 3, ...state })); return true; }
  catch { return false; }
}
export function clearLegacySave(storage: SaveStorage = getPlatform().storage) {
  try { storage.removeItem(LEGACY_SAVE_KEY); } catch { /* Main save status reports unavailable storage. */ }
}
