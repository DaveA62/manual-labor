import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshop, reducer } from '../src/game/engine.ts';
import { MONEY_PRESS } from '../src/game/definitions.ts';
import { canRefit, createMachine, cycleDuration, earnings, earningsPerMinute, fullyAutomated, upgradePrice } from '../src/game/machines.ts';
import { advanceMachine, operate } from '../src/game/simulation.ts';
import { decodeSave, SAVE_KEY, writeSave } from '../src/game/save.ts';
import type { MachineInstance, UpgradeId, WorkshopState } from '../src/game/types.ts';

const required: UpgradeId[] = ['feeder', 'motor', 'collector', 'stamper'];
function workshop(machine: MachineInstance, cash: number): WorkshopState {
  const other = { ...createMachine('b'), phase: 'raise' as const, progress: 0.42 };
  return { cash, lifetime: machine.lifetime, bills: machine.bills, machines: [machine, other], slots: ['b', null, machine.id] };
}
function ready(tier = 'cash'): MachineInstance {
  return { ...createMachine('a'), tier, upgrades: [...required, 'printing'], phase: 'collect', progress: 0.6, lifetime: 10000, bills: 300 };
}

test('refit isolates one instance and preserves identity, slot, and all lifetime statistics', () => {
  for (const [fromTier, toTier, fee] of [['cash', 'silver', 750], ['silver', 'gold', 4000]] as const) {
    const original = workshop(ready(fromTier), 5000);
    const state = reducer(original, { type: 'refit', machineId: 'a', fromTier });
    assert.equal(state.cash, 5000 - fee);
    assert.equal(state.lifetime, original.lifetime);
    assert.equal(state.bills, original.bills);
    assert.equal(state.slots, original.slots);
    assert.deepEqual(state.machines[0], { ...original.machines[0], tier: toTier, upgrades: [], phase: 'feed', progress: 0 });
    assert.equal(state.machines[1], original.machines[1]);
    assert.equal(state.machines[0].id, 'a');
    assert.equal(fullyAutomated(state.machines[0]), false);
    assert.equal(reducer(state, { type: 'tick', elapsedMs: 100000 }), state);
  }
});

test('each automation requirement and exact fee are enforced; printing stays optional', () => {
  for (const [tier, fee] of [['cash', 750], ['silver', 4000]] as const) {
    for (const missing of required) {
      const state = workshop({ ...ready(tier), upgrades: required.filter(id => id !== missing) }, fee);
      assert.equal(canRefit(state.machines[0], fee), false);
      assert.equal(reducer(state, { type: 'refit', machineId: 'a', fromTier: tier }), state);
    }
    const insufficient = workshop(ready(tier), fee - 1);
    assert.equal(reducer(insufficient, { type: 'refit', machineId: 'a', fromTier: tier }), insufficient);
    const exact = workshop({ ...ready(tier), upgrades: required }, fee);
    assert.equal(canRefit(exact.machines[0], fee), true);
    assert.equal(reducer(exact, { type: 'refit', machineId: 'a', fromTier: tier }).cash, 0);
  }
});

test('stale or repeated confirmations never charge twice, even after upgrades are reinstalled', () => {
  const action = { type: 'refit', machineId: 'a', fromTier: 'cash' } as const;
  const original = workshop(ready(), 10000);
  const refitted = reducer(original, action);
  assert.equal(reducer(refitted, action), refitted);
  let reinstalled = refitted;
  for (const upgradeId of required) reinstalled = reducer(reinstalled, { type: 'buy-upgrade', machineId: 'a', upgradeId });
  assert.equal(canRefit(reinstalled.machines[0], reinstalled.cash), true);
  assert.equal(reducer(reinstalled, action), reinstalled);
  assert.equal(reducer(reinstalled, { ...action, machineId: 'missing' }), reinstalled);
  const max = workshop(ready('gold'), 10000);
  assert.equal(canRefit(max.machines[0], max.cash), false);
  assert.equal(reducer(max, { ...action, fromTier: 'gold' }), max);
});

