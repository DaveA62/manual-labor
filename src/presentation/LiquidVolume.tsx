import { useEffect, useRef } from "react";
import { createLiquid, stepLiquid, surfacePaths } from "./liquid";
import { FEEL } from "../config/feedback";
/** Only the two visible vessels animate. Geometry updates outside React's production clock. */
export function LiquidVolume({
  width,
  depth,
  fill,
  flow = 0,
  pose = 0,
  sealed = false,
}: {
  width: number;
  depth: number;
  fill: number;
  flow?: number;
  pose?: number;
  sealed?: boolean;
}) {
  const volume = useRef<SVGPathElement>(null),
    surface = useRef<SVGPathElement>(null),
    sheen = useRef<SVGPathElement>(null);
  const input = useRef({ fill, flow, pose, sealed }),
    shownFill = useRef(fill),
    physics = useRef(createLiquid()),
    wake = useRef<() => void>(() => {});
  input.current = { fill, flow, pose, sealed };
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | undefined,
      last = 0,
      lastPose = input.current.pose,
      lastVelocity = 0;
    function paint() {
      const paths = surfacePaths(
        physics.current,
        width,
        depth,
        shownFill.current,
      );
      volume.current?.setAttribute("d", paths.volume);
      surface.current?.setAttribute("d", paths.surface);
      sheen.current?.setAttribute("d", paths.surface);
    }
    function tick(now: number) {
      frame = undefined;
      if (document.visibilityState === "hidden") return;
      const p = input.current,
        dt = last ? Math.min(0.04, (now - last) / 1000) : 1 / 60;
      const velocity = (p.pose - lastPose) / Math.max(dt, 0.005),
        impulse = Math.max(-1, Math.min(1, (velocity - lastVelocity) / 900));
      physics.current = reduced.matches
        ? createLiquid()
        : stepLiquid(physics.current, dt, impulse, p.sealed ? 0 : p.flow);
      shownFill.current = reduced.matches || p.fill === 0
        ? p.fill
        : shownFill.current + (p.fill - shownFill.current) * (1 - Math.exp(-FEEL.liquid.fillResponse * dt));
      last = now;
      lastPose = p.pose;
      lastVelocity = velocity * 0.45;
      paint();
      const q = physics.current,
        energy =
          Math.abs(q.tilt) +
          Math.abs(q.tiltVelocity) +
          q.heights.reduce(
            (n, h, i) => n + Math.abs(h) + Math.abs(q.velocities[i]),
            0,
          );
      if (
        !reduced.matches &&
        ((p.flow > 0 && !p.sealed) ||
          energy > FEEL.liquid.rest ||
          Math.abs(shownFill.current - p.fill) > 0.0002 ||
          Math.abs(velocity) > 0.1)
      )
        frame = requestAnimationFrame(tick);
    }
    wake.current = () => {
      if (frame === undefined && document.visibilityState !== "hidden")
        frame = requestAnimationFrame(tick);
    };
    function visibility() {
      if (document.visibilityState === "hidden") {
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = undefined;
        last = 0;
      } else wake.current();
    }
    wake.current();
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", visibility);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      wake.current = () => {};
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", visibility);
    };
  }, [width, depth]);
  useEffect(() => wake.current(), [fill, flow, pose, sealed]);
  const paths = surfacePaths(physics.current, width, depth, shownFill.current);
  return (
    <g pointerEvents="none" data-fluid="spring-surface" visibility={fill > 0 ? "visible" : "hidden"}>
      <path
        ref={volume}
        d={paths.volume}
        fill="var(--liquid)"
        opacity=".82"
        stroke="none"
      />
      <path
        ref={surface}
        d={paths.surface}
        fill="none"
        stroke="var(--liquid-edge)"
        strokeWidth="2"
      />
      <path
        ref={sheen}
        d={paths.surface}
        fill="none"
        stroke="var(--panel)"
        strokeWidth="1"
        transform="translate(0 2)"
        opacity=".55"
      />
    </g>
  );
}
