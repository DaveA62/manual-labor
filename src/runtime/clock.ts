import type { GamePlatform } from '../platform/contracts.ts';
/** A single host-driven production clock, independent of React and renderer frame rates. */
export function createProductionClock(lifecycle: GamePlatform['lifecycle'], tick: (elapsedMs: number) => void) {
  let last = lifecycle.now(), active = lifecycle.isActive();
  const dispose = lifecycle.subscribe(value => { active = value; last = lifecycle.now(); });
  return {
    advance() {
      const now = lifecycle.now();
      const elapsed = Math.max(0, Math.min(250, now - last));
      last = now;
      if (active && elapsed > 0) tick(elapsed);
    },
    dispose,
  };
}
