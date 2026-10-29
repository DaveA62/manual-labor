/** Layout dimensions are available content pixels, after navigation/padding/safe areas. */
export const UI = {
  wide: {
    minWidth: 1060,
    minHeight: 660,
    workspaceFraction: 0.625,
    maintenanceFraction: 0.59,
    gap: 12,
  },
  touchTarget: 44,
  maintenance: { rowHeight: 96, inlineRowHeight: 76, padding: 16, maxRows: 3 },
  storage: {
    gap: 12,
    inlineGap: 8,
    minCardWidth: 148,
    cardHeight: 202,
    compactHeight: 138,
    compactBelow: 210,
    maxColumns: 4,
    maxRows: 3,
    inlineMaxColumns: 2,
  },
  gestures: { storageHoldMs: 430, pageHoldMs: 550 },
  animation: {
    cashMs: 1400,
    impactMs: 230,
    liquidMs: 600,
    capperReturnMs: 150,
    carbonationMs: 900,
  },
} as const;
export const wideWorkshop = (width: number, height: number) =>
  width >= UI.wide.minWidth && height >= UI.wide.minHeight;
export const uiVariables = {
  "--workspace-fr": `${UI.wide.workspaceFraction}fr`,
  "--management-fr": `${1 - UI.wide.workspaceFraction}fr`,
  "--management-top-fr": `${UI.wide.maintenanceFraction}fr`,
  "--management-bottom-fr": `${1 - UI.wide.maintenanceFraction}fr`,
  "--workshop-gap": `${UI.wide.gap}px`,
  "--storage-gap": `${UI.storage.gap}px`,
  "--storage-inline-gap": `${UI.storage.inlineGap}px`,
  "--target": `${UI.touchTarget}px`,
  "--motion-cash": `${UI.animation.cashMs}ms`,
  "--motion-impact": `${UI.animation.impactMs}ms`,
  "--motion-liquid": `${UI.animation.liquidMs}ms`,
  "--motion-capper": `${UI.animation.capperReturnMs}ms`,
  "--motion-carbonation": `${UI.animation.carbonationMs}ms`,
};
