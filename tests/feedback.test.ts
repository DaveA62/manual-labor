import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiquid,stepLiquid,surfacePaths} from '../src/presentation/liquid.ts';
import {soundLayers} from '../src/platform/soundDesign.ts';
import {FEEL} from '../src/config/feedback.ts';
import {createMachineRuntime} from '../src/runtime/machine.ts';
import {createMachine} from '../src/game/machines.ts';
test('liquid preserves its mean fill level, stays bounded under harsh motion, and settles at rest',()=>{
 let state=createLiquid();const initial=structuredClone(state);
 const driven=stepLiquid(state,1/60,1,1);assert.deepEqual(state,initial);assert.notEqual(driven.tiltVelocity,0);
 let flowing=createLiquid();for(let i=0;i<120;i++)flowing=stepLiquid(flowing,1/60,0,.34);
 assert.ok(Math.max(...flowing.heights)-Math.min(...flowing.heights)>.4,'flow should make a visible ripple');
 assert.equal(surfacePaths(flowing,56,90,0).surface,surfacePaths(createLiquid(),56,90,0).surface,'empty vessels show no phantom water');
 for(let i=0;i<3000;i++){state=stepLiquid(state,i%5===0?1:1/120,i%3===0?100:-100,1);assert.ok(Math.abs(state.heights.reduce((n,h)=>n+h,0))<1e-8);assert.ok(state.heights.every(h=>Number.isFinite(h)&&Math.abs(h)<=2*FEEL.liquid.maxWave));assert.ok(Math.abs(state.tilt)<=FEEL.liquid.maxTilt);}
 for(let i=0;i<1800;i++)state=stepLiquid(state,1/60,0,0);
 assert.ok(Math.abs(state.tilt)<.001);assert.ok(state.heights.every(h=>Math.abs(h)<.001));
 const flat=surfacePaths(createLiquid(),56,90,.97);assert.ok(flat.surface.startsWith('M-28 -87.3'));assert.ok(!flat.volume.includes('NaN'));
});
test('surface motion tolerates suspension and normal frame rates without growing or changing liquid quantity',()=>{
 const sample=(rate:number)=>{let s=createLiquid();s=stepLiquid(s,1/rate,1,0);for(let i=1;i<rate;i++)s=stepLiquid(s,1/rate,0,0);return s;};
 const a=sample(60),b=sample(120);assert.ok(Math.abs(a.tilt-b.tilt)<.1);
 const bad=stepLiquid(createLiquid(),Infinity,NaN,NaN);assert.ok(bad.heights.every(Number.isFinite));
 for(const fill of [0,.85,.95,1,1.25])assert.equal(surfacePaths(createLiquid(),56,90,fill).surface.includes('NaN'),false);
});
test('material sound plans are finite, bounded, and distinguish metal, paper, water controls and glass',()=>{
 const kinds=['ui','hover','switch','click','ratchet','paper','glass','valve','slide','latch','release','stamp','seal','collect','cash','buy','pickup','reject','continuum','reveal'] as const;
 for(const kind of kinds)for(const variation of [-1,0,1]){
  const layers=soundLayers(kind,variation);assert.ok(layers.length>0&&layers.length<FEEL.audio.maxVoices);assert.ok(layers.reduce((n,l)=>n+l.gain,0)<.5);
  for(const l of layers){assert.ok(l.duration>0&&l.duration<=2);assert.ok(l.frequency>0&&Number.isFinite(l.frequency));assert.ok(l.endFrequency>0);assert.ok((l.attack??.003)<l.duration);assert.ok(l.gain>0&&l.gain<.2);}
 }
 assert.ok(soundLayers('paper').every(l=>l.wave==='noise'));
 assert.ok(soundLayers('glass').some(l=>l.frequency>2000));
 assert.ok(soundLayers('stamp').some(l=>l.frequency<120));
 assert.notDeepEqual(soundLayers('valve'),soundLayers('ratchet'));
});
test('expanded renderer feedback cannot dispatch production actions or change a machine',()=>{
 const machine=createMachine('feel-test'),snapshot=structuredClone(machine),actions:unknown[]=[],sounds:unknown[]=[];
 const runtime=createMachineRuntime(machine.id,()=>machine,a=>actions.push(a),s=>sounds.push(s),()=>{});
 for(const kind of ['paper','valve','slide','stamp','seal','collect','ratchet'] as const)runtime.feedback(kind);
 assert.deepEqual(machine,snapshot);assert.equal(actions.length,0);assert.equal(sounds.length,7);
});
