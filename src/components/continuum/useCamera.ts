import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { CONTINUUM } from "../../config/retirement";
import { clampCamera, zoomAt, pinchAt } from "./camera";
import type { Camera } from "./camera";
export function useCamera(
  width: number,
  height: number,
  onSelect: (id: string) => void,
) {
  const ref = useRef<SVGSVGElement>(null),
    current = useRef<Camera>({ x: 0, y: 0, zoom: CONTINUUM.initialZoom });
  const [camera, setCamera] = useState(current.current),
    points = useRef(new Map<number, { x: number; y: number }>()),
    start = useRef<{ x: number; y: number; moved: boolean; node?: string }>({
      x: 0,
      y: 0,
      moved: false,
    }),
    frame = useRef<number | undefined>(undefined);
  function commit(c: Camera) {
    current.current = clampCamera(c);
    if (frame.current === undefined)
      frame.current = requestAnimationFrame(() => {
        frame.current = undefined;
        setCamera(current.current);
      });
  }
  const positioned = useRef(false);
  useEffect(() => {
    if (!positioned.current && width > 0 && height > 0) {
      positioned.current = true;
      current.current = {
        x: 0,
        y: width < 650 ? CONTINUUM.compactFocusY : 0,
        zoom: CONTINUUM.initialZoom,
      };
      setCamera(current.current);
    }
  }, [width, height]);
  function local(e: { clientX: number; clientY: number }) {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      commit(
        zoomAt(
          current.current,
          current.current.zoom * Math.exp(-e.deltaY * 0.0015),
          local(e),
          width,
          height,
        ),
      );
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [width, height]);
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      frame.current = undefined;
    },
    [],
  );
  useEffect(() => {
    for (const id of points.current.keys()) {
      if (ref.current?.hasPointerCapture(id))
        ref.current.releasePointerCapture(id);
    }
    points.current.clear();
    start.current.moved = true;
  }, [width, height]);
  function down(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    points.current.set(e.pointerId, local(e));
    if (points.current.size === 1)
      start.current = {
        ...local(e),
        moved: false,
        node:
          (e.target as Element)
            .closest("[data-node]")
            ?.getAttribute("data-node") ?? undefined,
      };
    else start.current.moved = true;
  }
  function move(e: ReactPointerEvent<SVGSVGElement>) {
    const previous = points.current.get(e.pointerId);
    if (!previous) return;
    const p = local(e),
      all = [...points.current.entries()];
    if (Math.hypot(p.x - start.current.x, p.y - start.current.y) > 6)
      start.current.moved = true;
    if (all.length === 1)
      commit({
        ...current.current,
        x: current.current.x - (p.x - previous.x) / current.current.zoom,
        y: current.current.y - (p.y - previous.y) / current.current.zoom,
      });
    else {
      const other = all.find(([id]) => id !== e.pointerId)![1];
      commit(pinchAt(current.current, previous, p, other, width, height));
    }
    points.current.set(e.pointerId, p);
  }
  function up(e: ReactPointerEvent<SVGSVGElement>) {
    const p = local(e);
    points.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (!start.current.moved && points.current.size === 0) {
      if (start.current.node) {
        onSelect(start.current.node);
        return;
      }
      const world = {
        x: (p.x - width / 2) / current.current.zoom + current.current.x,
        y: (p.y - height / 2) / current.current.zoom + current.current.y,
      }; // Select by the original visible node element, not pointer-capture's retargeted element.
      const nodes = [
        ...e.currentTarget.querySelectorAll<SVGGElement>("[data-node]"),
      ];
      const hit = nodes.find((n) => {
        const x = Number(n.dataset.x),
          y = Number(n.dataset.y);
        return (
          Math.hypot(world.x - x, world.y - y) <=
          Math.max(30, 24 / current.current.zoom)
        );
      });
      if (hit?.dataset.node) onSelect(hit.dataset.node);
    }
  }
  function cancel(e: ReactPointerEvent<SVGSVGElement>) {
    points.current.delete(e.pointerId);
    start.current.moved = true;
  }
  return {
    ref,
    camera,
    down,
    move,
    up,
    cancel,
    recenter: () =>
      commit({
        x: 0,
        y: width < 650 ? CONTINUUM.compactFocusY : 0,
        zoom: CONTINUUM.initialZoom,
      }),
    zoom: (factor: number) =>
      commit(
        zoomAt(
          current.current,
          current.current.zoom * factor,
          { x: width / 2, y: height / 2 },
          width,
          height,
        ),
      ),
    focus: (x: number, y: number) => commit({ ...current.current, x, y }),
  };
}
