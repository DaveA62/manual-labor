import test from 'node:test';
import assert from 'node:assert/strict';
import { createMachineRuntime } from '../src/runtime/machine.ts';
import { createProductionClock } from '../src/runtime/clock.ts';
import { activePressPart, pressHeadTarget } from '../src/runtime/press.ts';
import { createWorkshop, reducer } from '../src/game/engine.ts';
import { createMachine, cycleDuration } from '../src/game/machines.ts';
import { readSave, writeSave, clearLegacySave, LEGACY_SAVE_KEY } from '../src/game/save.ts';
import type { GamePlatform, SaveStorage } from '../src/platform/contracts.ts';
import type { WorkshopAction } from '../src/game/types.ts';

function storage(): SaveStorage {
  const data = new Map<string, string>();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } };
}
test('renderer bridge scopes actions to one instance and feedback never produces money', () => {
  let state = createWorkshop();
  state.machines.push(createMachine('other')); state.slots[1] = 'other';
  const untouched = state.machines[0], effects: string[] = [], actions: WorkshopAction[] = [];
  const runtime = createMachineRuntime('other', () => state.machines[1], action => { actions.push(action); state = reducer(state, action); }, kind => effects.push(kind), text => effects.push(text));
  runtime.feedback('cash'); runtime.feedback('stamp'); runtime.hint('Load');
  assert.equal(state.cash, 0); assert.deepEqual(effects, ['cash', 'stamp', 'Load']);
  runtime.act({ type: 'feed' }); runtime.act({ type: 'turn', amount: 1 }); runtime.act({ type: 'stamp' }); runtime.act({ type: 'turn', amount: 1 }); runtime.act({ type: 'collect' });
  assert.equal(state.cash, 5); assert.equal(state.machines[0], untouched);
  assert.equal(runtime.read(), state.machines[1]);
  assert.ok(actions.every(action => action.type === 'operate' && action.machineId === 'other'));
  runtime.act({ type: 'collect' }); assert.equal(state.cash, 5);
});
test('renderer projection preserves every manual action and automated head travel', () => {
  const machine = createMachine('a');
  for (const [phase, part, y] of [['feed','paper',340], ['raise','crank',274], ['stamp','head',208], ['lift','crank',274], ['collect','bill',208]] as const) {
    assert.equal(activePressPart({ ...machine, phase, progress: .5 }), part);
    assert.equal(pressHeadTarget({ ...machine, phase, progress: .5 }), y);
  }
  const automatic = { ...machine, phase: 'stamp' as const, progress: .5, upgrades: ['stamper' as const] };
  assert.equal(activePressPart(automatic), null); assert.equal(pressHeadTarget(automatic), 274);
});
test('injected storage retains v3 prestige, progress, and legacy migration without browser globals', () => {
  const memory = storage(), original = createWorkshop();
  original.machines[0] = { ...original.machines[0], tier: 'gold', phase: 'raise', progress: .36, upgrades: ['motor'] };
  assert.equal(writeSave(original, memory), true); assert.deepEqual(readSave(memory), original);
  const old = storage(); old.setItem(LEGACY_SAVE_KEY, JSON.stringify({ version: 1, cash: 10, lifetime: 20, bills: 4, upgrades: ['feeder'] }));
  assert.equal(readSave(old).machines[0].tier, 'cash'); assert.equal(readSave(old).cash, 10);
  clearLegacySave(old); assert.equal(old.getItem(LEGACY_SAVE_KEY), null);
  const blocked = { getItem() { throw Error('Unavailable'); }, setItem() { throw Error('Unavailable'); }, removeItem() { throw Error('Unavailable'); } };
  assert.deepEqual(readSave(blocked), createWorkshop()); assert.equal(writeSave(original, blocked), false);
  assert.doesNotThrow(() => clearLegacySave(blocked));
});
test('host suspension flush boundary cannot earn offline time or duplicate production after resume', () => {
  let now = 0, active = true;
  const listeners = new Set<(value: boolean) => void>();
  const lifecycle: GamePlatform['lifecycle'] = { now: () => now, isActive: () => active, subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; } };
  let state = createWorkshop();
  state.machines[0].upgrades = ['feeder','motor','collector','stamper'];
  const clock = createProductionClock(lifecycle, elapsedMs => { state = reducer(state, { type: 'tick', elapsedMs }); });
  const before = state;
  active = false; listeners.forEach(listener => listener(false)); now = 100000; clock.advance();
  assert.equal(state, before);
  active = true; listeners.forEach(listener => listener(true)); clock.advance(); assert.equal(state, before);
  const duration = cycleDuration(state.machines[0]);
  for (let i = 0; i < duration / 50; i++) { now += 50; clock.advance(); }
  assert.equal(state.cash, 5); assert.equal(state.bills, 1);
  clock.dispose(); assert.equal(listeners.size, 0);
});
