import { useRef, useState } from 'react';
import type { Dispatch, PointerEvent as ReactPointerEvent } from 'react';
import { automated, direction, earnings } from '../game/machines';
import type { ManualAction, MachineInstance } from '../game/types';
import { angleDelta, CRANK, inPlate, inTray, TAU, validStamp } from '../game/gestures';
import { feedback } from '../game/feedback';

type Drag = { kind: 'paper' | 'crank' | 'head' | 'bill'; pointer: number; x: number; y: number; startY: number; lastY: number; time: number; peak: number; angle: number };
export function Press({ state, dispatch, sound, hint, onHint }: { state: MachineInstance; dispatch: Dispatch<ManualAction>; sound: boolean; hint: string; onHint: (text: string) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [visual, setVisual] = useState<Drag | null>(null);
  const [rotation, setRotation] = useState(0);
  const [impact, setImpact] = useState(0);
  const auto = automated(state);
  const isTurning = state.phase === 'raise' || state.phase === 'lift';
  const headY = state.phase === 'stamp' ? 208 + (auto ? state.progress * 132 : 0) : state.phase === 'collect' ? 208 : isTurning ? 340 - state.progress * 132 : 340;
  const draggedHeadY = visual?.kind === 'head' ? Math.min(340, 208 + Math.max(0, visual.y - visual.startY)) : headY;
  const active = (kind: Drag['kind']) => !auto && (kind === 'paper' ? state.phase === 'feed' : kind === 'crank' ? isTurning : kind === 'head' ? state.phase === 'stamp' : state.phase === 'collect');
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
    feedback('click', sound);
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
      if (active('crank')) dispatch({ type: 'turn', amount: delta * direction(state) / TAU });
    }
    if (d.kind === 'head') {
      const elapsed = event.timeStamp - d.time;
      if (elapsed > 0) d.peak = Math.max(d.peak, (p.y - d.lastY) / elapsed);
      d.lastY = p.y; d.time = event.timeStamp;
      if (validStamp(p.y - d.startY, d.peak) && state.phase === 'stamp') {
        dispatch({ type: 'stamp' }); setImpact(value => value + 1); feedback('stamp', sound);
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
      if (inPlate(p.x, p.y)) { dispatch({ type: 'feed' }); feedback('click', sound); }
      else onHint('Drop the paper on the center plate.');
    }
    if (d.kind === 'bill' && active('bill')) {
      if (inTray(p.x, p.y)) dispatch({ type: 'collect' });
      else onHint('Drop the printed bill in the tray on the right.');
    }
    if (d.kind === 'head' && state.phase === 'stamp') onHint('Pull farther and faster — give it a good stamp!');
  }
  function keyboard(kind: Drag['kind']) {
    if (!active(kind)) return;
    if (kind === 'crank') dispatch({ type: 'turn', amount: 0.25 });
    else if (kind === 'head') { dispatch({ type: 'stamp' }); setImpact(value => value + 1); feedback('stamp', sound); }
    else dispatch({ type: kind === 'paper' ? 'feed' : 'collect' });
  }
  const controls = (kind: Drag['kind'], label: string, extraClass = '') => ({
    'data-action': kind, role: 'button', 'aria-label': label, 'aria-disabled': !active(kind), tabIndex: active(kind) ? 0 : -1,
    className: `machine-control ${active(kind) ? 'available' : ''} ${extraClass}`,
    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); keyboard(kind); } },
  });
  const bill = (x: number, y: number, printed = false) => <g transform={`translate(${x} ${y})`}>
    <rect width="116" height="53" rx="3" fill={printed ? '#c5dc91' : '#b9c99b'} stroke="#547253" strokeWidth="2" />
    <rect x="7" y="7" width="102" height="39" rx="2" fill="none" stroke={printed ? '#5e8152' : '#9eb386'} strokeWidth="1.5" />
    {printed && <><ellipse cx="58" cy="26.5" rx="17" ry="19" fill="#a9c67b" stroke="#63884e" /><text x="58" y="34" textAnchor="middle" fill="#406346" fontSize="24" fontWeight="bold">$</text><text x="17" y="35" fill="#406346" fontSize="16" fontWeight="bold">{earnings(state)}</text><text x="89" y="35" fill="#406346" fontSize="16" fontWeight="bold">{earnings(state)}</text><path d="M31 17v19m54-19v19" stroke="#7c9c62" /></>}
  </g>;
  return <div className="machine-scene">
    <svg ref={svg} viewBox="0 0 720 510" className={`press-svg ${state.phase === 'lift' && impact ? 'struck' : ''}`} aria-label="Interactive money press. Drag paper, turn the crank, pull the head, and collect the bill. Keyboard: Tab to an active part, then Enter or Space."
      onPointerDown={down} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}>
      <defs>
        <linearGradient id="iron" x1="0" x2="1"><stop stopColor="#607b6e" /><stop offset=".28" stopColor="#8ca38b" /><stop offset=".65" stopColor="#6e8979" /><stop offset="1" stopColor="#3e5a50" /></linearGradient>
        <linearGradient id="steel"><stop stopColor="#737f78" /><stop offset=".4" stopColor="#e2e4d5" /><stop offset=".62" stopColor="#aab4a7" /><stop offset="1" stopColor="#67796b" /></linearGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#bca384" /><stop offset="1" stopColor="#9b8066" /></linearGradient>
        <pattern id="hatch" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="18" fill="#37443a" /><rect x="9" width="9" height="18" fill="#c6b56c" /></pattern>
        <filter id="shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#253e32" floodOpacity=".16" /></filter>
      </defs>
      <g className="workshop-backdrop" fill="none" stroke="#d8ddd0">
        <path d="M0 126h720M0 248h720M0 370h720M94 0v126m184 0v122m183-248v126m177 0v122M94 248v122m367-122v122" />
        <rect x="34" y="74" width="118" height="88" rx="4" /><path d="M43 84h100v12H43zM57 101v43m29-43v34m28-34v43M50 123h14m15-7h14m14 7h14" />
      </g>
      <g transform="translate(580 90) rotate(5)"><rect width="91" height="62" fill="#e8e3cb" stroke="#c9c5af" /><path d="M31 1h31" stroke="#bcb89b" strokeWidth="8" /><text x="45" y="27" textAnchor="middle" fill="#797c65" fontSize="9" fontWeight="bold" letterSpacing="1">WORK SMART.</text><text x="45" y="43" textAnchor="middle" fill="#797c65" fontSize="9" fontWeight="bold" letterSpacing="1">THEN LESS.</text></g>
      <ellipse cx="367" cy="460" rx="310" ry="20" fill="#2f4230" opacity=".07" />
      <path d="M17 428H703v20H17z" fill="url(#wood)" stroke="#8d785f" strokeWidth="2" /><path d="M17 432h686M32 440h199m250 0h188" stroke="#d1b899" />
      <path d="M41 448h26l-6 62H44zm612 0h26l-2 62h-18z" fill="#758174" /><path d="M67 470h586" stroke="#9aa18c" strokeWidth="8" />
      <g filter="url(#shadow)">
        <path d="M229 410h255l10 18H219z" fill="#39584b" stroke="#2f4c40" strokeWidth="2" />
        <rect x="242" y="134" width="29" height="275" rx="4" fill="url(#iron)" stroke="#3a594d" strokeWidth="2" />
        <rect x="443" y="134" width="29" height="275" rx="4" fill="url(#iron)" stroke="#3a594d" strokeWidth="2" />
        <path d="M252 150v246m201-246v246" stroke="#c0c8a6" strokeWidth="3" opacity=".5" />
        <rect x="317" y="133" width="78" height="75" rx="4" fill="#486656" />
        <rect x="342" y="144" width="27" height={Math.max(42, draggedHeadY - 140)} fill="url(#steel)" stroke="#5c7160" />
        {Array.from({ length: 13 }, (_, i) => <path key={i} d={`m343 ${152 + i * 13} 25 -6`} stroke="#536d57" strokeWidth="2" opacity={152 + i * 13 < draggedHeadY ? 0.65 : 0} />)}
        <path d="M221 96h266v49H221z" fill="url(#iron)" stroke="#375446" strokeWidth="3" />
        <path d="M222 97h264v9H222z" fill="#a9b598" /><rect x="289" y="111" width="128" height="23" rx="2" fill="#334c40" stroke="#a5b096" />
        <text x="353" y="127" textAnchor="middle" fill="#d8dfbf" fontSize="11" fontWeight="bold" letterSpacing="3">MP—01</text>
        {[234, 474].map(x => <g key={x}><circle cx={x} cy="121" r="5" fill="#304c3f" /><path d={`m${x - 3} 121h6`} stroke="#93a58a" /></g>)}
        <path d="M267 397h176v16H267z" fill="url(#steel)" stroke="#4f6556" strokeWidth="2" />
        <path d="M272 414h167v9H272z" fill="url(#hatch)" />
        {state.phase !== 'feed' && state.phase !== 'collect' && <g className="loaded-paper" transform="translate(291 383) scale(1 .2)">{bill(0, 0, state.phase === 'lift')}</g>}
        <g transform={`translate(0 ${draggedHeadY})`} {...controls('head', 'Stamp paper: drag the raised head down quickly, or press Enter', `press-head ${visual?.kind === 'head' ? 'dragging' : ''}`)}>
          <rect x="267" y="-9" width="176" height="82" rx="8" fill="transparent" />
          <path d="M279 0h153l9 35H270z" fill="url(#iron)" stroke="#345141" strokeWidth="3" />
          <path d="M274 35h164v10H274z" fill="#2d473b" /><path d="M285 8h140" stroke="#aec19e" strokeWidth="3" />
          <rect x="326" y="15" width="58" height="15" rx="3" fill="#2d483b" /><path d="M337 45v12h36V45" fill="none" stroke="#384e3e" strokeWidth="9" />
          {state.phase === 'stamp' && <><path className="stamp-arrow" d="M354 84v28m-10-10 10 10 10-10" fill="none" stroke="#d46d3d" strokeWidth="5" strokeLinecap="round" /></>}
        </g>
        <path d="M472 263h83v18h-83z" fill="url(#steel)" stroke="#4f6656" strokeWidth="2" />
      </g>
      <g {...controls('crank', `Turn crank ${direction(state) === 1 ? 'clockwise' : 'counterclockwise'}; Enter turns one quarter`)}>
        <circle cx="556" cy="272" r="77" fill="transparent" />
        {isTurning && !auto && <circle cx="556" cy="272" r="75" fill="none" stroke="#d6814b" strokeWidth="2" strokeDasharray="4 7" className="target-ring" />}
        <g transform={`rotate(${auto && isTurning ? state.progress * 360 * direction(state) : rotation} 556 272)`}>
          <circle cx="556" cy="272" r="58" fill="#e0e2d3" stroke="#344e40" strokeWidth="9" />
          <circle cx="556" cy="272" r="49" fill="#d5d9c8" stroke="#8d9d85" strokeWidth="2" />
          <path d="M556 217v110m-48-83 96 56m-96 0 96-56" stroke="#607965" strokeWidth="10" />
          <circle cx="556" cy="272" r="18" fill="url(#steel)" stroke="#3a5443" strokeWidth="3" />
          <circle cx="556" cy="272" r="7" fill="#405c49" />
          <rect x="597" y="247" width="20" height="45" rx="9" fill="#bc754d" stroke="#744b34" strokeWidth="3" /><path d="M604 253v31" stroke="#e0a16e" strokeWidth="3" strokeLinecap="round" />
        </g>
        {isTurning && <text x="556" y="375" textAnchor="middle" fontSize="24" fill="#9c683f">{direction(state) === 1 ? '↻' : '↺'} <tspan fontSize="12" fontWeight="bold">{Math.round(state.progress * 100)}%</tspan></text>}
      </g>
      <g {...controls('paper', 'Load blank paper: drag from the stack to the plate, or press Enter')}>
        <rect x="27" y="333" width="156" height="94" rx="10" fill="transparent" />
        {[7, 3, 0].map(n => <g key={n}>{bill(49 - n / 2, 365 + n)}</g>)}
        {visual?.kind !== 'paper' && bill(51, 353)}
        {state.phase === 'feed' && !auto && <path className="feed-guide" d="M183 373q40-30 78 0m-10-12 10 12-15 3" fill="none" stroke="#bd8657" strokeWidth="2" strokeDasharray="5 4" />}
      </g>
      <g className={state.phase === 'collect' ? 'collection-ready' : ''}>
        <rect x="542" y="400" width="149" height="30" rx="4" fill="#9aa18e" stroke="#6b7b66" strokeWidth="2" />
        <path d="m549 400 9-21h118l9 21" fill="#b9c0a8" stroke="#7f8d76" strokeWidth="2" />
        {state.bills > 0 && <>{bill(559, 378, true)}<path d="M545 407h144v23H545z" fill="#919f84" stroke="#6b7b66" strokeWidth="2" /></>}
        <rect x="577" y="411" width="78" height="13" rx="2" fill="#e1dfc8" /><text x="616" y="421" textAnchor="middle" fontSize="8" fill="#58634e" fontWeight="bold" letterSpacing="1">COLLECTION</text>
        {state.phase === 'collect' && <rect x="535" y="365" width="165" height="72" rx="8" fill="none" stroke="#a0b86d" strokeWidth="2" strokeDasharray="6 5" />}
      </g>
      {state.phase === 'collect' && visual?.kind !== 'bill' && <g {...controls('bill', 'Collect finished bill: drag it into the right tray, or press Enter')}>{bill(293, 349, true)}</g>}
      {visual?.kind === 'paper' && <g pointerEvents="none" filter="url(#shadow)">{bill(visual.x - 58, visual.y - 26)}</g>}
      {visual?.kind === 'bill' && <g pointerEvents="none" filter="url(#shadow)">{bill(visual.x - 58, visual.y - 26, true)}</g>}
      {state.phase === 'lift' && impact > 0 && <g key={impact} className="stamp-burst" stroke="#d5a055" strokeWidth="3"><path d="m272 381-22-12m18 22h-29m206-10 22-12m-18 22h29" /></g>}
      <text x="108" y="477" textAnchor="middle" className="scene-label">PAPER SUPPLY</text>
      <text x="353" y="477" textAnchor="middle" className="scene-label">MONEY PRESS / MK. I</text>
      <text x="616" y="477" textAnchor="middle" className="scene-label">THE PAYDAY</text>
    </svg>
    {hint && <div className="gesture-hint" role="status">{hint}</div>}
  </div>;
}
