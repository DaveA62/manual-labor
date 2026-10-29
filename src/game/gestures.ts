export const CRANK = { x: 556, y: 272 };
export const TAU = Math.PI * 2;
export function angleDelta(previous: number, next: number) {
  return Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
}
export function validStamp(distance: number, peakSpeed: number) { return distance >= 92 && peakSpeed >= 0.32; }
export function inPlate(x: number, y: number) { return x >= 245 && x <= 452 && y >= 299 && y <= 423; }
export function inTray(x: number, y: number) { return x >= 535 && x <= 710 && y >= 340 && y <= 475; }

/** Recent velocity decays after a pause, so an old fast movement cannot stamp later. */
export function recentDownSpeed(previous: number, delta: number, elapsed: number) {
  return elapsed > 0 ? Math.max(previous * Math.exp(-elapsed / 90), delta / elapsed) : previous;
}
export function resistedHeadTravel(distance: number) { return Math.min(132, Math.max(0, distance) * .92); }
/** Continuous drive position across both lifts and alternating completed cycles. */
export function driveAngle(phase: string, bills: number, progress: number) {
  const sign = bills % 2 === 0 ? 1 : -1;
  const base = bills % 2 === 0 ? 0 : 720;
  const completed = ['stamp','lift','collect'].includes(phase) ? 360 : 0;
  return base + sign * (completed + (phase === 'raise' || phase === 'lift' ? progress * 360 : phase === 'collect' ? 360 : 0));
}