test('all tier prices are charged by the reducer, without affecting other instances', () => {
  for (const [tier, multiplier] of [['cash', 1], ['silver', 3], ['gold', 9]] as const) {
    for (const upgrade of MONEY_PRESS.upgrades) {
      const machine = { ...createMachine('a'), tier, lifetime: 10000 };
      const price = upgrade.cost * multiplier;
      assert.equal(upgradePrice(machine, upgrade.id), price);
      const poor = workshop(machine, price - 1);
      const action = { type: 'buy-upgrade', machineId: 'a', upgradeId: upgrade.id } as const;
      assert.equal(reducer(poor, action), poor);
      const original = workshop(machine, price);
      const bought = reducer(original, action);
      assert.equal(bought.cash, 0);
      assert.deepEqual(bought.machines[0].upgrades, [upgrade.id]);
      assert.equal(bought.machines[1], original.machines[1]);
      assert.equal(reducer(bought, action), bought);
    }
  }
});

test('tiers preserve manual phases and pay correct output, including optional printing', () => {
  for (const [tier, value] of [['cash', 5], ['silver', 20], ['gold', 75]] as const) {
    for (const printing of [false, true]) {
      let machine = { ...createMachine('a'), tier, upgrades: printing ? ['printing' as const] : [] };
      const payout = value * (printing ? 2 : 1);
      for (const action of [{ type: 'feed' }, { type: 'turn', amount: 1 }, { type: 'stamp' }, { type: 'turn', amount: 1 }] as const) machine = operate(machine, action);
      assert.equal(machine.lifetime, 0);
      assert.equal(machine.phase, 'collect');
      assert.equal(earnings(machine), payout);
      machine = operate(machine, { type: 'collect' });
      assert.equal(machine.phase, 'feed');
      assert.equal(machine.bills, 1);
      assert.equal(machine.lifetime, payout);
      const automatic = { ...machine, upgrades: [...required, ...(printing ? ['printing' as const] : [])] };
      const produced = advanceMachine(automatic, cycleDuration(automatic) * 3);
      assert.equal(produced.lifetime - machine.lifetime, payout * 3);
      assert.equal(earningsPerMinute(automatic), payout * 60000 / cycleDuration(automatic));
    }
  }
});

test('refitting a working press keeps other background machines producing at their own tier', () => {
  const original = workshop(ready('cash'), 1000);
  original.machines[1] = { ...ready('gold'), id: 'b', phase: 'feed', progress: 0, lifetime: 0, bills: 0 };
  const state = reducer(reducer(original, { type: 'refit', machineId: 'a', fromTier: 'cash' }), { type: 'tick', elapsedMs: cycleDuration(original.machines[1]) });
  assert.equal(state.cash, 400); // 1000 - 750 + 150.
  assert.equal(state.machines[0].tier, 'silver');
  assert.equal(state.machines[0].phase, 'feed');
  assert.equal(state.machines[0].lifetime, 10000);
  assert.equal(state.machines[1].lifetime, 150);
});

test('v2 saves without tier migrate to Cash without changing upgrades, order, or progress', () => {
  const original = workshop(ready(), 500);
  const old = { version: 2, ...original, machines: original.machines.map(({ tier: _tier, ...machine }) => machine) };
  assert.deepEqual(decodeSave(JSON.stringify(old)), original);
  const v1 = decodeSave(JSON.stringify({ version: 1, cash: 20, lifetime: 100, bills: 20, upgrades: ['motor'] }))!;
  assert.equal(v1.machines[0].tier, 'cash');
  assert.deepEqual(v1.machines[0].upgrades, ['motor']);
});

test('v3 saves round trip mixed tiers and reject unknown or missing tier IDs', () => {
  const state = workshop(ready('gold'), 500);
  state.machines[1].tier = 'silver';
  assert.deepEqual(decodeSave(JSON.stringify({ version: 3, ...state })), state);
  for (const tier of ['platinum', 'toString', 1, null, undefined]) {
    const invalid = { version: 3, ...state, machines: [{ ...state.machines[0], tier }, state.machines[1]] };
    assert.equal(decodeSave(JSON.stringify(invalid)), null);
  }
  let savedKey = '', raw = '';
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem(key: string, value: string) { savedKey = key; raw = value; } } });
  try {
    assert.equal(writeSave(state), true);
    assert.equal(savedKey, SAVE_KEY);
    assert.equal(JSON.parse(raw).version, 3);
    assert.deepEqual(decodeSave(raw), state);
  } finally { Reflect.deleteProperty(globalThis, 'localStorage'); }
  assert.equal(createWorkshop().machines[0].tier, 'cash');
});
