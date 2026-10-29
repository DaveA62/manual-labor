import type { FeedbackKind, MachineVoice } from "./contracts.ts";
import { soundLayers } from "./soundDesign.ts";
import { FEEL } from "../config/feedback.ts";
let context: AudioContext | undefined,
  master: GainNode | undefined,
  noiseBuffer: AudioBuffer | undefined,
  volume = FEEL.audio.defaultVolume as number,
  unlocked = false;
const voices = new Set<AudioScheduledSourceNode>(),
  last = new Map<string, number>();
let loop:
    | {
        key: string;
        gain: GainNode;
        filter: BiquadFilterNode;
        motor: OscillatorNode;
        wobble: OscillatorNode;
        noise: AudioBufferSourceNode;
      }
    | undefined,
  requested: MachineVoice | null = null;
function setup() {
  if (!unlocked) return null;
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = volume * 0.72;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 12;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.15;
    master.connect(limiter).connect(context.destination);
    noiseBuffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * 0.5),
      context.sampleRate,
    );
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  if (context.state === "suspended") void context.resume().catch(() => {});
  return context;
}
export function unlockAudio() {
  unlocked = true;
  try {
    setup();
    if (requested) machineAudio(requested, true);
  } catch {
    /* Audio support is optional. */
  }
}
export function setAudioVolume(value: number) {
  volume = Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : FEEL.audio.defaultVolume;
  try {
    master?.gain.setTargetAtTime(volume * 0.72, context!.currentTime, 0.025);
  } catch {}
}
function track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
  voices.add(source);
  source.onended = () => {
    voices.delete(source);
    for (const node of nodes) node.disconnect();
  };
}
function stopLoop() {
  if (!loop || !context) return;
  const old = loop;
  loop = undefined;
  const now = context.currentTime;
  old.gain.gain.cancelScheduledValues(now);
  const fade = FEEL.audio.loopFadeMs / 1000;
  old.gain.gain.setTargetAtTime(0, now, fade / 3);
  try {
    old.motor.stop(now + fade * 2);
    old.wobble.stop(now + fade * 2);
    old.noise.stop(now + fade * 2);
  } catch {}
}
export function silence() {
  requested = null;
  loop = undefined;
  for (const v of voices) {
    try {
      v.stop();
    } catch {}
  }
  voices.clear();
  const old = context;
  context = undefined;
  master = undefined;
  noiseBuffer = undefined;
  if (old) void old.close().catch(() => {});
}
export function machineAudio(voice: MachineVoice | null, sound: boolean) {
  requested = sound ? voice : null;
  try {
    if (
      !sound ||
      !voice ||
      !unlocked ||
      document.visibilityState === "hidden"
    ) {
      stopLoop();
      return;
    }
    const c = setup();
    if (!c || !master || !noiseBuffer) return;
    const intensity = Math.max(0, Math.min(1, voice.intensity)),
      key = voice.kind + ":" + voice.action;
    if (loop?.key !== key) {
      stopLoop();
      if (voices.size + 3 > FEEL.audio.maxVoices) return;
      const gain = c.createGain(),
        filter = c.createBiquadFilter(),
        motor = c.createOscillator(),
        wobble = c.createOscillator(),
        noise = c.createBufferSource();
      gain.gain.value = 0;
      filter.type = "lowpass";
      noise.buffer = noiseBuffer;
      noise.loop = true;
      motor.type = voice.action === "flow" ? "sine" : "triangle";
      const hum = c.createGain();
      const modulation = c.createGain();
      wobble.frequency.value = voice.action === "flow" ? 6.3 : 11;
      modulation.gain.value = voice.action === "flow" ? 175 : 18;
      wobble.connect(modulation).connect(filter.frequency);
      hum.gain.value = voice.action === "flow" ? 0.015 : 0.065;
      motor.connect(hum).connect(gain);
      noise.connect(filter).connect(gain);
      gain.connect(master);
      motor.start();
      wobble.start();
      noise.start();
      track(motor, [motor, hum]);
      track(wobble, [wobble, modulation]);
      track(noise, [noise, filter, gain]);
      loop = { key, gain, filter, motor, noise, wobble };
    }
    const flow = voice.action === "flow",
      now = c.currentTime;
    loop!.gain.gain.setTargetAtTime(
      flow ? 0.1 + intensity * 0.09 : 0.1 + intensity * 0.07,
      now,
      0.055,
    );
    loop!.filter.frequency.setTargetAtTime(
      flow ? 500 + intensity * 1900 : 200 + intensity * 500,
      now,
      0.07,
    );
    loop!.motor.frequency.setTargetAtTime(
      flow ? 125 + intensity * 70 : 46 + intensity * 31,
      now,
      0.06,
    );
    loop!.noise.playbackRate.setTargetAtTime(0.75 + intensity * 0.3, now, 0.08);
  } catch {
    /* A failed audio device never interrupts production. */
  }
}
export function feedback(kind: FeedbackKind, sound: boolean) {
  const now = performance.now(),
    gap =
      kind === "hover"
        ? FEEL.audio.hoverGapMs
        : kind === "cash"
          ? 190
          : FEEL.audio.actionGapMs;
  if (now - (last.get(kind) ?? -Infinity) < gap) return;
  last.set(kind, now);
  try {
    const vibration = {
      stamp: [12, 6, 8],
      seal: 12,
      latch: 8,
      pickup: 6,
      collect: 9,
      paper: 4,
    }[kind as "stamp"];
    if (vibration && typeof navigator.vibrate === "function")
      navigator.vibrate(vibration);
  } catch {}
  if (!sound || document.visibilityState === "hidden") return;
  try {
    const c = setup();
    if (!c || !master || !noiseBuffer) return;
    const plan = soundLayers(kind, Math.random() * 2 - 1);
    if (voices.size + plan.length > FEEL.audio.maxVoices) return;
    for (const layer of plan) {
      const start = c.currentTime + (layer.delay ?? 0),
        gain = c.createGain(),
        source =
          layer.wave === "noise"
            ? c.createBufferSource()
            : c.createOscillator(),
        nodes: AudioNode[] = [source, gain];
      if (source instanceof OscillatorNode) {
        source.type = layer.wave as OscillatorType;
        source.frequency.setValueAtTime(layer.frequency, start);
        source.frequency.exponentialRampToValueAtTime(
          Math.max(20, layer.endFrequency),
          start + layer.duration,
        );
      } else {
        source.buffer = noiseBuffer;
        source.playbackRate.value = 0.92 + Math.random() * 0.16;
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        layer.gain,
        start + (layer.attack ?? 0.003),
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + layer.duration);
      if (layer.filter) {
        const filter = c.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = layer.filter;
        source.connect(filter).connect(gain);
        nodes.push(filter);
      } else source.connect(gain);
      gain.connect(master);
      track(source, nodes);
      source.start(start);
      source.stop(start + layer.duration + 0.01);
    }
  } catch {
    /* Optional audio/haptics must never throw into UI or gameplay. */
  }
}
export const audioDiagnostics = () => ({
  state: context?.state ?? "locked",
  voices: voices.size,
  loop: loop?.key ?? null,
  volume,
  unlocked,
});
