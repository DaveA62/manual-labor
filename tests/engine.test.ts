import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshop, reducer } from '../src/game/engine.ts';
import { ECONOMY, MONEY_PRESS, slotPrice } from '../src/game/definitions.ts';
import { automated, createMachine, cycleDuration, direction, earningsPerMinute, fullyAutomated, machineStatus, newMachineId } from '../src/game/machines.ts';
import { advanceMachine, operate } from '../src/game/simulation.ts';
import { decodeSave } from '../src/game/save.ts';
import type { MachineInstance, ManualAction, UpgradeId, WorkshopState } from '../src/game/types.ts';
import { angleDelta, inPlate, inTray, validStamp } from '../src/game/gestures.ts';

const automation: UpgradeId[] = ['feeder', 'motor', 'collector', 'stamper'];
function full(id: string, printing = false): MachineInstance { return { ...createMachine(id), upgrades: [...automation, ...(printing ? ['printing' as const] : [])] }; }
function workshop(machines: MachineInstance[], cash = 0): WorkshopState {
  return { cash, lifetime: machines.reduce((sum, item) => sum + item.lifetime, 0) + cash, bills: machines.reduce((sum, item) => sum + item.bills, 0), machines: machines.map((m, i) => i === 0 ? { ...m, lifetime: m.lifetime + cash } : m), slots: [...machines.map(m => m.id), null] };
}
function print(state: WorkshopState, id = state.machines[0].id) {
  for (const action of [{ type: 'feed' }, { type: 'turn', amount: 1 }, { type: 'stamp' }, { type: 'turn', amount: 1 }, { type: 'collect' }] as ManualAction[]) state = reducer(state, { type: 'operate', machineId: id, action });
  return state;
}

