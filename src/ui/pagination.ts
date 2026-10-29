import { UI } from "../config/ui.ts";
export function gridLayout(width: number, height: number, embedded = false) {
  const {
    gap: defaultGap,
    inlineGap,
    compactBelow,
    minCardWidth,
    compactHeight,
    cardHeight,
    maxColumns,
    maxRows,
    inlineMaxColumns,
  } = UI.storage;
  const gap = embedded ? inlineGap : defaultGap;
  const compact = embedded || height < compactBelow;
  const columns = Math.max(
    1,
    Math.min(
      embedded ? inlineMaxColumns : maxColumns,
      Math.floor((width + gap) / (minCardWidth + gap)),
    ),
  );
  const rows = Math.max(
    1,
    Math.min(
      maxRows,
      Math.floor(
        (height + gap) / ((compact ? compactHeight : cardHeight) + gap),
      ),
    ),
  );
  return { columns, rows, size: columns * rows, compact };
}
export const pageForSlot = (slot: number, pageSize: number) =>
  Math.floor(Math.max(0, slot) / Math.max(1, pageSize));
export const pageCount = (items: number, pageSize: number) =>
  Math.max(1, Math.ceil(items / Math.max(1, pageSize)));
export const clampPage = (page: number, pages: number) =>
  Math.max(0, Math.min(page, pages - 1));
