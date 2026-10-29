import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPage, gridLayout, pageCount, pageForSlot } from '../src/ui/pagination.ts';

test('bay pages cover every unlocked slot exactly once at different viewport sizes', () => {
  for (const [width, height] of [[288, 240], [351, 580], [752, 195], [1200, 690]]) {
    const layout = gridLayout(width, height);
    const slots = Array.from({ length: 47 }, (_, index) => `press-${index}`);
    const visited = [];
    for (let page = 0; page < pageCount(slots.length, layout.size); page++) visited.push(...slots.slice(page * layout.size, (page + 1) * layout.size));
    assert.deepEqual(visited, slots);
    assert.ok(layout.columns >= 1 && layout.columns <= 4);
    assert.ok(layout.rows >= 1 && layout.rows <= 3);
  }
});
test('keyboard moves can find destination pages and resizing clamps the current page', () => {
  assert.equal(pageForSlot(4, 4), 1);
  assert.equal(pageForSlot(3, 4), 0);
  assert.equal(pageForSlot(17, 4), 4);
  assert.equal(clampPage(7, 2), 1);
  assert.equal(clampPage(-1, 5), 0);
  assert.equal(pageCount(0, 4), 1);
});
test('short bays omit illustrations and zero-sized initial measurements remain usable', () => {
  assert.equal(gridLayout(640, 170).compact, true);
  assert.equal(gridLayout(640, 500).compact, false);
  assert.deepEqual(gridLayout(0, 0), { columns: 1, rows: 1, size: 1, compact: true });
});
