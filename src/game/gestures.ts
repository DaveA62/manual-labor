export const CRANK = { x: 556, y: 272 };
export const TAU = Math.PI * 2;
export function angleDelta(previous: number, next: number) {
  return Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
}
export function validStamp(distance: number, peakSpeed: number) { return distance >= 92 && peakSpeed >= 0.32; }
export function inPlate(x: number, y: number) { return x >= 245 && x <= 452 && y >= 299 && y <= 423; }
export function inTray(x: number, y: number) { return x >= 535 && x <= 710 && y >= 340 && y <= 475; }
