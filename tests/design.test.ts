import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UI, wideWorkshop } from "../src/config/ui.ts";
import { CONTRAST } from "../src/config/theme.ts";
import { gridLayout, pageCount } from "../src/ui/pagination.ts";
test("wide Workshop requires room for both the machine and both management panels", () => {
  assert.equal(wideWorkshop(UI.wide.minWidth, UI.wide.minHeight), true);
  assert.equal(wideWorkshop(UI.wide.minWidth - 1, 1200), false);
  assert.equal(wideWorkshop(2400, UI.wide.minHeight - 1), false);
  assert.equal(wideWorkshop(0, 0), false);
  const layout = gridLayout(398, 216, true);
  assert.ok(layout.columns <= 2);
  assert.equal(layout.compact, true);
  assert.ok(pageCount(25, layout.size) > 1);
});
function luminance(hex: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}
test("shared normal-text plates, readouts and muted UI foregrounds meet WCAG AA", () => {
  const css = readFileSync(
    new URL("../src/tokens.css", import.meta.url),
    "utf8",
  );
  const tokens = Object.fromEntries(
    [...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((m) => [m[1], m[2]]),
  );
  for (const [ink, back] of [
    ["charcoal", "panel"],
    ["panel", "charcoal"],
    ["charcoal", "paper"],
    ["charcoal", "orange"],
    ["muted", "panel"],
    ["muted", "paper"],
    ["muted", "mint-light"],
  ])
    assert.ok(
      contrast(tokens[ink], tokens[back]) >= CONTRAST.normal,
      `${ink} on ${back}`,
    );
});

test("configured bottle capacities keep bulk offline production aligned with ordinary ticks", async () => {
  const { BOTTLING, BOTTLER } = await import(
    "../src/config/machines/bottler.ts"
  );
  const { createMachine } = await import("../src/game/machines.ts");
  const { advanceMachine } = await import("../src/game/simulation.ts");
  const old = { ...BOTTLING.capacity };
  try {
    BOTTLING.capacity.short = 0.7;
    BOTTLING.capacity.tall = 1.1;
    const m = {
      ...createMachine("configured", "bottler"),
      upgrades: BOTTLER.upgrades.map((u) => u.id),
    };
    const whole = advanceMachine(m, 100000);
    let split = m;
    for (let i = 0; i < 100000; i += 50) split = advanceMachine(split, 50);
    assert.equal(whole.bills, split.bills);
    assert.equal(whole.lifetime, split.lifetime);
    assert.equal(whole.phase, split.phase);
    assert.ok(Math.abs(whole.progress - split.progress) < 1e-7);
  } finally {
    Object.assign(BOTTLING.capacity, old);
  }
});
