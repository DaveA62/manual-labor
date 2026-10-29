export function gridLayout(width: number, height: number) {
  const gap = 12;
  const compact = height < 210;
  const columns = Math.max(1, Math.min(4, Math.floor((width + gap) / (148 + gap))));
  const rows = Math.max(1, Math.min(3, Math.floor((height + gap) / ((compact ? 138 : 202) + gap))));
  return { columns, rows, size: columns * rows, compact };
}
export const pageForSlot = (slot: number, pageSize: number) => Math.floor(Math.max(0, slot) / Math.max(1, pageSize));
export const pageCount = (items: number, pageSize: number) => Math.max(1, Math.ceil(items / Math.max(1, pageSize)));
export const clampPage = (page: number, pages: number) => Math.max(0, Math.min(page, pages - 1));
