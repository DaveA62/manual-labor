import test from 'node:test';
import assert from 'node:assert/strict';
import { automated, createGame, direction, earnings, reducer, UPGRADES } from '../src/game/engine.ts';
import type { GameState, UpgradeId } from '../src/game/engine.ts';
import { decodeSave } from '../src/game/save.ts';
import { angleDelta, inPlate, inTray, validStamp } from '../src/game/gestures.ts';

function print(state: GameState) {
  for (const action of [{ type: 'feed' }, { type: 'turn', amount: 1 }, { type: 'stamp' }, { type: 'turn', amount: 1 }, { type: 'collect' }] as const) state = reducer(state, action);
  return state;
}
test('only a full production cycle pays; collection is idempotent', () => {
  let state = createGame();
  assert.equal(reducer(state, { type: 'collect' }), state);
  assert.equal(reducer(state, { type: 'stamp' }), state);
  state = reducer(state, { type: 'feed' });
  assert.equal(state.phase, 'raise');
  state = reducer(state, { type: 'turn', amount: 0.4 });
  assert.equal(state.phase, 'raise');
  state = reducer(state, { type: 'turn', amount: -1 });
  assert.equal(state.progress, 0);
  state = reducer(state, { type: 'turn', amount: 1 });
  assert.equal(state.phase, 'stamp');
  assert.equal(reducer(state, { type: 'turn', amount: 1 }), state);
  state = reducer(state, { type: 'stamp' });
  assert.equal(state.phase, 'lift');
  assert.equal(state.cash, 0);
  assert.equal(reducer(state, { type: 'collect' }), state);
  state = reducer(state, { type: 'turn', amount: 1 });
  assert.equal(state.phase, 'collect');
  state = reducer(state, { type: 'collect' });
  assert.deepEqual([state.cash, state.lifetime, state.bills, direction(state)], [5, 5, 1, -1]);
  assert.equal(reducer(state, { type: 'collect' }), state);
  state = print(state);
  assert.deepEqual([state.cash, state.lifetime, state.bills, direction(state)], [10, 10, 2, 1]);
});
test('upgrades have exact costs, cannot be rebought, and printing doubles payout', () => {
  let state = createGame();
  assert.equal(reducer(state, { type: 'buy', id: 'feeder' }), state);
  for (let i = 0; i < 3; i++) state = print(state);
  state = reducer(state, { type: 'buy', id: 'feeder' });
  assert.equal(state.cash, 0);
  assert.equal(state.lifetime, 15);
  assert.equal(reducer(state, { type: 'buy', id: 'feeder' }), state);
  state = createGame({ cash: 275, lifetime: 275, bills: 55, upgrades: [] });
  for (const upgrade of UPGRADES) state = reducer(state, { type: 'buy', id: upgrade.id });
  assert.equal(state.cash, 0);
  assert.equal(earnings(state), 10);
  state = print(state);
  assert.deepEqual([state.cash, state.lifetime, state.bills], [10, 285, 56]);
});
test('all eight automation combinations preserve manual stamping and unowned actions', () => {
  for (let mask = 0; mask < 8; mask++) {
    const upgrades = (['feeder', 'motor', 'collector'] as UpgradeId[]).filter((_, index) => mask & (1 << index));
    let state = createGame({ cash: 0, lifetime: 0, bills: 0, upgrades });
    assert.equal(automated(state), upgrades.includes('feeder'));
    state = reducer(state, { type: 'feed' });
    assert.equal(automated(state), upgrades.includes('motor'));
    state = reducer(state, { type: 'turn', amount: 1 });
    assert.equal(automated(state), false);
    state = reducer(state, { type: 'stamp' });
    assert.equal(automated(state), upgrades.includes('motor'));
    state = reducer(state, { type: 'turn', amount: 1 });
    assert.equal(automated(state), upgrades.includes('collector'));
    state = reducer(state, { type: 'collect' });
    assert.equal(state.cash, 5);
  }
});
test('invalid motion cannot corrupt state; reset removes all upgrades', () => {
  let state = reducer(createGame(), { type: 'feed' });
  assert.equal(reducer(state, { type: 'turn', amount: NaN }), state);
  assert.equal(reducer(state, { type: 'turn', amount: Infinity }), state);
  state = createGame({ cash: 900, lifetime: 1000, bills: 200, upgrades: ['printing'] });
  assert.deepEqual(reducer(state, { type: 'reset' }), createGame());
});
test('saves validate version, finite integer balances, and known upgrade IDs', () => {
  for (const bad of [null, 'nope', '{}', JSON.stringify({ version: 1, cash: -5, lifetime: 0, bills: 0, upgrades: [] }), JSON.stringify({ version: 1, cash: 50, lifetime: 10, bills: 2, upgrades: [] })]) assert.deepEqual(decodeSave(bad), { cash: 0, lifetime: 0, bills: 0, upgrades: [] });
  const save = decodeSave(JSON.stringify({ version: 1, cash: 15, lifetime: 100, bills: 20, upgrades: ['motor', 'motor', 'free-money'] }));
  assert.deepEqual(save.upgrades, ['motor']);
  assert.equal(createGame(save).phase, 'feed');
  assert.equal(createGame(save).cash, 15);
});
test('gesture math crosses the angle seam in both directions; stamps need speed AND travel', () => {
  assert.ok(Math.abs(angleDelta(3.1, -3.1) - 0.083185307) < 0.0001);
  assert.ok(angleDelta(-3.1, 3.1) < 0);
  assert.equal(validStamp(110, 0.4), true);
  assert.equal(validStamp(30, 1), false);
  assert.equal(validStamp(120, 0.1), false);
  assert.equal(inPlate(350, 382), true);
  assert.equal(inPlate(70, 380), false);
  assert.equal(inTray(615, 410), true);
});
