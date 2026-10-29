import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { FEEL } from "../config/feedback";
export function Burst({
  id,
  x,
  y,
  kind = "metal",
  strength = 1,
}: {
  id: number;
  x: number;
  y: number;
  kind?: "metal" | "water" | "paper";
  strength?: number;
}) {
  const [alive, setAlive] = useState(false);
  useEffect(() => {
    if (!id) return;
    setAlive(true);
    const timer = setTimeout(() => setAlive(false), FEEL.burstMs);
    return () => clearTimeout(timer);
  }, [id]);
  if (!alive) return null;
  return (
    <g
      key={id}
      className={`feel-burst burst-${kind}`}
      transform={`translate(${x} ${y})`}
      pointerEvents="none"
      aria-hidden="true"
      stroke="none"
    >
      {Array.from(
        { length: Math.min(FEEL.maxParticles, kind === "water" ? 12 : 8) },
        (_, i) => {
          const angle = (i / (kind === "water" ? 12 : 8)) * Math.PI * 2,
            speed = (22 + ((i * 13) % 31)) * strength;
          return (
            <g
              key={i}
              style={
                {
                  "--particle-x": `${Math.cos(angle) * speed}px`,
                  "--particle-y": `${-Math.abs(Math.sin(angle)) * speed - 12}px`,
                  "--particle-fall": `${25 + (i % 3) * 13}px`,
                  "--particle-delay": `${(i % 3) * 12}ms`,
                } as CSSProperties
              }
            >
              <path
                d={
                  kind === "water"
                    ? "M0-3Q4 2 0 4Q-4 2 0-3Z"
                    : kind === "paper"
                      ? "m-3-2 7 1-1 4-6-1Z"
                      : "m-2-1 5-1-1 4-4-1Z"
                }
                fill={kind === "water" ? "var(--liquid)" : "var(--paper)"}
              />
            </g>
          );
        },
      )}
    </g>
  );
}
