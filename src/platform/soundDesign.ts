import type { FeedbackKind } from "./contracts.ts";
export interface SoundLayer {
  wave: "sine" | "triangle" | "square" | "noise";
  frequency: number;
  endFrequency: number;
  gain: number;
  duration: number;
  delay?: number;
  filter?: number;
  attack?: number;
  pan?: number;
}
const tone = (
  frequency: number,
  endFrequency: number,
  gain: number,
  duration: number,
  delay = 0,
  wave: SoundLayer["wave"] = "sine",
): SoundLayer => ({ wave, frequency, endFrequency, gain, duration, delay });
const noise = (
  filter: number,
  gain: number,
  duration: number,
  delay = 0,
): SoundLayer => ({
  wave: "noise",
  frequency: 1,
  endFrequency: 1,
  filter,
  gain,
  duration,
  delay,
});
/** Layered material voices. The variation seed is cosmetic, not production RNG. */
export function soundLayers(kind: FeedbackKind, variation = 0): SoundLayer[] {
  const detune = 1 + Math.max(-1, Math.min(1, variation)) * 0.035;
  const plans: Partial<Record<FeedbackKind, SoundLayer[]>> = {
    ui: [noise(1800, 0.022, 0.018), tone(740, 510, 0.025, 0.036)],
    hover: [tone(680, 640, 0.008, 0.022)],
    switch: [noise(2600, 0.032, 0.026), tone(190, 115, 0.035, 0.065)],
    click: [noise(1500, 0.035, 0.022), tone(180, 80, 0.035, 0.055)],
    ratchet: [
      noise(4200, 0.04, 0.016),
      tone(650, 320, 0.023, 0.028, 0, "triangle"),
    ],
    paper: [noise(3900, 0.055, 0.11), noise(1900, 0.025, 0.06, 0.035)],
    glass: [
      tone(1420, 1320, 0.04, 0.17),
      tone(2270, 2220, 0.018, 0.12, 0.008),
      noise(2900, 0.018, 0.016),
    ],
    valve: [
      noise(2400, 0.024, 0.032),
      tone(310, 230, 0.022, 0.05, 0, "triangle"),
    ],
    slide: [noise(1100, 0.04, 0.12), tone(130, 80, 0.025, 0.08)],
    latch: [
      noise(3300, 0.07, 0.025),
      tone(280, 140, 0.065, 0.09),
      tone(840, 650, 0.018, 0.045, 0.025),
    ],
    release: [
      noise(3900, 0.025, 0.1),
      tone(190, 310, 0.025, 0.1, 0, "triangle"),
    ],
    stamp: [
      tone(105, 34, 0.17, 0.22),
      noise(750, 0.13, 0.095),
      noise(4600, 0.04, 0.024),
      tone(780, 410, 0.035, 0.17, 0.012, "triangle"),
      tone(155, 65, 0.045, 0.16, 0.045),
    ],
    seal: [
      noise(4800, 0.08, 0.022),
      tone(440, 170, 0.085, 0.07, 0, "triangle"),
      tone(1640, 1530, 0.022, 0.14, 0.025),
    ],
    collect: [
      noise(2200, 0.042, 0.07),
      tone(600, 450, 0.04, 0.07),
      tone(1620, 1400, 0.022, 0.12, 0.035),
    ],
    cash: [
      tone(660, 660, 0.04, 0.12),
      tone(990, 990, 0.035, 0.14, 0.055),
      tone(1320, 1320, 0.025, 0.18, 0.1),
      noise(4900, 0.012, 0.025, 0.03),
    ],
    buy: [
      noise(1500, 0.045, 0.035),
      tone(330, 330, 0.045, 0.12),
      tone(495, 495, 0.035, 0.15, 0.06),
      tone(660, 660, 0.03, 0.18, 0.12),
    ],
    reject: [
      tone(145, 115, 0.025, 0.1, 0, "triangle"),
      noise(700, 0.015, 0.025),
    ],
    pickup: [noise(1800, 0.024, 0.04), tone(240, 400, 0.025, 0.05)],
    continuum: [196, 293.66, 440].map((f, i) => ({
      ...tone(f, f, 0.025, 1.65, i * 0.12),
      attack: 0.15,
    })),
    reveal: [392, 587.3, 880].map((f, i) => ({
      ...tone(f, f, 0.025, 0.6, i * 0.06),
      attack: 0.025,
    })),
  };
  return (plans[kind] ?? plans.ui!).map((l) => ({
    ...l,
    frequency: l.frequency * detune,
    endFrequency: l.endFrequency * detune,
  }));
}
