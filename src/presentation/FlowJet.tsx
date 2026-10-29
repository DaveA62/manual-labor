import type { CSSProperties } from "react";
export function FlowJet({
  x,
  start,
  end,
  aperture,
  dripping,
}: {
  x: number;
  start: number;
  end: number;
  aperture: number;
  dripping: boolean;
}) {
  const distance = Math.max(4, end - start),
    width = 1.5 + aperture * 4.5;
  return (
    <g
      className={dripping ? "flow-drips" : "flow-jet"}
      style={{ "--drop-distance": `${distance}px` } as CSSProperties}
      pointerEvents="none"
      aria-hidden="true"
    >
      {!dripping && (
        <>
          <path
            d={`M${x} ${start}q-1 ${distance * 0.25} 0 ${distance * 0.5}t0 ${distance * 0.5}`}
            fill="none"
            stroke="var(--liquid-edge)"
            strokeWidth={width + 1}
            opacity=".5"
          />
          <path
            className="liquid-stream"
            d={`M${x} ${start}V${end}`}
            fill="none"
            stroke="var(--liquid)"
            strokeWidth={width}
            strokeDasharray="12 3"
            strokeLinecap="round"
          />
          <path
            d={`M${x - 1} ${start}V${end}`}
            fill="none"
            stroke="var(--panel)"
            strokeWidth="1"
            opacity=".5"
          />
        </>
      )}
      {[0, 1, 2].map((i) => (
        <circle
          className="falling-drop"
          key={i}
          cx={x + (i - 1) * 1.2}
          cy={start}
          r={dripping ? 1.8 : width * 0.4}
          fill="var(--liquid)"
          stroke="none"
          style={{ animationDelay: `${i * -130}ms` }}
        />
      ))}
    </g>
  );
}
