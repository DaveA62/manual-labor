let context: AudioContext | undefined;
export function feedback(kind: 'click' | 'stamp' | 'cash' | 'buy', sound: boolean) {
  if (kind === 'stamp' && typeof navigator.vibrate === 'function') navigator.vibrate(20);
  if (!sound) return;
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
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
