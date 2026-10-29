import type { FeedbackKind } from './contracts.ts';
let context: AudioContext | undefined;
export function feedback(kind: FeedbackKind, sound: boolean) {
  try {
    if (typeof globalThis.navigator?.vibrate === 'function') {
      if (kind === 'stamp') navigator.vibrate(20);
      if (kind === 'pickup') navigator.vibrate(12);
    }
  } catch { /* Haptics are optional. */ }
  if (kind === 'pickup') return;
  if (!sound) return;
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
    if (kind === 'click' || kind === 'stamp') {
      const duration = kind === 'stamp' ? .09 : .025;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i=0;i<samples.length;i++) samples[i]=(Math.random()*2-1)*(1-i/samples.length);
      const source=context.createBufferSource(), filter=context.createBiquadFilter(), volume=context.createGain();
      source.buffer=buffer; filter.type='lowpass'; filter.frequency.value=kind==='stamp'?900:2400;
      volume.gain.value=kind==='stamp'?.12:.035;
      source.connect(filter).connect(volume).connect(context.destination); source.start();
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = kind === 'stamp' ? 'triangle' : 'sine';
    const frequency = { click: 160, stamp: 95, cash: 740, buy: 520 }[kind];
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'cash' ? 1120 : frequency / 3, now + 0.13);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(now + 0.18);
  } catch { /* Audio is optional; production never depends on device support. */ }
}
