export type Phase = 'feed' | 'raise' | 'stamp' | 'lift' | 'collect';
export type UpgradeId = 'feeder' | 'motor' | 'collector' | 'printing';
export type Progress = { cash: number; lifetime: number; bills: number; upgrades: UpgradeId[] };
export type GameState = Progress & { phase: Phase; progress: number; cycles: number };
export const UPGRADES: { id: UpgradeId; name: string; cost: number; description: string; icon: string }[] = [
  { id: 'feeder', name: 'Auto Feeder', cost: 15, description: 'Fresh paper. Right where you need it.', icon: 'feed' },
  { id: 'motor', name: 'Motorized Lift', cost: 35, description: 'Let a motor do the heavy lifting.', icon: 'motor' },
  { id: 'collector', name: 'Auto Collector', cost: 75, description: 'Every bill, straight to your pocket.', icon: 'collect' },
  { id: 'printing', name: 'Improved Printing', cost: 150, description: 'Better ink. Double the payday.', icon: 'print' },
];
export const freshProgress = (): Progress => ({ cash: 0, lifetime: 0, bills: 0, upgrades: [] });
export const createGame = (save = freshProgress()): GameState => ({ ...save, phase: 'feed', progress: 0, cycles: save.bills });
export const earnings = (state: Progress) => state.upgrades.includes('printing') ? 10 : 5;
export const direction = (state: GameState) => state.cycles % 2 === 0 ? 1 : -1;
export const automated = (state: GameState) =>
  (state.phase === 'feed' && state.upgrades.includes('feeder')) ||
  ((state.phase === 'raise' || state.phase === 'lift') && state.upgrades.includes('motor')) ||
  (state.phase === 'collect' && state.upgrades.includes('collector'));
export type Action =
  | { type: 'feed' } | { type: 'turn'; amount: number } | { type: 'stamp' }
  | { type: 'collect' } | { type: 'buy'; id: UpgradeId } | { type: 'reset' };
export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'reset': return createGame();
    case 'feed': return state.phase === 'feed' ? { ...state, phase: 'raise', progress: 0 } : state;
    case 'turn': {
      if ((state.phase !== 'raise' && state.phase !== 'lift') || !Number.isFinite(action.amount)) return state;
      const progress = Math.min(1, Math.max(0, state.progress + action.amount));
      return progress >= 1 ? { ...state, phase: state.phase === 'raise' ? 'stamp' : 'collect', progress: 0 } : { ...state, progress };
    }
    case 'stamp': return state.phase === 'stamp' ? { ...state, phase: 'lift', progress: 0 } : state;
    case 'collect': {
      if (state.phase !== 'collect') return state;
      const value = earnings(state);
      return { ...state, phase: 'feed', progress: 0, cash: state.cash + value, lifetime: state.lifetime + value, bills: state.bills + 1, cycles: state.cycles + 1 };
    }
    case 'buy': {
      const upgrade = UPGRADES.find(item => item.id === action.id);
      if (!upgrade || state.upgrades.includes(action.id) || state.cash < upgrade.cost) return state;
      return { ...state, cash: state.cash - upgrade.cost, upgrades: [...state.upgrades, action.id] };
    }
  }
}
