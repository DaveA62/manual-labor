import { getPlatform } from '../platform/index.ts';
import type { SaveStorage } from '../platform/contracts.ts';
import { createWorkshop } from './engine.ts';
import { decodeSave, SAVE_KEY, LEGACY_SAVE_KEY } from './codec.ts';
import type { WorkshopState } from './types.ts';
export { decodeSave, SAVE_KEY, LEGACY_SAVE_KEY } from './codec.ts';
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
