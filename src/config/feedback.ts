/** Presentation only. Never import into production/economy calculations. */
export const FEEL = {
  maxParticles: 16,
  burstMs: 650,
  liquid: {
    points: 9,
    spring: 90,
    coupling: 65,
    damping: 5.8,
    maxWave: 7,
    maxTilt: 8,
    flowForce: 150,
    flowImpulse: 1.6,
    fillResponse: 24,
    rest: 0.018,
  },
  audio: {
    defaultVolume: 0.55,
    maxVoices: 28,
    hoverGapMs: 100,
    actionGapMs: 38,
    loopFadeMs: 90,
  },
} as const;
