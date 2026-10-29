import { FEEL } from "../config/feedback.ts";
export interface LiquidState {
  heights: number[];
  velocities: number[];
  tilt: number;
  tiltVelocity: number;
  time: number;
}
export const createLiquid = (): LiquidState => ({
  heights: Array(FEEL.liquid.points).fill(0),
  velocities: Array(FEEL.liquid.points).fill(0),
  tilt: 0,
  tiltVelocity: 0,
  time: 0,
});
const clamp = (x: number, limit: number) =>
  Math.max(-limit, Math.min(limit, x));
/** Small, volume-neutral spring surface. This is visual water, never fill simulation. */
export function stepLiquid(
  s: LiquidState,
  dt: number,
  impulse: number,
  flow: number,
): LiquidState {
  const c = FEEL.liquid,
    h = [...s.heights],
    v = [...s.velocities];
  let tilt = s.tilt,
    tv = s.tiltVelocity,
    time = s.time;
  dt = Math.max(0, Math.min(0.04, Number.isFinite(dt) ? dt : 0));
  impulse = Number.isFinite(impulse) ? clamp(impulse, 1) : 0;
  flow = Number.isFinite(flow) ? Math.max(0, Math.min(1, flow)) : 0;
  tv += impulse * 28;
  v[Math.floor(h.length / 2)] += flow * c.flowImpulse * dt * 60;
  for (let sub = 0; sub < 3; sub++) {
    const step = dt / 3;
    time += step;
    tv += (-tilt * 48 - tv * 5) * step;
    tilt = clamp(tilt + tv * step, c.maxTilt);
    const next = h.map(
      (y, i) =>
        -c.spring * y -
        c.damping * v[i] +
        c.coupling * ((h[i - 1] ?? y) + (h[i + 1] ?? y) - 2 * y) +
        Math.sqrt(flow) * Math.sin(time * 19 + i * 1.4) * c.flowForce,
    );
    for (let i = 0; i < h.length; i++) {
      v[i] = clamp(v[i] + next[i] * step, 50);
      h[i] = clamp(h[i] + v[i] * step, c.maxWave);
    }
  }
  const mean = h.reduce((a, b) => a + b, 0) / h.length;
  return {
    heights: h.map((x) => x - mean),
    velocities: v,
    tilt,
    tiltVelocity: tv,
    time,
  };
}
export function surfacePaths(
  s: LiquidState,
  width: number,
  depth: number,
  fill: number,
) {
  const level = -Math.max(0, Math.min(1.25, fill)) * depth;
  const amplitude = Math.min(1, Math.max(0, fill * depth / 10));
  const points = s.heights.map((y, i) => ({
    x: -width / 2 + (i * width) / (s.heights.length - 1),
    y: level + amplitude * (y + s.tilt * ((i / (s.heights.length - 1)) * 2 - 1)),
  }));
  let line = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    line += ` C${a.x + width / 24} ${a.y} ${b.x - width / 24} ${b.y} ${b.x} ${b.y}`;
  }
  return { surface: line, volume: `${line} L${width / 2} 3 L${-width / 2} 3Z` };
}
