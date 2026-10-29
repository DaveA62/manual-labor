import { CONTINUUM } from "../../config/retirement.ts";
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}
export const clampCamera = (c: Camera): Camera => ({
  x: Math.max(CONTINUUM.bounds.left, Math.min(CONTINUUM.bounds.right, c.x)),
  y: Math.max(CONTINUUM.bounds.top, Math.min(CONTINUUM.bounds.bottom, c.y)),
  zoom: Math.max(CONTINUUM.minZoom, Math.min(CONTINUUM.maxZoom, c.zoom)),
});
/** Zoom around a viewport-local anchor, preserving the world point beneath it. */
export function zoomAt(
  c: Camera,
  zoom: number,
  anchor: { x: number; y: number },
  width: number,
  height: number,
): Camera {
  const z = clampCamera({ ...c, zoom }).zoom;
  return clampCamera({
    zoom: z,
    x: c.x + (anchor.x - width / 2) * (1 / c.zoom - 1 / z),
    y: c.y + (anchor.y - height / 2) * (1 / c.zoom - 1 / z),
  });
}

export function pinchAt(
  c: Camera,
  previous: { x: number; y: number },
  next: { x: number; y: number },
  other: { x: number; y: number },
  width: number,
  height: number,
): Camera {
  const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
  if (oldDistance <= 2) return c;
  const distance = Math.hypot(next.x - other.x, next.y - other.y),
    anchor = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 },
    mid = { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 };
  const z = zoomAt(c, (c.zoom * distance) / oldDistance, anchor, width, height);
  return clampCamera({
    ...z,
    x: z.x - (mid.x - anchor.x) / z.zoom,
    y: z.y - (mid.y - anchor.y) / z.zoom,
  });
}
