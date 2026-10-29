import test from 'node:test';
import assert from 'node:assert/strict';
import { recentDownSpeed, resistedHeadTravel, validStamp } from '../src/game/gestures.ts';
test('a paused fast drag cannot bank enough velocity for a later slow stamp',()=>{
  const fast=recentDownSpeed(0,40,50);
  const paused=recentDownSpeed(fast,0,500);
  const slow=recentDownSpeed(paused,10,100);
  assert.ok(validStamp(120,fast));
  assert.equal(validStamp(120,slow),false);
});
test('head resistance is bounded to guide travel and preserves a decisive fast stamp',()=>{
  assert.equal(resistedHeadTravel(-30),0);
  assert.equal(resistedHeadTravel(1000),132);
  assert.ok(resistedHeadTravel(80)<80);
  assert.equal(validStamp(resistedHeadTravel(120),.7),true);
});
