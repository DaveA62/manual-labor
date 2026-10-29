import test from "node:test";
import assert from "node:assert/strict";
import { BOTTLER, BOTTLING } from "../src/game/definitions.ts";
import {
  createMachine,
  automated,
  bottlePayout,
  bottleQuality,
  cycleDuration,
  earningsPerMinute,
} from "../src/game/machines.ts";
import { advanceMachine, operate } from "../src/game/simulation.ts";
import { createWorkshop, reducer } from "../src/game/engine.ts";
import { decodeSave } from "../src/game/codec.ts";
import {
  validAction,
  validatedState,
  validReport,
} from "../src/cloud/replay.ts";
import { synchronize } from "../src/cloud/server.ts";
import {
  CloudConflict,
  RULES_VERSION,
  OFFLINE_CAP_MS,
} from "../src/cloud/protocol.ts";
import type { CloudRecord, SyncResult } from "../src/cloud/protocol.ts";
import type { MachineInstance, WorkshopState } from "../src/game/types.ts";
const all = BOTTLER.upgrades.map((u) => u.id);
const bottle = (id = "b") => createMachine(id, "bottler");
function workshop(machines: MachineInstance[], cash = 0): WorkshopState {
  machines = machines.map((m, i) =>
    i === 0 ? { ...m, lifetime: m.lifetime + cash } : m,
  );
  return {
    cash,
    lifetime: machines.reduce((n, m) => n + m.lifetime, 0),
    bills: machines.reduce((n, m) => n + m.bills, 0),
    machines,
    slots: [...machines.map((m) => m.id), null],
  };
}
function fill(m: MachineInstance, level: number) {
  return {
    ...m,
    phase: "collect" as const,
    bottler: { ...m.bottler!, fill: level },
  };
}
test("bottler pays once after five distinct manual interactions and selects deterministic sizes", () => {
  let m = bottle();
  assert.equal(m.bottler!.size, "standard");
  m = operate(m, { type: "load" });
  assert.equal(m.phase, "fill");
  m = operate(m, { type: "valve", amount: 1 });
  m = advanceMachine(m, 3900);
  assert.ok(Math.abs(m.bottler!.fill - 0.975) < 1e-9);
  assert.equal(
    operate(m, { type: "transfer", amount: 1 }),
    m,
    "open valve blocks transfer",
  );
  m = operate(m, { type: "valve", amount: -1 });
  assert.equal(
    operate(m, { type: "transfer", amount: 1 }),
    m,
    "residual drip must settle",
  );
  m = advanceMachine(m, 240);
  assert.ok(Math.abs(m.bottler!.fill - 0.9822) < 1e-9);
  m = operate(m, { type: "transfer", amount: 0.5 });
  assert.equal(m.phase, "transfer");
  assert.equal(m.progress, 0.5);
  m = operate(m, { type: "transfer", amount: 0.5 });
  assert.equal(m.phase, "cap");
  m = operate(m, { type: "cap", amount: 1 });
  assert.equal(m.phase, "collect");
  assert.equal(m.lifetime, 0);
  m = operate(m, { type: "collect" });
  assert.equal(m.lifetime, 30);
  assert.equal(m.bills, 1);
  assert.equal(m.bottler!.size, "short");
  assert.equal(operate(m, { type: "collect" }), m);
  assert.equal(operate(m, { type: "stamp" }), m);
});
test("quality bands include boundaries and all tiers pay exact percentages, even empty or overflowing bottles", () => {
  for (const [n, q] of [
    [0, "Poor"],
    [0.8499, "Poor"],
    [0.85, "Acceptable"],
    [0.9499, "Acceptable"],
    [0.95, "Precise"],
    [1, "Precise"],
    [1.0001, "Acceptable"],
    [1.05, "Acceptable"],
    [1.0501, "Poor"],
    [1.25, "Poor"],
  ] as const)
    assert.equal(bottleQuality(n), q);
  for (const t of BOTTLER.tiers) {
    let m = { ...bottle(), tier: t.id };
    assert.equal(bottlePayout(fill(m, 0.97)), t.baseEarnings * 1.2);
    assert.equal(bottlePayout(fill(m, 0.9)), t.baseEarnings);
    assert.equal(bottlePayout(fill(m, 0)), t.baseEarnings * 0.7);
    assert.equal(bottlePayout(fill(m, 1.25)), t.baseEarnings * 0.7);
    const state = reducer(workshop([fill(m, 0)]), {
      type: "operate",
      machineId: m.id,
      action: { type: "collect" },
    });
    assert.equal(state.cash, t.baseEarnings * 0.7);
    assert.deepEqual(validatedState(state), state);
  }
});
test("size changes filling time, aperture continuously changes flow and closing leaves one fixed drip", () => {
  for (const size of BOTTLING.sizes) {
    let m = operate(bottle(), { type: "load" });
    m = { ...m, bottler: { ...m.bottler!, size } };
    m = operate(m, { type: "valve", amount: 0.5 });
    m = advanceMachine(m, 4000 * BOTTLING.capacity[size]);
    assert.ok(Math.abs(m.bottler!.fill - 0.5) < 1e-9);
    m = operate(m, { type: "valve", amount: -1 });
    m = advanceMachine(m, 1000);
    const expected = 0.5 + (240 * 0.12) / (4000 * BOTTLING.capacity[size]);
    assert.ok(Math.abs(m.bottler!.fill - expected) < 1e-9);
    assert.equal(advanceMachine(m, 10000), m, "closed valve cannot drip twice");
  }
});
test("all 16 bottler automation combinations stop at the first manual boundary", () => {
  for (let mask = 0; mask < 16; mask++) {
    const m = { ...bottle(), upgrades: all.filter((_, i) => mask & (1 << i)) };
    const next = advanceMachine(m, 100000);
    if (mask === 15) {
      assert.ok(next.bills > 0);
      assert.ok(next.lifetime === next.bills * 25);
    } else {
      assert.equal(automated(next), false);
      assert.equal(next.bills, 0);
    }
  }
  const partial = {
    ...fill(bottle(), 0.97),
    upgrades: ["crate-conveyor" as const],
  };
  const next = advanceMachine(partial, OFFLINE_CAP_MS);
  assert.equal(next.bills, 1);
  assert.equal(next.lifetime, 30);
  assert.equal(next.phase, "load");
});
test("manual open valve spills but cannot bypass manual transfer or earn offline", () => {
  let m = operate(operate(bottle(), { type: "load" }), {
    type: "valve",
    amount: 1,
  });
  m = advanceMachine(m, OFFLINE_CAP_MS);
  assert.equal(m.bottler!.fill, 1.25);
  assert.equal(m.phase, "fill");
  assert.equal(m.bills, 0);
});
test("regulated bottles never get manual precision bonus; upgrades activate independently mid-cycle", () => {
  let m = operate(bottle(), { type: "load" });
  m = {
    ...m,
    upgrades: ["flow-regulator"],
    bottler: { ...m.bottler!, fill: 0.97 },
  };
  m = advanceMachine(m, 1000);
  assert.equal(m.phase, "transfer");
  assert.equal(m.bottler!.regulated, true);
  m = operate(m, { type: "transfer", amount: 1 });
  m = operate(m, { type: "cap", amount: 1 });
  m = operate(m, { type: "collect" });
  assert.equal(m.lifetime, 25);
});
test("bulk simulation matches small ticks, fractional progress and save/reload across varying sizes", () => {
  const m = { ...bottle(), tier: "premium", upgrades: all };
  const duration = 73123;
  const whole = advanceMachine(m, duration);
  let split = m;
  for (let n = 0; n < duration; n += 37)
    split = advanceMachine(split, Math.min(37, duration - n));
  assert.equal(split.bills, whole.bills);
  assert.equal(split.phase, whole.phase);
  assert.ok(Math.abs(split.progress - whole.progress) < 1e-7);
  assert.ok(Math.abs(split.bottler!.fill - whole.bottler!.fill) < 1e-7);
  const before = advanceMachine(m, 1234),
    restored = validatedState(workshop([before])).machines[0];
  const resumed = advanceMachine(restored, duration - 1234);
  assert.equal(resumed.bills, whole.bills);
  assert.equal(resumed.phase, whole.phase);
  assert.equal(earningsPerMinute(m), (375 * 60000) / 7000);
  assert.equal(cycleDuration(m), 7000);
});
test("bottler purchase, upgrades, rearranging and refit preserve other families and instance identity", () => {
  let state = workshop([createMachine("press")], 100000);
  state = reducer(state, {
    type: "buy-machine",
    machineType: "bottler",
    id: "b",
  });
  assert.equal(state.cash, 99750);
  for (const upgradeId of all)
    state = reducer(state, { type: "buy-upgrade", machineId: "b", upgradeId });
  const press = state.machines[0];
  state = reducer(state, { type: "move", machineId: "b", to: 0 });
  const slots = state.slots;
  const before = state.cash;
  state = reducer(state, { type: "refit", machineId: "b", fromTier: "water" });
  const b = state.machines[1];
  assert.equal(b.tier, "soda");
  assert.equal(b.id, "b");
  assert.equal(b.phase, "load");
  assert.deepEqual(b.upgrades, []);
  assert.deepEqual(b.bottler, bottle().bottler);
  assert.equal(state.cash, before - 3750);
  assert.equal(state.slots, slots);
  assert.equal(state.machines[0], press);
  assert.equal(
    reducer(state, { type: "refit", machineId: "b", fromTier: "water" }),
    state,
  );
  assert.equal(
    reducer(state, {
      type: "buy-upgrade",
      machineId: "b",
      upgradeId: "printing",
    }),
    state,
  );
});
test("v4 persists physical state and cents; v1/v2/v3 press saves migrate without changing data", () => {
  const old = { ...createWorkshop(), cash: 0 };
  for (const version of [2, 3, 4])
    assert.deepEqual(decodeSave(JSON.stringify({ version, ...old })), old);
  let m = operate(bottle(), { type: "load" });
  m = operate(m, { type: "valve", amount: 0.3 });
  m = advanceMachine(m, 1375);
  const state = workshop([m, createMachine("press")]);
  assert.deepEqual(decodeSave(JSON.stringify({ version: 4, ...state })), state);
  assert.equal(decodeSave(JSON.stringify({ version: 3, ...state })), null);
  for (const patch of [
    { fill: -1 },
    { fill: 1.26 },
    { valve: 2 },
    { size: "giant" },
    { dripMs: 241 },
    { regulated: 1 },
  ])
    assert.equal(
      decodeSave(
        JSON.stringify({
          version: 4,
          ...state,
          machines: [
            { ...m, bottler: { ...m.bottler, ...patch } },
            state.machines[1],
          ],
        }),
      ),
      null,
    );
});
test("cloud validation accepts family intent and rejects fabricated rules, ticks and malformed controls", () => {
  for (const action of [
    { type: "buy-machine", machineType: "bottler", id: "b" },
    { type: "buy-upgrade", machineId: "b", upgradeId: "flow-regulator" },
    { type: "operate", machineId: "b", action: { type: "valve", amount: 0.1 } },
  ])
    assert.equal(validAction(action), true);
  for (const action of [
    { type: "buy-machine", machineType: "unknown", id: "b" },
    { type: "tick", elapsedMs: 1000 },
    { type: "operate", machineId: "b", action: { type: "valve", amount: 2 } },
    {
      type: "operate",
      machineId: "b",
      action: { type: "transfer", amount: NaN },
    },
  ])
    assert.equal(validAction(action), false);
});
test("trusted cloud time caps mixed-family production and duplicate/concurrent claims do not double pay", async () => {
  let record: CloudRecord | null = null;
  let now = 0;
  const receipts = new Map<string, SyncResult>();
  const repo = {
    read: async (_owner: string, id: string) => ({
      now: new Date(now).toISOString(),
      record,
      receipt: receipts.get(id),
    }),
    commit: async (_owner: string, revision: number, next: SyncResult) => {
      if (receipts.has(next.requestId)) return receipts.get(next.requestId)!;
      if ((record?.revision ?? 0) !== revision)
        throw new CloudConflict(record!);
      record = next;
      receipts.set(next.requestId, next);
      return next;
    },
  };
  const full = { ...bottle(), upgrades: all },
    manual = bottle("manual"),
    refit = { ...bottle("refit"), tier: "soda" },
    partial = {
      ...fill(bottle("partial"), 0.5),
      upgrades: ["crate-conveyor" as const],
    };
  const initial = workshop([full, manual, refit, partial]);
  const req = {
    id: crypto.randomUUID(),
    revision: 0,
    events: [],
    initial,
    offline: true,
    rulesVersion: RULES_VERSION,
  };
  await synchronize("owner", req, repo);
  now = 20 * 3600000;
  const claim = { ...req, id: crypto.randomUUID(), revision: 1 };
  const result = await synchronize("owner", claim, repo);
  const expected = advanceMachine(full, OFFLINE_CAP_MS);
  assert.equal(result.state.cash, expected.lifetime + 17.5);
  assert.equal(result.state.machines[1].bills, 0);
  assert.equal(result.state.machines[2].bills, 0);
  assert.equal(result.state.machines[3].bills, 1);
  assert.equal(result.reports[0].eligibleMs, OFFLINE_CAP_MS);
  assert.ok(validReport(result.reports[0]));
  assert.equal(validReport({ ...result.reports[0], total: "17.50" }), false);
  assert.deepEqual(await synchronize("owner", claim, repo), result);
  await assert.rejects(
    synchronize("owner", { ...claim, id: crypto.randomUUID() }, repo),
    CloudConflict,
  );
  const sameTime = await synchronize(
    "owner",
    { ...claim, id: crypto.randomUUID(), revision: 2 },
    repo,
  );
  assert.equal(sameTime.state.cash, result.state.cash);
});

