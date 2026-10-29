import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { automated, direction, earnings, tier } from '../game/machines';
import type { MachineInstance } from '../game/types';
import type { MachineRendererProps } from '../runtime/machine';
import { angleDelta, CRANK, inPlate, inTray, TAU, validStamp, recentDownSpeed, resistedHeadTravel, driveAngle } from '../game/gestures';
import { Frame, Head, Crank, Gear, Paper, Automation } from './press/Parts';
import { activePressPart, pressHeadTarget } from '../runtime/press';
import { useMechanicalMotion } from './press/useMechanicalMotion';

type Drag = { kind: 'paper' | 'crank' | 'head' | 'bill'; pointer: number; x: number; y: number; startY: number; lastY: number; time: number; peak: number; angle: number };
export function Press({ state, runtime, hint }: MachineRendererProps) {
  const { act: dispatch, feedback, hint: onHint } = runtime;
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [visual, setVisual] = useState<Drag | null>(null);
  const [rotation, setRotation] = useState(driveAngle(state.phase, state.bills, state.progress));
  const lastRatchet = useRef(0);
  const previous = useRef({ phase: state.phase, bills: state.bills });
  const [collected, setCollected] = useState(0);
  const [landing, setLanding] = useState<{x:number;y:number}|null>(null);
  const [impact, setImpact] = useState(0);
  const [hitSize, setHitSize] = useState(110);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      const scale = Math.min(width / 720, height / 510);
      if (scale > 0) setHitSize(Math.max(88, 44 / scale));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const auto = automated(state);
  const isTurning = state.phase === 'raise' || state.phase === 'lift';
  const headY = pressHeadTarget(state);
  const draggedHeadY = visual?.kind === 'head' ? Math.min(340, 208 + resistedHeadTravel(visual.y - visual.startY)) : headY;
  const directHead = visual?.kind === 'head' || (state.phase === 'lift' && state.progress === 0);
  const followedHead = useMechanicalMotion(draggedHeadY, directHead);
  const animatedHeadY = directHead ? draggedHeadY : followedHead;
  const wheelAngle = state.upgrades.includes('motor') ? driveAngle(state.phase, state.bills, state.progress) : rotation;
  useEffect(() => {
    if (previous.current.phase === 'stamp' && state.phase === 'lift') { setImpact(v=>v+1); feedback('stamp'); }
    if (state.bills > previous.current.bills) setCollected(v=>v+1);
    previous.current = { phase: state.phase, bills: state.bills };
  }, [state.phase, state.bills, runtime]);
  useEffect(() => { if (!landing) return; const id=setTimeout(()=>setLanding(null),220); return()=>clearTimeout(id); }, [landing]);
  const active = (kind: Drag['kind']) => activePressPart(state) === kind;
  const point = (event: ReactPointerEvent<SVGSVGElement>) => {
    const matrix = svg.current?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  };
  function down(event: ReactPointerEvent<SVGSVGElement>) {
    if (drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const kind = (event.target as Element).closest('[data-action]')?.getAttribute('data-action') as Drag['kind'] | undefined;
    const p = point(event);
    if (!kind || !active(kind) || !p) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const value: Drag = { kind, pointer: event.pointerId, x: p.x, y: p.y, startY: p.y, lastY: p.y, time: event.timeStamp, peak: 0, angle: Math.atan2(p.y - CRANK.y, p.x - CRANK.x) };
    drag.current = value; setVisual({ ...value }); onHint('');
    feedback('click');
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    const p = point(event);
    if (!d || d.pointer !== event.pointerId || !p) return;
    d.x = p.x; d.y = p.y;
    if (d.kind === 'crank' && Math.hypot(p.x - CRANK.x, p.y - CRANK.y) > 22) {
      const angle = Math.atan2(p.y - CRANK.y, p.x - CRANK.x);
      const delta = angleDelta(d.angle, angle);
      d.angle = angle;
      setRotation(value => value + delta * 180 / Math.PI);
      if (event.timeStamp-lastRatchet.current>65 && Math.abs(delta)>.035) { feedback('click'); lastRatchet.current=event.timeStamp; }
      if (active('crank')) dispatch({ type: 'turn', amount: delta * direction(state) / TAU });
    }
    if (d.kind === 'head') {
      const elapsed = event.timeStamp - d.time;
      if (elapsed > 0) d.peak = recentDownSpeed(d.peak, p.y - d.lastY, elapsed);
      d.lastY = p.y; d.time = event.timeStamp;
      if (validStamp(resistedHeadTravel(p.y - d.startY), d.peak) && state.phase === 'stamp') {
        dispatch({ type: 'stamp' });
        drag.current = null; setVisual(null); return;
      }
    }
    setVisual({ ...d });
  }
  function finish(event: ReactPointerEvent<SVGSVGElement>, cancel = false) {
    const d = drag.current;
    if (!d || d.pointer !== event.pointerId) return;
    const p = point(event) ?? d;
    drag.current = null; setVisual(null);
    if (cancel) return;
    if (d.kind === 'paper' && active('paper')) {
      if (inPlate(p.x, p.y)) { setLanding({x:p.x-58,y:p.y-26}); dispatch({ type: 'feed' }); feedback('click'); }
      else onHint('Drop paper on the plate.');
    }
    if (d.kind === 'bill' && active('bill')) {
      if (inTray(p.x, p.y)) dispatch({ type: 'collect' });
      else onHint('Drop bill in the right tray.');
    }
    if (d.kind === 'head' && state.phase === 'stamp') onHint('Pull down farther and faster.');
  }
  function keyboard(kind: Drag['kind']) {
    if (!active(kind)) return;
    if (kind === 'crank') { setRotation(value=>value+90*direction(state)); dispatch({ type: 'turn', amount: 0.25 }); }
    else if (kind === 'head') { dispatch({ type: 'stamp' }); }
    else dispatch({ type: kind === 'paper' ? 'feed' : 'collect' });
  }
  const controls = (kind: Drag['kind'], label: string, extraClass = '') => ({
    'data-action': kind, role: 'button', 'aria-label': label, 'aria-disabled': !active(kind), tabIndex: active(kind) ? 0 : -1,
    className: `machine-control ${active(kind) ? 'available' : ''} ${extraClass}`,
    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); keyboard(kind); } },
  });
  const owned = (id: MachineInstance['upgrades'][number]) => state.upgrades.includes(id);
  const bill = (x: number, y: number, printed = false) => <Paper x={x} y={y} printed={printed} value={earnings(state)} />;
  return <div className="machine-scene rebuilt-press" data-finish={tier(state).finish}>
    <svg ref={svg} viewBox="0 0 720 510" className="press-svg" aria-label="Interactive money press. Drag paper, rotate crank, pull head down quickly, collect bill. Tab and Enter also operate active parts."
      onPointerDown={down} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}>
      <g stroke="var(--charcoal)" strokeWidth="3" strokeLinejoin="round">
        <ellipse cx="357" cy="469" rx="321" ry="13" fill="var(--charcoal)" opacity=".12" stroke="none" />
        <g key={`frame-${impact}`} className={impact?'frame-impact':''}>
          <Frame tierName={tier(state).name}><Gear x={462} y={232} radius={26} angle={-wheelAngle*2} /><Gear x={505} y={272} radius={20} angle={wheelAngle*2.6} /></Frame>
          <Automation feeder={owned('feeder')} motor={owned('motor')} collector={owned('collector')} stamper={owned('stamper')} phase={state.phase} progress={state.progress} angle={wheelAngle} />
        </g>
        {state.phase !== 'feed' && state.phase !== 'collect' && <g transform="translate(291 383) scale(1 .2)">{bill(0,0,state.phase==='lift')}</g>}
        <g {...controls('head', 'Stamp paper: drag the raised head down quickly, or press Enter')}>
          <Head y={animatedHeadY} printing={owned('printing')}>
            <rect x={355-Math.max(176,hitSize)/2} y={32-Math.max(82,hitSize)/2} width={Math.max(176,hitSize)} height={Math.max(82,hitSize)} fill="transparent" stroke="none" />
            {active('head') && !visual && <path className="part-affordance" d="M355 65v27m-9-9 9 9 9-9" stroke="var(--orange)" strokeWidth="5" fill="none" />}
          </Head>
        </g>
        <g {...controls('crank', `Turn crank ${direction(state)===1?'clockwise':'counterclockwise'}; Enter turns one quarter`)}>
          <circle cx="556" cy="272" r="80" fill="transparent" stroke="none" />
          <Crank angle={wheelAngle} />
          {active('crank') && <g className="part-affordance" fill="none" stroke="var(--charcoal)" strokeWidth="3"><path d={direction(state)===1?'M529 182q32-12 57 8l-2-12m2 12-13 1':'M583 182q-32-12-57 8l2-12m-2 12 13 1'} /></g>}
          {isTurning && <text x="556" y="365" textAnchor="middle" fontSize="16" stroke="none" fill="var(--charcoal)" fontFamily="var(--heading)">{Math.round(state.progress*100)}%</text>}
        </g>
        <path d="M39 418h135v18H39z" fill="var(--steel-dark)" />
        <g {...controls('paper', 'Load blank paper: drag from the stack to the plate, or press Enter')}>
          <rect x={105-Math.max(156,hitSize)/2} y={380-Math.max(94,hitSize)/2} width={Math.max(156,hitSize)} height={Math.max(94,hitSize)} fill="transparent" stroke="none" />
          {[12,6,0].map(n=><g key={n}>{bill(49-n/4,353+n)}</g>)}
          {active('paper') && !visual && <path className="part-affordance" d="M178 379h64m-10-8 10 8-10 8" fill="none" stroke="var(--charcoal)" strokeWidth="3" strokeDasharray="5 4" />}
        </g>
        {auto && state.phase==='feed' && <g transform={`translate(${state.progress*239} ${state.progress*29})`}>{bill(52,353)}</g>}
        <g className={active('bill')?'tray-ready':''}>
          <path d="m545 408 13-29h118l14 29v29H545z" fill="var(--frame)" />
          {state.bills>0 && bill(558,380,true)}
          <path d="M545 409h145v28H545z" fill="var(--machine-paint, var(--mint))" /><rect x="569" y="417" width="99" height="13" fill="var(--panel)" strokeWidth="1.5" /><text x="618" y="427" fontSize="10" textAnchor="middle" fontFamily="var(--heading)" stroke="none" fill="var(--charcoal)">COLLECTION / OUT</text>
        </g>
        {state.phase==='collect' && visual?.kind!=='bill' && <g {...controls('bill', 'Collect finished bill: drag it into the right tray, or press Enter')} transform={auto?`translate(${state.progress*267} ${state.progress*30})`:undefined}>
          <rect x={351-Math.max(116,hitSize)/2} y={375.5-Math.max(53,hitSize)/2} width={Math.max(116,hitSize)} height={Math.max(53,hitSize)} fill="transparent" stroke="none" />{bill(293,349,true)}
        </g>}
        {visual && (visual.kind==='paper'||visual.kind==='bill') && <g pointerEvents="none" transform={`rotate(${Math.max(-9,Math.min(9,(visual.x-350)/30))} ${visual.x} ${visual.y})`}>{bill(visual.x-58,visual.y-26,visual.kind==='bill')}</g>}
        {landing && <g className="paper-landing" style={{'--paper-x':`${landing.x-291}px`,'--paper-y':`${landing.y-383}px`} as React.CSSProperties} pointerEvents="none">{bill(291,383)}</g>}
        {impact>0 && <g key={`dust-${impact}`} className="impact-dust" pointerEvents="none" fill="var(--paper)">{[[-70,-12],[-92,-32],[74,-16],[96,-38]].map(([x,y],i)=><path key={i} style={{'--dust-x':`${x}px`,'--dust-y':`${y}px`} as React.CSSProperties} d="M351 387h5v5h-5z" strokeWidth="1" />)}</g>}
        {collected>0 && <g key={`cash-${collected}`} className="bill-settle" pointerEvents="none">{bill(558,377,true)}</g>}
      </g>
    </svg>
    {hint && <div className="gesture-hint" role="status">{hint}</div>}
  </div>;
}
