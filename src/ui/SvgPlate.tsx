import type { ReactNode } from "react";
/** Fixed backing/ink pair. Keep plates outside moving-part envelopes. */
export function SvgPlate({
  x,
  y,
  width,
  height,
  children,
  dark = false,
  fontSize = 12,
  numeric = false,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  children: ReactNode;
  dark?: boolean;
  fontSize?: number;
  numeric?: boolean;
}) {
  return (
    <g
      className={`svg-plate ${dark ? "svg-plate--dark" : ""}`}
      pointerEvents="none"
      data-label-plate="true"
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={dark ? "var(--readout-bg)" : "var(--plate-bg)"}
        stroke="var(--charcoal)"
        strokeWidth="1.5"
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        dominantBaseline="central"
        textAnchor="middle"
        fill={dark ? "var(--readout-ink)" : "var(--plate-ink)"}
        stroke="none"
        fontFamily={numeric ? "var(--body)" : "var(--heading)"}
        fontSize={fontSize}
        letterSpacing=".3"
      >
        {children}
      </text>
    </g>
  );
}
export function SvgIdentityPlate({
  x,
  y,
  width,
  height = 30,
  code,
}: {
  x: number;
  y: number;
  width: number;
  height?: number;
  code: string;
}) {
  return (
    <g data-label-plate="true" pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="var(--plate-bg)"
        stroke="var(--charcoal)"
        strokeWidth="1.5"
      />
      <text
        x={x + width / 2}
        y={y + height * 0.37}
        textAnchor="middle"
        fill="var(--plate-ink)"
        stroke="none"
        fontFamily="var(--heading)"
        fontSize="10"
      >
        PROVISIONAL INDUSTRIES
      </text>
      <text
        x={x + width / 2}
        y={y + height * 0.78}
        textAnchor="middle"
        fill="var(--plate-ink)"
        stroke="none"
        fontFamily="var(--heading)"
        fontSize="10"
        letterSpacing=".5"
      >
        {code}
      </text>
    </g>
  );
}
