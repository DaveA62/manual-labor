import { useEffect, useRef, useState } from 'react';
import type { Dispatch, PointerEvent as ReactPointerEvent } from 'react';
import { slotPrice } from '../game/definitions';
import { automated, definition, earningsPerMinute, machineStatus, phaseLabel } from '../game/machines';
import type { WorkshopAction, WorkshopState } from '../game/types';
import { MachineThumbnail } from './MachineThumbnail';
import { Icon } from './Icon';

interface DragState { id: string; pointer: number; startX: number; startY: number; x: number; y: number; ready: boolean; active: boolean; target: number | null }
const money = (value: number) => '$' + value.toLocaleString('en-US');
export function Storage({ state, dispatch, onOpen, onShop }: { state: WorkshopState; dispatch: Dispatch<WorkshopAction>; onOpen: (id: string) => void; onShop: () => void }) {
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const hold = useRef<number | undefined>(undefined);
  const focusId = useRef<string | null>(null);
  const [visual, setVisual] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const machines = new Map(state.machines.map((machine, index) => [machine.id, { machine, number: index + 1 }]));
  const free = state.slots.filter(id => id === null).length;
  const cost = slotPrice(state.slots.length);
  function clear() {
    window.clearTimeout(hold.current);
    drag.current = null;
    setVisual(null);
  }
  useEffect(() => () => window.clearTimeout(hold.current), []);
  useEffect(() => {
    if (!focusId.current) return;
    const grip = [...(grid.current?.querySelectorAll<HTMLButtonElement>('[data-reorder]') ?? [])].find(element => element.dataset.reorder === focusId.current);
    grip?.focus();
    focusId.current = null;
  }, [state.slots]);
  function start(event: ReactPointerEvent<HTMLDivElement>) {
    const grip = (event.target as Element).closest<HTMLElement>('[data-reorder]');
    if (!grip || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const id = grip.dataset.reorder!;
    const target = state.slots.indexOf(id);
    const value: DragState = { id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, ready: event.pointerType === 'mouse', active: false, target };
    drag.current = value;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!value.ready) hold.current = window.setTimeout(() => {
      if (drag.current !== value) return;
      value.ready = true; value.active = true; setVisual({ ...value });
      setAnnouncement('Machine picked up. Drag to another unlocked slot.');
      if (typeof navigator.vibrate === 'function') navigator.vibrate(12);
    }, 430);
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const value = drag.current;
    if (!value || value.pointer !== event.pointerId) return;
    value.x = event.clientX; value.y = event.clientY;
    const distance = Math.hypot(value.x - value.startX, value.y - value.startY);
    if (!value.ready) { if (distance > 12) clear(); return; }
    if (!value.active && distance < 5) return;
    event.preventDefault(); value.active = true;
    if (event.clientY < 90) window.scrollBy(0, -16);
    else if (event.clientY > window.innerHeight - 70) window.scrollBy(0, 16);
    const slot = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot-index]');
    value.target = slot && grid.current?.contains(slot) ? Number(slot.dataset.slotIndex) : null;
    setVisual({ ...value });
  }
  function finish(event: ReactPointerEvent<HTMLDivElement>, canceled = false) {
    const value = drag.current;
    if (!value || value.pointer !== event.pointerId) return;
    if (!canceled && value.active && value.target !== null) {
      dispatch({ type: 'move', machineId: value.id, to: value.target });
      setAnnouncement(`Machine moved to slot ${value.target + 1}.`);
    } else if (value.active) setAnnouncement('Move canceled. Production continues.');
    clear();
  }
  const dragged = visual ? machines.get(visual.id) : undefined;
  return <section className="storage-panel" aria-label="Machine Storage">
    <div className="section-heading"><div><div className="eyebrow">EVERY SLOT IS A WORKING MACHINE</div><h2>Storage</h2><p>{state.machines.length} machines · {free} free of {state.slots.length} slots</p></div><button className="solid-button" onClick={onShop}>Machine Shop <span>↗</span></button></div>
    <p className="storage-help">Tap a press to operate. Drag its grip to rearrange; on touch, hold the grip first. All stored machines keep working.</p>
    <div ref={grid} className={`storage-grid ${visual?.active ? 'sorting' : ''}`} onPointerDown={start} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)} onContextMenu={event => { if ((event.target as Element).closest('[data-reorder]')) event.preventDefault(); }}>
      {state.slots.map((id, index) => {
        const entry = id ? machines.get(id) : undefined;
        const running = entry && automated(entry.machine);
        const status = entry ? machineStatus(entry.machine) : '';
        const estimate = entry ? earningsPerMinute(entry.machine) : 0;
        const name = entry ? `${definition(entry.machine).name} #${entry.number}` : '';
        return <div key={index} data-slot-index={index} className={`storage-slot ${visual?.target === index && visual.active ? 'drop-target' : ''}`}>
          {entry ? <article className={`machine-card ${visual?.id === id && visual.active ? 'being-moved' : ''}`}>
            <div className="machine-card-top"><span className="slot-label">SLOT {String(index + 1).padStart(2, '0')}</span><button className="reorder-grip" data-reorder={id} aria-label={`Move ${name}; use arrow keys to change slots`} title="Drag to move. On touch, hold first. Keyboard: arrow keys." onClick={event => event.stopPropagation()} onKeyDown={event => {
              const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
              if (!delta) return;
              event.preventDefault(); const to = index + delta;
              if (to >= 0 && to < state.slots.length) { focusId.current = entry.machine.id; dispatch({ type: 'move', machineId: entry.machine.id, to }); setAnnouncement(`${name} moved to slot ${to + 1}.`); }
            }}><span aria-hidden="true">⠿</span></button></div>
            <button className="machine-open" onClick={() => onOpen(entry.machine.id)} aria-label={`Operate ${name}`}>
              <MachineThumbnail /><h3>{name}</h3>
              <span className={`machine-status ${running ? 'running' : 'needs-input'}`}><span className="production-dot" />{status}</span>
              <span className="card-phase">{phaseLabel[entry.machine.phase]} · {Math.round(entry.machine.progress * 100)}%</span>
              <span className="machine-progress"><span style={{ width: `${entry.machine.progress * 100}%` }} /></span>
              <span className="card-bottom"><span>{money(entry.machine.lifetime)} earned</span><span>{estimate > 0 ? `~${money(Math.round(estimate))}/min` : `${entry.machine.upgrades.length} upgrades`}</span></span>
            </button>
          </article> : <button className="empty-slot" onClick={onShop} aria-label={`Buy a machine for empty slot ${index + 1}`}><span className="slot-label">SLOT {String(index + 1).padStart(2, '0')}</span><span className="empty-plus">+</span><strong>Room to grow.</strong><span>Get a machine ↗</span></button>}
        </div>;
      })}
      <div className="storage-expansion"><span className="slot-label">EXPAND YOUR FLOOR</span><Icon name="collect" size={30} /><h3>One more spot.</h3><p>Any machine. Always operating.</p><button className="purchase" disabled={state.cash < cost || !Number.isSafeInteger(cost)} onClick={() => dispatch({ type: 'buy-slot' })} aria-label={`Unlock storage slot for ${money(cost)}`}><span>{money(cost)}</span><span>Unlock slot +</span></button></div>
    </div>
    <p className="storage-keyboard-note">Keyboard: focus a grip and use the arrow keys to move a machine. Swapping slots preserves every press’s progress.</p>
    <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    {dragged && visual?.active && <div className="drag-ghost" style={{ left: visual.x, top: visual.y }} aria-hidden="true"><MachineThumbnail /><strong>Money Press #{dragged.number}</strong><span>Drop into an unlocked slot</span></div>}
  </section>;
}