test("rotary end stops snap floating point residue to a closed valve", () => {
  let m = operate(bottle(), { type: "load" });
  m = operate(m, { type: "valve", amount: 1 / 3 });
  m = operate(m, { type: "valve", amount: -1 / 3 + Number.EPSILON });
  assert.equal(m.bottler!.valve, 0);
  m = advanceMachine(m, 240);
  assert.equal(
    operate(m, { type: "transfer", amount: 0.25 }).phase,
    "transfer",
  );
});

test("rule v1 Press-only clients remain compatible but cannot access Bottler state", async () => {
  let record: CloudRecord | null = null;
  const repo = {
    read: async () => ({ now: new Date(0).toISOString(), record }),
    commit: async (_id: string, _revision: number, next: SyncResult) => {
      record = next;
      return next;
    },
  };
  const req = {
    id: crypto.randomUUID(),
    revision: 0,
    events: [],
    initial: createWorkshop(),
    offline: false,
    rulesVersion: 1,
  };
  await synchronize("owner", req, repo);
  assert.equal(record!.schemaVersion, 5);
  record!.state = workshop([bottle()]);
  await assert.rejects(
    synchronize(
      "owner",
      { ...req, id: crypto.randomUUID(), revision: 1 },
      repo,
    ),
    /Game update required/,
  );
});

