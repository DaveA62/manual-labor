import { LiquidVolume } from "../../presentation/LiquidVolume";
import { BOTTLING } from "../../config/machines/bottler";
import { SvgPlate, SvgIdentityPlate } from "../../ui/SvgPlate";
import { useId } from "react";
import type { BottleSize } from "../../game/types";
import type { MachineTier } from "../../game/definitions";
import { Bolt, Gear } from "../press/Parts";
export const bottleHeight = (size: BottleSize) =>
  size === "short" ? 100 : size === "tall" ? 140 : 120;
export function Bottle({
  x,
  y,
  size = "standard",
  fill = 0,
  sealed = false,
  marks = true,
  flow = 0,
}: {
  x: number;
  y: number;
  size?: BottleSize;
  fill?: number;
  sealed?: boolean;
  marks?: boolean;
  flow?: number;
}) {
  const clip = useId().replaceAll(":", "");
  const h = bottleHeight(size),
    body = h - 30,
    level = Math.min(1.18, fill) * body;
  return (
    <g data-part="bottle" transform={`translate(${x} ${y})`}>
      <defs>
        <clipPath id={clip}>
          <path d={`M-12 ${-h}h24v22l16 13V0h-56v${-h + 35}l16-13z`} />
        </clipPath>
      </defs>
      <path
        d={`M-12 ${-h}h24v22l16 13V0h-56v${-h + 35}l16-13z`}
        fill="#d4e2d5"
        fillOpacity=".55"
        strokeWidth="3"
      />
      <g clipPath={`url(#${clip})`}>
        {fill > 0 && (
          <LiquidVolume
            width={56}
            depth={body}
            fill={fill}
            flow={flow}
            pose={x}
            sealed={sealed}
          />
        )}
        {fill > 0 && (
          <path
            d={`M12 ${-Math.min(level * 0.45, body - 8)}v-3m-17 ${-Math.min(level * 0.3, 24)}v-3`}
            className={`bottle-bubbles ${flow > 0 ? "is-flowing" : ""}`}
            stroke="var(--panel)"
            strokeWidth="2"
          />
        )}
      </g>
      <path
        d={`M-19 ${-body + 15}v${Math.max(10, body - 36)}`}
        stroke="var(--panel)"
        opacity=".7"
        strokeWidth="4"
      />
      {marks && (
        <g strokeWidth="2">
          <path
            d={`M-27 ${-BOTTLING.quality.preciseMax * body}h54M-27 ${-BOTTLING.quality.preciseMin * body}h10m20 0h17`}
            stroke="var(--steel-dark)"
          />
          <path
            d={`M-26 ${-BOTTLING.quality.preciseMax * body}h-7v${(BOTTLING.quality.preciseMax - BOTTLING.quality.preciseMin) * body}h7`}
            stroke="var(--orange)"
            strokeWidth="4"
          />
        </g>
      )}
      <path
        d={`M-14 ${-h}h28`}
        strokeWidth="5"
        stroke={sealed ? "var(--orange)" : "var(--charcoal)"}
      />
      {sealed && (
        <path
          d={`M-16 ${-h - 8}h32v10h-32z`}
          fill="var(--orange)"
          strokeWidth="2"
        />
      )}
    </g>
  );
}
export function Gauge({
  x,
  y,
  value = 0,
  r = 23,
}: {
  x: number;
  y: number;
  value?: number;
  r?: number;
}) {
  return (
    <g data-part="gauge" transform={`translate(${x} ${y})`}>
      <circle r={r + 4} fill="var(--machine-shade)" />
      <circle r={r} fill="var(--panel)" strokeWidth="2" />
      <path
        d={`M${-r * 0.7} -3 0 ${-r * 0.72} ${r * 0.7} -3`}
        fill="none"
        strokeWidth="3"
      />
      <path
        d={`M0 4V${-r + 7}`}
        transform={`rotate(${-65 + Math.min(1, value) * 130})`}
        stroke="var(--red)"
        strokeWidth="3"
      />
      <circle r="3" fill="var(--charcoal)" stroke="none" />
    </g>
  );
}
export function BottlerFrame({
  tierName,
  variant,
  pressure,
}: {
  tierName: string;
  variant: string;
  pressure: number;
}) {
  return (
    <g data-part="bottler-frame" pointerEvents="none">
      <ellipse
        cx="358"
        cy="476"
        rx="324"
        ry="12"
        fill="var(--charcoal)"
        opacity=".12"
        stroke="none"
      />
      <path d="M24 445h672v20H24z" fill="var(--charcoal)" strokeWidth="5" />
      <path d="M43 465v22h30v-22m570 0v22h30v-22" fill="var(--machine-shade)" />
      <path
        d="M207 76h29v365h-29zm295 0h29v365h-29z"
        fill="var(--machine-paint)"
        strokeWidth="5"
      />
      <path
        d="M194 51h349v39H194z"
        fill="var(--machine-paint)"
        strokeWidth="5"
      />
      <path d="M201 57h332" stroke="var(--machine-highlight)" strokeWidth="4" />
      <path
        d="M229 129h282M229 242h282"
        strokeWidth="9"
        stroke="var(--machine-shade)"
      />
      <SvgIdentityPlate
        x={258}
        y={55}
        width={222}
        height={30}
        code={`BT–02 / ${tierName.toUpperCase()}`}
      />
      <path
        d="M234 103h121v124H234z"
        fill="#dce6d7"
        fillOpacity=".65"
        strokeWidth="4"
      />
      <g transform="translate(294.5 220)">
        <LiquidVolume
          width={109}
          depth={108}
          fill={62 / 108}
          flow={pressure * 0.5}
        />
      </g>
      {variant !== "water" && (
        <g
          className={`reservoir-bubbles ${pressure > 0 ? "is-flowing" : ""}`}
          fill="var(--panel)"
          stroke="none"
          opacity=".65"
        >
          {[
            [259, 181, 2],
            [276, 206, 3],
            [305, 188, 2],
            [333, 202, 2],
          ].map(([cx, cy, r]) => (
            <circle cx={cx} cy={cy} r={r} key={cx} />
          ))}
        </g>
      )}
      <path d="M248 114v94" stroke="var(--panel)" strokeWidth="5" />
      <path
        d="M230 102h129v12H230zm0 113h129v13H230z"
        fill="var(--machine-shade)"
      />
      <path
        d="M295 228v25h119v-79h-55M295 253v26"
        fill="none"
        stroke="var(--charcoal)"
        strokeWidth="16"
      />
      <path
        d="M295 228v25h119v-79h-55M295 253v26"
        fill="none"
        stroke="var(--machine-highlight)"
        strokeWidth="8"
      />
      <path d="M284 272h22v20h-22z" fill="var(--frame)" />
      <path d="M280 274h30" strokeWidth="5" />
      <path
        d="M355 119h9V98h192"
        fill="none"
        stroke="var(--charcoal)"
        strokeWidth="8"
      />
      <path
        d="M355 119h9V98h192"
        fill="none"
        stroke="var(--frame)"
        strokeWidth="4"
      />
      <rect
        x="552"
        y="79"
        width="136"
        height="74"
        fill="var(--machine-paint)"
        strokeWidth="3"
      />
      <Gauge x={584} y={108} value={pressure} r={21} />
      {variant !== "water" && (
        <Gauge x={649} y={108} value={pressure * 0.7} r={17} />
      )}
      <SvgPlate x={558} y={136} width={116} height={15} fontSize={10}>
        LINE PRESSURE
      </SvgPlate>
      {variant !== "water" && (
        <g data-tier="reinforced">
          <path
            d="M243 126h104m-104 76h104"
            strokeWidth="5"
            stroke="var(--machine-shade)"
          />
          {[136, 190].map((y) => (
            <Bolt key={y} x={351} y={y} />
          ))}
        </g>
      )}
      {variant === "premium" && (
        <g data-tier="quality-control">
          <rect
            x="642"
            y="221"
            width="42"
            height="79"
            fill="var(--machine-paint)"
          />
          <Gauge x={663} y={245} value={pressure} r={12} />
          <SvgPlate x={646} y={270} width={34} height={21} fontSize={10}>
            QC III
          </SvgPlate>
          <path d="M663 221v-9h-29" fill="none" strokeWidth="4" />
          <SvgPlate x={242} y={126} width={98} height={25} fontSize={11}>
            QC / OBSERVED
          </SvgPlate>
        </g>
      )}
      <path
        d="M190 423h357v20H190z"
        fill="var(--machine-paint)"
        strokeWidth="5"
      />
      <path d="M240 431h255" stroke="var(--orange)" strokeWidth="5" />
      <path
        d="M210 96h13m-13 6h8m283 254h13m-13 6h9m-286 41h16m-16 6h8"
        stroke="var(--paper)"
        strokeWidth="3"
      />
      <path d="M211 285h21v29h-21z" fill="var(--panel)" strokeWidth="1.5" />
      <path d="M217 290h9m-9 6h7" strokeWidth="2" />
      {[
        [208, 70],
        [528, 70],
        [218, 412],
        [516, 412],
        [218, 171],
        [516, 199],
      ].map(([x, y]) => (
        <Bolt x={x} y={y} key={`${x}-${y}`} />
      ))}
    </g>
  );
}
export function RotaryValve({ angle }: { angle: number }) {
  return (
    <g data-part="valve" transform={`translate(418 176) rotate(${angle})`}>
      <circle r="48" fill="var(--orange)" strokeWidth="5" />
      <circle r="34" fill="var(--panel)" strokeWidth="3" />
      <path
        d="M0-34v68m-30-51 60 34m-60 0 60-34"
        stroke="var(--orange)"
        strokeWidth="9"
      />
      <circle r="12" fill="var(--frame)" />
      <Bolt x={0} y={0} />
      <path d="M39-11h17v24H39z" fill="var(--charcoal)" />
    </g>
  );
}
export function Capper({
  pull,
  lever,
  size,
  layer = "front",
}: {
  layer?: "back" | "front";
  pull: number;
  lever: number;
  size: BottleSize;
}) {
  if (layer === "back")
    return (
      <g pointerEvents="none" data-part="capper-support">
        <path
          d="M484 207h40v196h-40z"
          fill="var(--machine-shade)"
          strokeWidth="5"
        />
        <path d="M458 206h68v20h-68z" fill="var(--machine-paint)" />
        <path
          d="m486 298 13 5-13 5 13 5-13 5 13 5-13 5"
          fill="none"
          strokeWidth="2"
        />
      </g>
    );
  return (
    <g data-part="capper">
      <path
        d={`M473 226V${355 - bottleHeight(size) + pull * 38}`}
        stroke="var(--frame)"
        strokeWidth="12"
      />
      <path
        d={`M461 ${355 - bottleHeight(size) + pull * 38}h24v10h-24z`}
        fill="var(--charcoal)"
      />
      <g className="capper-lever" transform={`rotate(${lever * 54} 511 250)`}>
        <path d="M511 250 573 215" strokeWidth="9" />
        <path
          d="m568 208 30-17 8 14-30 17z"
          fill="var(--orange)"
          strokeWidth="4"
        />
      </g>
      <Bolt x={511} y={250} />
    </g>
  );
}
export function BottlerHardware({
  loader,
  regulator,
  capper,
  conveyor,
  phase,
  progress,
}: {
  loader: boolean;
  regulator: boolean;
  capper: boolean;
  conveyor: boolean;
  phase: string;
  progress: number;
}) {
  return (
    <g pointerEvents="none">
      {loader && (
        <g data-upgrade="bottle-loader">
          <path d="M178 321h38v104h-38z" fill="var(--machine-paint)" />
          <Gear
            x={197}
            y={345}
            radius={17}
            angle={phase === "load" ? progress * 160 : 0}
          />
          <g
            transform={`rotate(${phase === "load" ? -180 + progress * 180 : -180} 197 345)`}
          >
            <path d="M197 345h56v-12h22v20h-22" fill="var(--frame)" />
          </g>
          <path d="M185 393h23m-23 8h23" strokeWidth="3" />
        </g>
      )}
      {regulator && (
        <g data-upgrade="flow-regulator">
          <path d="M631 163h49v27h-49z" fill="var(--machine-paint)" />
          <path d="M639 169v14m9-14v14m9-14v14" strokeWidth="2" />
          <Gear
            x={655}
            y={200}
            radius={10}
            angle={phase === "fill" ? progress * 360 : 0}
          />
          <path d="M639 192h-25v-30H480v14" fill="none" strokeWidth="5" />
        </g>
      )}
      {capper && (
        <g data-upgrade="auto-capper">
          <rect
            x="531"
            y="306"
            width="42"
            height="65"
            fill="var(--machine-paint)"
            strokeWidth="4"
          />
          <path d="M539 314h25m-25 7h25m-25 7h25" strokeWidth="3" />
          <Gear
            x={549}
            y={351}
            radius={15}
            angle={phase === "cap" || phase === "transfer" ? progress * 360 : 0}
          />
          <path d="M534 369h-38v25" fill="none" strokeWidth="6" />
        </g>
      )}
      {conveyor && (
        <g data-upgrade="crate-conveyor">
          <path d="M491 411h142v21H491z" fill="var(--machine-paint)" />
          <path d="M494 415h137" strokeWidth="8" />
          {[506, 534, 562, 590, 618].map((x) => (
            <Gear
              x={x}
              y={422}
              radius={8}
              angle={phase === "collect" ? progress * 360 : 0}
              key={x}
            />
          ))}
        </g>
      )}
    </g>
  );
}
export function BottlerThumbnail({
  finish,
}: {
  finish: MachineTier["finish"];
}) {
  return (
    <svg
      data-finish={finish}
      data-bottler-tier={
        finish === "gold" ? "premium" : finish === "silver" ? "soda" : "water"
      }
      className="machine-thumbnail"
      viewBox="0 0 280 190"
      stroke="var(--charcoal)"
      strokeWidth="3"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 164h240v12H20zm48-134h14v132H68zm130 0h14v132h-14zM59 20h163v18H59z"
        fill="var(--machine-paint)"
      />
      <path d="M87 46h53v61H87z" fill="var(--panel)" />
      <path d="M91 72h45v31H91z" fill="var(--liquid)" stroke="none" />
      <path
        d="M113 108v22h22v12m5-61h32v42"
        stroke="var(--frame)"
        strokeWidth="7"
      />
      <circle cx="172" cy="81" r="24" fill="var(--orange)" />
      <path d="M172 60v42m-20-21h40" strokeWidth="5" />
      <Gauge x={154} y={47} r={10} value={0.3} />
      <path d="M113 157h82m-11-28v27h17v-27h-17z" fill="var(--frame)" />
      <path d="M187 127h25v8h-25zm21 0 23-24" strokeWidth="5" />
      <Bottle x={132} y={155} size="short" fill={0.97} marks={false} />
      <path
        d="M19 145h35v20H19zm209 1h40v20h-40z"
        fill="var(--machine-shade)"
      />
      <rect
        x="96"
        y="23"
        width="86"
        height="12"
        fill="var(--panel)"
        strokeWidth="1"
      />
      <text
        x="139"
        y="32"
        className="bottler-label"
        textAnchor="middle"
        fontSize="9"
      >
        BT—02
      </text>
    </svg>
  );
}
