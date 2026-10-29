/** Shared by browser and authenticated game-sync. Values are provisional. */
export const RETIREMENT = {
  pointBase: 25000,
  pointGrowth: 15000,
  recognition: 0.1,
  purchaseDiscountCap: 0.5,
  upgradeDiscountCap: 0.5,
  prestigeDiscountCap: 0.4,
  offlineCapMs: 24 * 60 * 60 * 1000,
  minimumPhaseMs: 100,
  seniorityMs: 10 * 60 * 1000,
  // Per Prior Experience level: starting Cash Press list price × 2.
  startingCashPriceMultiple: 2,
} as const;
export const CONTINUUM = {
  compactFocusY: 80,
  labelPx: 11,
  levelPx: 9,
  minZoom: 0.3,
  maxZoom: 1.6,
  initialZoom: 0.85,
  bounds: { left: -1600, right: 1600, top: -1200, bottom: 1500 },
  firstTransitionMs: 6400,
  laterTransitionMs: 1900,
} as const;
