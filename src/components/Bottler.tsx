import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { MachineRendererProps } from "../runtime/machine";
import { automated, bottlePayout, bottleQuality, tier } from "../game/machines";
import { BOTTLING } from "../game/definitions";
import { angleDelta } from "../game/gestures";
import {
  Bottle,
  BottlerFrame,
  BottlerHardware,
  Capper,
  RotaryValve,
} from "./bottler/Parts";
import { money } from "../ui/format";

const VALVE = { x: 418, y: 176 },
  FILL_X = 295,
  CAP_X = 473,
  BASE_Y = 401,
  TRAVEL = CAP_X - FILL_X;
type Part = "rack" | "valve" | "carriage" | "lever" | "output";
type Drag = {
  part: Part;
  pointer: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  angle: number;
  phase: string;
};
export function Bottler({ state, runtime, hint }: MachineRendererProps) {
  const b = state.bottler!;
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<Drag | null>(null);
  const [visual, setVisual] = useState<Drag | null>(null),
    [hit, setHit] = useState(88),
    [impact, setImpact] = useState(0);
  const previous = useRef(state.phase),
    lastSound = useRef(0);
  const phase = state.phase,
    auto = automated(state),
    owned = (id: (typeof state.upgrades)[number]) =>
      state.upgrades.includes(id);
  const active = (part: Part) =>
    part === "rack"
      ? phase === "load" && !auto
      : part === "valve"
        ? phase === "fill" && !auto
        : part === "carriage"
          ? (phase === "transfer" && !auto) ||
            (phase === "fill" && !auto && b.valve === 0 && b.dripMs === 0)
          : part === "lever"
            ? phase === "cap" && !auto
            : phase === "collect" && !auto;
  function cancel() {
    if (drag.current?.part === "lever" && runtime.read().phase === "cap")
      runtime.act({ type: "cap", amount: -1 });
    drag.current = null;
    setVisual(null);
  }
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const scale = Math.min(r.width / 720, r.height / 510);
      if (scale > 0) setHit(Math.max(80, 44 / scale));
      cancel();
    });
    observer.observe(el);
    const blur = () => cancel();
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);
    return () => {
      observer.disconnect();
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
    };
  }, []);
  useEffect(() => {
    if (previous.current === "cap" && phase === "collect") {
      setImpact((v) => v + 1);
      runtime.feedback("seal");
    }
    previous.current = phase;
  }, [phase, runtime]);
  useEffect(() => {
    if (drag.current && !active(drag.current.part)) cancel();
  }, [phase, auto]);
  function point(event: PointerEvent<SVGSVGElement>) {
    const matrix = svg.current?.getScreenCTM();
    return matrix
      ? new DOMPoint(event.clientX, event.clientY).matrixTransform(
          matrix.inverse(),
        )
      : null;
  }
  function down(event: PointerEvent<SVGSVGElement>) {
    if (drag.current || (event.pointerType === "mouse" && event.button !== 0))
      return;
    const part = (event.target as Element)
      .closest("[data-action]")
      ?.getAttribute("data-action") as Part | null;
    const p = point(event);
    if (!part || !p || !active(part)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      part,
      pointer: event.pointerId,
      x: p.x,
      y: p.y,
      lastX: p.x,
      lastY: p.y,
      angle: Math.atan2(p.y - VALVE.y, p.x - VALVE.x),
      phase,
    };
    setVisual({ ...drag.current });
    runtime.hint("");
    runtime.feedback("glass");
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const d = drag.current,
      p = point(event);
    if (!d || d.pointer !== event.pointerId || !p) return;
    const dx = p.x - d.lastX,
      dy = p.y - d.lastY;
    d.x = p.x;
    d.y = p.y;
    if (d.part === "valve" && Math.hypot(p.x - VALVE.x, p.y - VALVE.y) > 20) {
      const angle = Math.atan2(p.y - VALVE.y, p.x - VALVE.x);
      const delta = angleDelta(d.angle, angle);
      d.angle = angle;
      runtime.act({ type: "valve", amount: delta / BOTTLING.valveTravel });
      if (event.timeStamp - lastSound.current > 100 && Math.abs(delta) > 0.04) {
        runtime.feedback("click");
        lastSound.current = event.timeStamp;
      }
    }
    if (d.part === "carriage")
      runtime.act({ type: "transfer", amount: dx / TRAVEL });
    if (d.part === "lever") runtime.act({ type: "cap", amount: dy / 80 });
    d.lastX = p.x;
    d.lastY = p.y;
    setVisual({ ...d });
  }
  function finish(event: PointerEvent<SVGSVGElement>, aborted = false) {
    const d = drag.current;
    if (!d || d.pointer !== event.pointerId) return;
    const p = point(event) ?? d;
    cancel();
    if (aborted) return;
    if (d.part === "rack") {
      if (p.x >= 245 && p.x <= 347 && p.y >= 275 && p.y <= 424) {
        runtime.act({ type: "load" });
        runtime.feedback("glass");
      } else runtime.hint("Drop bottle in the filling bracket.");
    }
    if (d.part === "output") {
      if (p.x >= 565 && p.x <= 710 && p.y >= 325 && p.y <= 470) {
        runtime.act({ type: "collect" });
        runtime.feedback("glass");
      } else runtime.hint("Swipe into the right crate.");
    }
  }
  function key(event: KeyboardEvent, part: Part) {
    if (!active(part)) return;
    if (
      part === "valve" &&
      [
        "ArrowRight",
        "ArrowLeft",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    ) {
      event.preventDefault();
      runtime.act({
        type: "valve",
        amount:
          event.key === "Home"
            ? -1
            : event.key === "End"
              ? 1
              : ["ArrowRight", "ArrowUp"].includes(event.key)
                ? 0.1
                : -0.1,
      });
      return;
    }
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (part === "valve") {
        runtime.hint("Right opens; Left closes.");
        return;
      }
      runtime.act(
        part === "rack"
          ? { type: "load" }
          : part === "carriage"
            ? { type: "transfer", amount: 0.25 }
            : part === "lever"
              ? { type: "cap", amount: 1 }
              : { type: "collect" },
      );
      runtime.feedback("glass");
    }
  }
  const controls = (part: Part, label: string) => ({
    "data-action": part,
    role: "button",
    "aria-label": label,
    "aria-disabled": !active(part),
    tabIndex: active(part) ? 0 : -1,
    className: `machine-control ${active(part) ? "available" : ""}`,
    onKeyDown: (e: KeyboardEvent) => key(e, part),
  });
  const zone = (x: number, y: number, w = hit, h = hit) => (
    <rect
      x={x - w / 2}
      y={y - h / 2}
      width={w}
      height={h}
      fill="transparent"
      stroke="none"
    />
  );
  const slide =
    phase === "transfer"
      ? state.progress
      : ["cap", "collect"].includes(phase)
        ? 1
        : 0;
  const x =
    phase === "collect" && auto
      ? CAP_X + state.progress * 155
      : FILL_X + slide * TRAVEL;
  const pull = phase === "cap" ? state.progress : 0;
  const flowing = phase === "fill" && (b.valve > 0 || b.dripMs > 0);
  const angle = b.valve * BOTTLING.valveTravel * 180 / Math.PI;
  const sealed = phase === "collect";
  return (
    <div
      className="machine-scene bottler-scene"
      data-bottler-tier={state.tier}
      data-finish={tier(state).finish}
    >
      <svg
        ref={svg}
        viewBox="0 0 720 510"
        className="press-svg bottler-svg"
        aria-label="Interactive bottling machine. Drag a bottle, rotate valve, slide carriage, pull capper, swipe to crate. Tab and keyboard also operate active parts."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
        onLostPointerCapture={(e) => finish(e, true)}
      >
        <g stroke="var(--charcoal)" strokeWidth="3" strokeLinejoin="round">
          <BottlerFrame
            tierName={tier(state).name}
            variant={state.tier}
            pressure={b.valve}
          />
          <g data-part="rack">
            <path
              d="M35 402h132v24H35zm0-59h13v59m105-59h13v59"
              fill="var(--machine-shade)"
            />
            <g opacity=".7">
              <Bottle x={63} y={399} size="short" marks={false} />
              <Bottle x={100} y={399} marks={false} />
            </g>
            <path d="M35 386h132v8H35z" fill="var(--machine-paint)" />
          </g>
          <g
            {...controls(
              "rack",
              "Load bottle: drag to filling bracket, or press Enter",
            )}
          >
            <Bottle x={140} y={385} size={b.size} marks={false} />
            {zone(120, 345, Math.max(hit, 110), Math.max(hit, 120))}
          </g>
          <path d="M242 409h262v13H242z" fill="var(--frame)" />
          <path d="M249 415h247" stroke="var(--charcoal)" strokeWidth="3" />
          <g
            data-part="carriage"
            transform={`translate(${FILL_X + slide * TRAVEL} 0)`}
          >
            <path d="M-35 404h70v10h-70z" fill="var(--machine-shade)" />
            <path
              d="M-34 396v-21m68 21v-21"
              stroke="var(--orange)"
              strokeWidth="6"
            />
            <path d="M-25 416h50" strokeWidth="7" />
          </g>
          <BottlerHardware
            loader={owned("bottle-loader")}
            regulator={owned("flow-regulator")}
            capper={owned("auto-capper")}
            conveyor={owned("crate-conveyor")}
            phase={phase}
            progress={state.progress}
          />
          <g
            {...controls(
              "valve",
              "Flow valve: rotate clockwise to open, counterclockwise to close. Arrow Right opens; Arrow Left closes.",
            )}
          >
            <RotaryValve angle={angle} />
            {zone(418, 176, Math.max(hit, 116), Math.max(hit, 116))}
          </g>
          <g
            className={active("valve") ? "part-affordance" : ""}
            pointerEvents="none"
          >
            <path d="M384 111q27-12 52 0l-3-11m3 11-11 2" fill="none" />
            <text
              x="418"
              y="245"
              className="bottler-label"
              fontSize="15"
              textAnchor="middle"
            >
              {Math.round(b.valve * 100)}% OPEN
            </text>
          </g>
          {flowing && (
            <g data-part="flow" pointerEvents="none">
              <path
                d={`M295 292V${BASE_Y - 50}`}
                stroke="var(--liquid-edge)"
                strokeWidth={b.valve > 0 ? 3 + b.valve * 3 : 2}
                strokeDasharray={b.valve > 0 ? "8 3" : "2 12"}
                className="liquid-stream"
                opacity=".8"
              />
              {b.fill >= 1.05 && (
                <g className="liquid-splash" fill="var(--liquid)" stroke="none">
                  <path d="m264 340-8-11 3 14m68-3 9-12-3 17" />
                  <circle cx="251" cy="367" r="3" />
                  <circle cx="338" cy="382" r="3" />
                </g>
              )}
            </g>
          )}
          {phase !== "load" && visual?.part !== "output" && (
            <g
              {...controls(
                phase === "collect" ? "output" : "carriage",
                phase === "collect"
                  ? "Collect bottle: swipe into crate, or press Enter"
                  : "Carriage: close valve, then slide bottle right; Enter advances one quarter",
              )}
            >
              <Bottle
                x={x}
                y={BASE_Y}
                size={b.size}
                fill={b.fill}
                sealed={sealed}
              />
              {zone(x, BASE_Y - 50, hit, Math.max(hit, 115))}
            </g>
          )}
          {phase === "load" && auto && (
            <Bottle
              x={140 + (FILL_X - 140) * state.progress}
              y={385 + 16 * state.progress}
              size={b.size}
              marks={false}
            />
          )}
          {visual?.part === "rack" && (
            <g pointerEvents="none">
              <Bottle
                x={visual.x}
                y={visual.y + 45}
                size={b.size}
                marks={false}
              />
            </g>
          )}
          {visual?.part === "output" && (
            <g
              pointerEvents="none"
              transform={`rotate(${Math.max(-12, Math.min(15, (visual.x - CAP_X) / 15))} ${visual.x} ${visual.y})`}
            >
              <Bottle
                x={visual.x}
                y={visual.y + 45}
                size={b.size}
                fill={b.fill}
                sealed
              />
            </g>
          )}
          <g
            {...controls(
              "lever",
              "Capper lever: pull down to seal, or press Enter",
            )}
          >
            <Capper pull={pull} lever={pull} size={b.size} />
            {zone(582, 232 + pull * 65, hit, hit)}
          </g>
          <path
            d="m541 402 44 23h83"
            fill="none"
            stroke="var(--frame)"
            strokeWidth="9"
          />
          <g data-part="crate">
            <path
              d="m578 382 15-18h88l14 18v65H578z"
              fill="var(--machine-shade)"
            />
            <path d="M581 384h110v60H581z" fill="var(--machine-paint)" />
            <path
              d="M584 395h102m-102 34h102m-83-43v57m63-57v57"
              stroke="var(--machine-highlight)"
              strokeWidth="5"
            />
            <rect
              x="599"
              y="405"
              width="76"
              height="20"
              fill="var(--panel)"
              strokeWidth="1.5"
            />
            <text
              x="637"
              y="419"
              textAnchor="middle"
              className="bottler-label"
              fontSize="12"
            >
              COLLECTION / OUT
            </text>
            {state.bills > 0 && (
              <path
                d="M615 373v-19h13v19m22 0v-26h13v26"
                stroke="var(--liquid-edge)"
                strokeWidth="6"
              />
            )}
          </g>
          {impact > 0 && (
            <g key={impact} className="capper-impact" pointerEvents="none">
              <path
                d={`M${CAP_X - 40} ${BASE_Y - 130}l-10-7m60 7 10-7`}
                stroke="var(--orange)"
                strokeWidth="4"
              />
            </g>
          )}
          <text x="45" y="470" className="bottler-label" fontSize="11">
            BT–02 / GRAVITY ASSISTED
          </text>
          {active("rack") && (
            <path
              className="part-affordance"
              d="M185 348h57m-10-8 10 8-10 8"
              fill="none"
              strokeDasharray="5 4"
            />
          )}
          {active("carriage") && (
            <path
              className="part-affordance"
              d="M337 377h69m-11-8 11 8-11 8"
              fill="none"
              stroke="var(--orange)"
              strokeWidth="4"
            />
          )}
          {active("lever") && (
            <path
              className="part-affordance"
              d="M616 263v40m-8-10 8 10 8-10"
              fill="none"
              stroke="var(--orange)"
              strokeWidth="4"
            />
          )}
        </g>
      </svg>
      <div className="bottler-meter" aria-live="off">
        <span>
          {b.size.toUpperCase()} · {Math.round(BOTTLING.capacity[b.size] * 100)}
          %
        </span>
        <strong>{Math.round(b.fill * 100)}% FILL</strong>
        <span>
          {phase === "collect" || phase === "cap"
            ? `${b.regulated ? "REGULATED" : bottleQuality(b.fill).toUpperCase()} · ${money(bottlePayout(state))}`
            : "TARGET 95–100%"}
        </span>
      </div>
      {hint && (
        <div className="gesture-hint" role="status">
          {hint}
        </div>
      )}
    </div>
  );
}