test('new workshop has two unlocked slots and one free press', () => {
  const state = createWorkshop();
  assert.equal(state.slots.length, 2);
  assert.deepEqual(state.slots, [state.machines[0].id, null]);
  assert.equal(state.cash, 0);
});
test('manual cycle pays only once, alternates direction, and isolates other presses', () => {
  let state = workshop([createMachine('a'), createMachine('b')]);
  const other = state.machines[1];
  assert.equal(reducer(state, { type: 'operate', machineId: 'missing', action: { type: 'feed' } }), state);
  assert.equal(reducer(state, { type: 'operate', machineId: 'a', action: { type: 'collect' } }), state);
  state = print(state, 'a');
  assert.equal(state.cash, 5);
  assert.equal(state.lifetime, 5);
  assert.equal(state.machines[0].lifetime, 5);
  assert.equal(state.machines[1], other);
  assert.equal(direction(state.machines[0]), -1);
  assert.equal(direction(other), 1);
  assert.equal(reducer(state, { type: 'operate', machineId: 'a', action: { type: 'collect' } }), state);
  state = print(state, 'b');
  assert.equal(state.cash, 10);
  assert.equal(state.bills, 2);
});
test('partial crank progress and wrong-direction movement stay isolated and persist', () => {
  let state = workshop([createMachine('a'), createMachine('b')]);
  state = reducer(state, { type: 'operate', machineId: 'a', action: { type: 'feed' } });
  state = reducer(state, { type: 'operate', machineId: 'a', action: { type: 'turn', amount: 0.4 } });
  assert.equal(state.machines[0].progress, 0.4);
  const restored = decodeSave(JSON.stringify({ version: 2, ...state }))!;
  assert.equal(restored.machines[0].progress, 0.4);
  assert.equal(restored.machines[0].phase, 'raise');
  assert.equal(reducer(restored, { type: 'tick', elapsedMs: 60000 }), restored);
  state = reducer(state, { type: 'operate', machineId: 'a', action: { type: 'turn', amount: -1 } });
  assert.equal(state.machines[0].progress, 0);
  assert.equal(state.machines[1].phase, 'feed');
});
test('all 16 automation combinations pause at the first unowned step', () => {
  for (let mask = 0; mask < 16; mask++) {
    const machine = { ...createMachine('a'), upgrades: automation.filter((_, index) => mask & 1 << index) };
    assert.equal(fullyAutomated(machine), mask === 15);
    const advanced = advanceMachine(machine, cycleDuration(machine));
    if (mask === 15) assert.equal(advanced.bills, 1);
    else { assert.equal(automated(advanced), false); assert.equal(advanced.bills, 0); }
  }
});
test('partial automation carries time across steps and stops for a manual stamp', () => {
  const machine = { ...createMachine('a'), upgrades: ['feeder', 'motor', 'collector'] as UpgradeId[] };
  const advanced = advanceMachine(machine, 100000);
  assert.equal(advanced.phase, 'stamp');
  assert.equal(advanced.progress, 0);
  assert.equal(advanced.lifetime, 0);
  assert.equal(fullyAutomated(advanced), false);
  assert.equal(machineStatus(advanced), 'Needs Input');
  const stamped = operate(advanced, { type: 'stamp' });
  const next = advanceMachine(stamped, 20000);
  assert.equal(next.bills, 1);
  assert.equal(next.phase, 'stamp');
});
test('fully automated presses pay while another press remains at its manual step', () => {
  let state = workshop([full('a'), { ...createMachine('b'), phase: 'raise', progress: 0.37 }, full('c', true)]);
  const manual = state.machines[1];
  state = reducer(state, { type: 'tick', elapsedMs: cycleDuration(state.machines[0]) * 3 });
  assert.equal(state.cash, 45);
  assert.equal(state.lifetime, 45);
  assert.equal(state.bills, 6);
  assert.equal(state.machines[0].lifetime, 15);
  assert.equal(state.machines[2].lifetime, 30);
  assert.equal(state.machines[1], manual);
});
test('simulation is independent of tick subdivision and save/reload boundaries', () => {
  const original = full('a');
  const whole = advanceMachine(original, 8200);
  let split = original;
  for (let i = 0; i < 82; i++) split = advanceMachine(split, 100);
  assert.equal(split.bills, whole.bills);
  assert.equal(split.phase, whole.phase);
  assert.ok(Math.abs(split.progress - whole.progress) < 1e-9);
  const state = workshop([advanceMachine(original, 1234)]);
  const loaded = decodeSave(JSON.stringify({ version: 2, ...state }))!;
  assert.deepEqual(loaded, state);
  assert.equal(loaded.cash, state.cash); // Loading itself never simulates elapsed real-world time.
  const resumed = reducer(loaded, { type: 'tick', elapsedMs: cycleDuration(original) - 1234 });
  assert.equal(resumed.cash, 5);
  assert.equal(resumed.machines[0].bills, 1);
});
test('rearranging occupied or empty slots never changes machine data or production', () => {
  const original = workshop([advanceMachine(full('a'), 900), { ...createMachine('b'), phase: 'stamp' }]);
  const swapped = reducer(original, { type: 'move', machineId: 'a', to: 1 });
  assert.deepEqual(swapped.slots, ['b', 'a', null]);
  assert.equal(swapped.machines, original.machines);
  const moved = reducer(swapped, { type: 'move', machineId: 'a', to: 2 });
  assert.deepEqual(moved.slots, ['b', null, 'a']);
  assert.equal(moved.machines, original.machines);
  assert.deepEqual(reducer(moved, { type: 'tick', elapsedMs: 4000 }).machines, reducer(original, { type: 'tick', elapsedMs: 4000 }).machines);
  assert.equal(reducer(original, { type: 'move', machineId: 'a', to: 100 }), original);
  assert.equal(reducer(original, { type: 'move', machineId: 'a', to: NaN }), original);
});
test('machine purchases enforce funds, capacity, and distinct persistent IDs', () => {
  let state = workshop([createMachine('a')], 200);
  state = reducer(state, { type: 'buy-machine', machineType: 'money-press', id: 'b' });
  assert.equal(state.cash, 200 - MONEY_PRESS.price);
  assert.deepEqual(state.slots, ['a', 'b']);
  assert.equal(state.machines[1].upgrades.length, 0);
  assert.equal(reducer(state, { type: 'buy-machine', machineType: 'money-press', id: 'c' }), state);
  state = reducer(state, { type: 'buy-slot' });
  assert.equal(state.slots.length, 3);
  assert.equal(reducer(state, { type: 'buy-machine', machineType: 'money-press', id: 'b' }), state);
  state = reducer(state, { type: 'buy-machine', machineType: 'money-press', id: 'c' });
  assert.equal(state.machines.length, 3);
  assert.equal(state.cash, 50);
  assert.equal(reducer(createWorkshop(), { type: 'buy-machine', machineType: 'money-press', id: 'b' }).machines.length, 1);
});
test('slot prices escalate from configurable starting capacity', () => {
  assert.equal(slotPrice(ECONOMY.startingSlots), ECONOMY.slotBasePrice);
  assert.ok(slotPrice(3) > slotPrice(2));
  assert.ok(slotPrice(4) > slotPrice(3));
  assert.equal(reducer(createWorkshop(), { type: 'buy-slot' }).slots.length, 2);
});
test('an upgrade affects only its target and cannot be bought twice', () => {
  let state = workshop([createMachine('a'), createMachine('b')], 500);
  const other = state.machines[1];
  state = reducer(state, { type: 'buy-upgrade', machineId: 'a', upgradeId: 'printing' });
  assert.equal(state.cash, 350);
  assert.equal(state.machines[1], other);
  assert.equal(reducer(state, { type: 'buy-upgrade', machineId: 'a', upgradeId: 'printing' }), state);
  state = print(state, 'a');
  state = print(state, 'b');
  assert.equal(state.cash, 365);
  assert.deepEqual([state.machines[0].bills, state.machines[1].bills], [1, 1]);
});
test('automation ignores duplicate manual actions and activates at the current partial progress', () => {
  const initial = workshop([{ ...createMachine('a'), phase: 'raise', progress: 0.5 }], 100);
  const bought = reducer(initial, { type: 'buy-upgrade', machineId: 'a', upgradeId: 'motor' });
  assert.equal(reducer(bought, { type: 'operate', machineId: 'a', action: { type: 'turn', amount: 1 } }), bought);
  const advanced = reducer(bought, { type: 'tick', elapsedMs: 550 });
  assert.equal(advanced.machines[0].phase, 'stamp');
  assert.equal(advanced.machines[0].progress, 0);
});
test('legacy migration preserves all money, statistics and upgrades exactly once', () => {
  const migrated = decodeSave(JSON.stringify({ version: 1, cash: 45, lifetime: 320, bills: 64, upgrades: ['feeder', 'motor', 'printing'] }))!;
  assert.equal(migrated.cash, 45);
  assert.equal(migrated.lifetime, 320);
  assert.equal(migrated.bills, 64);
  assert.equal(migrated.slots.length, 2);
  assert.equal(migrated.machines[0].id, 'press-legacy');
  assert.equal(migrated.machines[0].lifetime, 320);
  assert.deepEqual(migrated.machines[0].upgrades, ['feeder', 'motor', 'printing']);
  assert.deepEqual(decodeSave(JSON.stringify({ version: 2, ...migrated })), migrated);
});
test('invalid save graphs, phases, duplicate IDs and nonfinite progress are rejected', () => {
  const valid = { version: 2, ...workshop([createMachine('a'), createMachine('b')]) };
  for (const data of [
    { ...valid, slots: ['a', 'a'] }, { ...valid, slots: ['a', null] }, { ...valid, slots: ['a', 'missing'] },
    { ...valid, machines: [createMachine('a'), createMachine('a')] },
    { ...valid, machines: [{ ...createMachine('a'), phase: 'unknown' }, createMachine('b')] },
    { ...valid, machines: [{ ...createMachine('a'), progress: 1 }, createMachine('b')] },
    { ...valid, machines: [{ ...createMachine('a'), type: '__proto__' }, createMachine('b')] },
    { ...valid, cash: -1 }, { ...valid, lifetime: 4 }, { ...valid, bills: 1 },
  ]) assert.equal(decodeSave(JSON.stringify(data)), null);
  for (const raw of [null, 'nope', '{}', 'null']) assert.equal(decodeSave(raw), null);
  const { version, ...expected } = valid;
  assert.deepEqual(decodeSave(JSON.stringify(valid)), expected);
});
test('statuses and rate estimates reflect actual per-instance automation and timing', () => {
  assert.equal(machineStatus(createMachine('a')), 'Needs Input');
  assert.equal(machineStatus({ ...createMachine('a'), upgrades: ['feeder'] }), 'Running');
  assert.equal(machineStatus(full('a')), 'Fully Automated');
  assert.equal(earningsPerMinute(createMachine('a')), 0);
  assert.equal(earningsPerMinute(full('a', true)), 2 * earningsPerMinute(full('a')));
  assert.equal(earningsPerMinute(full('a')), 5 * 60000 / 3950);
});
test('invalid simulation time or crank motion cannot change state, and reset restores the starter', () => {
  const manual = { ...createMachine('a'), phase: 'raise' as const };
  assert.equal(operate(manual, { type: 'turn', amount: NaN }), manual);
  for (const elapsed of [0, -1, NaN, Infinity]) { const machine = full('a'); assert.equal(advanceMachine(machine, elapsed), machine); }
  assert.deepEqual(reducer(workshop([full('a'), full('b')], 200), { type: 'reset' }), createWorkshop());
});
test('existing gesture direction, drop targets, and stamp validation remain intact', () => {
  assert.ok(Math.abs(angleDelta(3.1, -3.1) - 0.083185307) < 0.0001);
  assert.ok(angleDelta(-3.1, 3.1) < 0);
  assert.equal(validStamp(110, 0.4), true);
  assert.equal(validStamp(30, 1), false);
  assert.equal(validStamp(120, 0.1), false);
  assert.equal(inPlate(350, 382), true);
  assert.equal(inPlate(70, 380), false);
  assert.equal(inTray(615, 410), true);
});


test('central simulation supports many independent presses without duplicate IDs or payouts', () => {
  const ids = Array.from({ length: 100 }, () => newMachineId());
  assert.equal(new Set(ids).size, 100);
  const state = workshop(ids.map(id => full(id)));
  const advanced = reducer(state, { type: 'tick', elapsedMs: 3950 });
  assert.equal(advanced.cash, 500);
  assert.equal(advanced.bills, 100);
  assert.ok(advanced.machines.every(machine => machine.lifetime === 5 && machine.bills === 1));
});
