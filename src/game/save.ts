import { freshProgress, UPGRADES } from './engine.ts';
import type { Progress } from './engine.ts';
export const SAVE_KEY = 'manual-labor:save:v1';
export function decodeSave(raw: string | null): Progress {
  if (!raw) return freshProgress();
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Number.isSafeInteger(data.cash) || data.cash < 0 ||
      !Number.isSafeInteger(data.lifetime) || data.lifetime < data.cash ||
      !Number.isSafeInteger(data.bills) || data.bills < 0 || !Array.isArray(data.upgrades)) return freshProgress();
    return { cash: data.cash, lifetime: data.lifetime, bills: data.bills,
      upgrades: UPGRADES.filter(item => data.upgrades.includes(item.id)).map(item => item.id) };
  } catch { return freshProgress(); }
}
export function readSave(): Progress {
  try { return decodeSave(localStorage.getItem(SAVE_KEY)); } catch { return freshProgress(); }
}
export function writeSave(state: Progress): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, cash: state.cash, lifetime: state.lifetime, bills: state.bills, upgrades: state.upgrades }));
    return true;
  } catch { return false; }
}
