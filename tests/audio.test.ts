import test from 'node:test';
import assert from 'node:assert/strict';
import {audioDiagnostics,feedback,machineAudio,silence,unlockAudio,setAudioVolume} from '../src/platform/browserFeedback.ts';
import {FEEL} from '../src/config/feedback.ts';

// A small Web Audio host double checks lifecycle/budgets, not the audible timbre.
class Param { value=0; setTargetAtTime(v:number){this.value=v;} setValueAtTime(v:number){this.value=v;} exponentialRampToValueAtTime(v:number){this.value=v;} cancelScheduledValues(){} }
class Node { gain=new Param(); frequency=new Param(); playbackRate=new Param(); threshold=new Param(); knee=new Param(); ratio=new Param(); attack=new Param(); release=new Param(); type=''; buffer:unknown; loop=false; onended:(()=>void)|null=null; stopped=false; disconnected=false; connect(node:unknown){return node;} disconnect(){this.disconnected=true;} start(){} stop(){this.stopped=true;} finish(){this.onended?.();} }
class Oscillator extends Node {}
class Context { static instances:Context[]=[]; nodes:Node[]=[]; state='running'; currentTime=0; sampleRate=1000; destination=new Node(); constructor(){Context.instances.push(this);} add<T extends Node>(node:T){this.nodes.push(node);return node;} createGain(){return this.add(new Node());} createDynamicsCompressor(){return this.add(new Node());} createBiquadFilter(){return this.add(new Node());} createOscillator(){return this.add(new Oscillator());} createBufferSource(){return this.add(new Node());} createBuffer(){return {getChannelData:()=>new Float32Array(500)};} async resume(){this.state='running';} async close(){this.state='closed';} }

test('audio unlocks on input, reuses one foreground engine, bounds voices, and disposes on mute',()=>{
 const names=['AudioContext','OscillatorNode','document'] as const;
 const before=names.map(name=>Object.getOwnPropertyDescriptor(globalThis,name));
 try {
  Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:Context});
  Object.defineProperty(globalThis,'OscillatorNode',{configurable:true,value:Oscillator});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{visibilityState:'visible'}});
  feedback('glass',true);assert.equal(Context.instances.length,0);
  machineAudio({kind:'bottler',action:'flow',intensity:.4},true);assert.equal(Context.instances.length,0);
  unlockAudio();assert.equal(Context.instances.length,1);assert.equal(audioDiagnostics().voices,3);
  for(let i=0;i<200;i++)machineAudio({kind:'bottler',action:'flow',intensity:i/200},true);
  assert.equal(audioDiagnostics().voices,3);assert.equal(Context.instances.length,1);
  machineAudio({kind:'press',action:'lift',intensity:.6},true);
  assert.equal(audioDiagnostics().voices,6);
  for(const node of Context.instances[0].nodes)if(node.stopped)node.finish();
  assert.equal(audioDiagnostics().voices,3);
  for(const kind of ['stamp','seal','cash','paper','ratchet','collect','buy','ui','switch','valve','slide','latch','release','pickup'] as const)feedback(kind,true);
  assert.ok(audioDiagnostics().voices<=FEEL.audio.maxVoices);
  machineAudio({kind:'bottler',action:'cap',intensity:1},true);
  assert.ok(audioDiagnostics().voices<=FEEL.audio.maxVoices,'phase crossfades respect the same budget');
  setAudioVolume(9);assert.equal(audioDiagnostics().volume,1);
  machineAudio(null,false);assert.equal(audioDiagnostics().loop,null);
  silence();assert.equal(audioDiagnostics().voices,0);assert.equal(Context.instances[0].state,'closed');
  for(const node of Context.instances[0].nodes)if(node.stopped)node.finish();
  assert.equal(audioDiagnostics().voices,0);
 } finally {silence();names.forEach((name,i)=>{if(before[i])Object.defineProperty(globalThis,name,before[i]!);else Reflect.deleteProperty(globalThis,name);});}
});