test("Auto Capper takes over after manual valve closure and drip, then stops at the next manual fill", () => {
  let m = {
    ...bottle(),
    upgrades: [
      "bottle-loader",
      "auto-capper",
      "crate-conveyor",
    ] as MachineInstance["upgrades"],
  };
  m = advanceMachine(m, 10000);
  assert.equal(m.phase, "fill");
  assert.equal(m.bottler!.fill, 0);
  m = operate(m, { type: "valve", amount: 1 });
  m = advanceMachine(m, 3900);
  assert.equal(m.phase, "fill");
  assert.equal(m.bills, 0, "open valve must never transfer");
  m = operate(m, { type: "valve", amount: -1 });
  const partial = advanceMachine(m, 100);
  assert.equal(partial.phase, "fill");
  assert.equal(partial.bills, 0);
  const next = advanceMachine(partial, 8 * 3600000);
  assert.equal(next.bills, 1);
  assert.equal(next.lifetime, 30);
  assert.equal(next.phase, "fill");
  assert.equal(next.bottler!.fill, 0);
  const whole = advanceMachine(m, 240 + 800 + 650 + 850 + 700);
  assert.equal(whole.bills, 1);
  assert.equal(whole.phase, "fill");
  assert.equal(whole.bottler!.fill, 0);
});
