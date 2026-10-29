import { UI } from '../config/ui';
import { useEffect, useRef, useState } from 'react';
import type { Dispatch, PointerEvent as ReactPointerEvent } from 'react';
import { feedback } from '../game/feedback';
import { slotPrice } from '../game/definitions';
import { automated, definition, earningsPerMinute, machineStatus, phaseLabel, tier } from '../game/machines';
import type { WorkshopAction, WorkshopState } from '../game/types';
import { MachineThumbnail } from './MachineThumbnail';
import { Icon } from './Icon';
import { Button, Pager, ScreenHeading, StatusLamp } from '../ui/Controls';
import { money, serial } from '../ui/format';
import { clampPage, gridLayout, pageCount, pageForSlot } from '../ui/pagination';
import { useElementSize } from '../ui/useElementSize';

interface DragState { id: string; pointer: number; startX: number; startY: number; x: number; y: number; ready: boolean; active: boolean; target: number | null }
export function Storage({ state, dispatch, onOpen, onShop, embedded = false, selectedId, onManage }: { embedded?: boolean; selectedId?: string; onManage?: () => void; state: WorkshopState; dispatch: Dispatch<WorkshopAction>; onOpen: (id: string) => void; onShop: () => void }) {
  const root = useRef<HTMLElement>(null);
  const drag = useRef<DragState | null>(null);
  const hold = useRef<number | undefined>(undefined);
  const pageHold = useRef<number | undefined>(undefined);
  const hoveredPage = useRef<number | null>(null);
  const focusId = useRef<string | null>(null);
  const [visual, setVisual] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [requestedPage, setPage] = useState(0);
  const { ref: grid, width, height } = useElementSize<HTMLDivElement>();
  const layout = gridLayout(width, height, embedded);
  const pages = pageCount(state.slots.length, layout.size);
  const page = clampPage(requestedPage, pages);
  const first = page * layout.size;
  const machines = new Map(state.machines.map((machine, index) => [machine.id, { machine, number: index + 1 }]));
  const cost = slotPrice(state.slots.length);
  function clearPageHold() {
    window.clearTimeout(pageHold.current);
    hoveredPage.current = null;
  }
  function clear() {
    window.clearTimeout(hold.current);
    clearPageHold();
    drag.current = null;
    setVisual(null);
  }
  useEffect(() => () => { window.clearTimeout(hold.current); window.clearTimeout(pageHold.current); }, []);
  useEffect(() => {
    // A viewport resize can change which bays are visible. Cancel transient dragging only.
    clear();
  }, [layout.size, layout.columns]);
  useEffect(() => {
    if (!focusId.current) return;
    const grip = [...(root.current?.querySelectorAll<HTMLButtonElement>('[data-reorder]') ?? [])].find(element => element.dataset.reorder === focusId.current);
    if (grip) { grip.focus(); focusId.current = null; }
  }, [state.slots, page, layout.size]);
  function changePage(next: number) {
    if (drag.current) { drag.current.target = null; setVisual({ ...drag.current }); }
    setPage(clampPage(next, pages));
  }
  function start(event: ReactPointerEvent<HTMLElement>) {
    const grip = (event.target as Element).closest<HTMLElement>('[data-reorder]');
    if (!grip || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const id = grip.dataset.reorder!;
    const value: DragState = { id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, ready: event.pointerType === 'mouse', active: false, target: state.slots.indexOf(id) };
    drag.current = value;
    // The screen owns capture, so removing the source bay during pagination is safe.
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!value.ready) hold.current = window.setTimeout(() => {
      if (drag.current !== value) return;
      value.ready = true; value.active = true; setVisual({ ...value });
      setAnnouncement('Machine picked up. Hold a page arrow to change pages.');
      feedback('pickup', false);
    }, UI.gestures.storageHoldMs);
  }
  function slotAt(x: number, y: number) {
    const slot = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot-index]');
    return slot && grid.current?.contains(slot) ? Number(slot.dataset.slotIndex) : null;
  }
  function move(event: ReactPointerEvent<HTMLElement>) {
    const value = drag.current;
    if (!value || value.pointer !== event.pointerId) return;
    value.x = event.clientX; value.y = event.clientY;
    const distance = Math.hypot(value.x - value.startX, value.y - value.startY);
    if (!value.ready) { if (distance > 12) clear(); return; }
    if (!value.active && distance < 5) return;
    event.preventDefault(); value.active = true;
    value.target = slotAt(value.x, value.y);
    const control = document.elementFromPoint(value.x, value.y)?.closest<HTMLElement>('[data-storage-page]');
    const targetPage = control && root.current?.contains(control) ? Number(control.dataset.storagePage) : null;
    if (targetPage !== hoveredPage.current) {
      clearPageHold();
      if (targetPage !== null && targetPage >= 0 && targetPage < pages) {
        hoveredPage.current = targetPage;
        pageHold.current = window.setTimeout(() => {
          if (drag.current !== value) return;
          value.target = null;
          setPage(targetPage);
          setVisual({ ...value });
          setAnnouncement(`Page ${targetPage + 1}. Drop into a bay.`);
        }, UI.gestures.pageHoldMs);
      }
    }
    setVisual({ ...value });
  }
  function finish(event: ReactPointerEvent<HTMLElement>, canceled = false) {
    const value = drag.current;
    if (!value || value.pointer !== event.pointerId) return;
    const target = slotAt(event.clientX, event.clientY);
    if (!canceled && value.active && target !== null) {
      dispatch({ type: 'move', machineId: value.id, to: target });
      setAnnouncement(`Machine moved to bay ${target + 1}.`);
    } else if (value.active) setAnnouncement('Move canceled.');
    clear();
  }
  const dragged = visual ? machines.get(visual.id) : undefined;
  return <section ref={root} className={`screen storage-screen ${embedded ? 'embedded-storage' : ''} ${visual?.active ? 'sorting' : ''}`} aria-label={embedded ? 'Workshop Storage' : 'Machine Storage'}
    onPointerDown={start} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
    onContextMenu={event => { if ((event.target as Element).closest('[data-reorder]')) event.preventDefault(); }}>
    <ScreenHeading title="Storage" code={`${state.machines.length} OCCUPIED / ${state.slots.length} BAYS`}>{embedded ? <Button onClick={onManage} aria-label="Open full Storage">All bays</Button> : <span className="storage-hint">{visual?.active ? 'Hold arrow to turn page' : 'Hold grip to move'}</span>}</ScreenHeading>
    <div ref={grid} className={`storage-grid ${layout.compact ? 'compact-bays' : ''}`} style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))` }}>
      {state.slots.slice(first, first + layout.size).map((id, offset) => {
        const index = first + offset;
        const entry = id ? machines.get(id) : undefined;
        const name = entry ? `${tier(entry.machine).name} #${entry.number}` : '';
        const estimate = entry ? earningsPerMinute(entry.machine) : 0;
        return <div key={index} data-slot-index={index} className={`storage-bay ${visual?.target === index && visual.active ? 'drop-target' : ''}`}>
          {entry ? <article className={`machine-card ${visual?.id === id && visual.active ? 'being-moved' : ''}`}>
            <header className="bay-heading"><span>BAY {serial(index + 1)}</span><button className="reorder-grip" data-reorder={id} aria-label={`Move ${name}; use arrow keys to change slots`} title="Drag to move. Touch: hold grip. Keyboard: arrow keys." onKeyDown={event => {
              const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? layout.columns : event.key === 'ArrowUp' ? -layout.columns : 0;
              if (!delta) return;
              event.preventDefault(); const to = index + delta;
              if (to >= 0 && to < state.slots.length) {
                focusId.current = entry.machine.id;
                dispatch({ type: 'move', machineId: entry.machine.id, to });
                changePage(pageForSlot(to, layout.size));
                setAnnouncement(`${name} moved to bay ${to + 1}.`);
              }
            }}><Icon name="grip" size={19} /></button></header>
            <button className="machine-open" aria-pressed={selectedId === entry.machine.id} onClick={() => onOpen(entry.machine.id)} aria-label={`Operate ${name}`}>
              <div className="bay-illustration"><MachineThumbnail type={entry.machine.type} finish={tier(entry.machine).finish} /></div>
              <span className="machine-nameplate"><span className="equipment-label">{definition(entry.machine).model} / {serial(entry.number)}</span><strong>{tier(entry.machine).name}</strong></span>
              <StatusLamp running={automated(entry.machine)}>{machineStatus(entry.machine)}</StatusLamp>
              <span className="bay-phase">{phaseLabel[entry.machine.phase]} <span>{Math.round(entry.machine.progress * 100)}%</span></span>
              <span className="machine-progress"><span style={{ width: `${entry.machine.progress * 100}%` }} /></span>
              <span className="bay-output">{estimate > 0 ? `~${money(Math.round(estimate))}/min` : `${entry.machine.upgrades.length} modifications`}</span>
            </button>
          </article> : <button className="empty-bay" onClick={onShop} aria-label={`Buy a machine for empty slot ${index + 1}`}><span className="bay-empty-label">BAY {serial(index + 1)}</span><Icon name="plus" size={32} /><strong>Unoccupied</strong><span>Open catalog</span></button>}
        </div>;
      })}
    </div>
    <footer className="screen-footer"><Button className="add-bay-control" disabled={state.cash < cost || !Number.isSafeInteger(cost)} onClick={() => dispatch({ type: 'buy-slot' })} aria-label={`Unlock storage slot for ${money(cost)}`}><Icon name="plus" size={16} /><span>Add bay</span><strong>{money(cost)}</strong></Button><Pager page={page} pages={pages} onChange={changePage} dragPages /></footer>
    <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    {dragged && visual?.active && <div className="drag-ghost" style={{ left: visual.x, top: visual.y }} aria-hidden="true"><MachineThumbnail type={dragged.machine.type} finish={tier(dragged.machine).finish} /><strong>{definition(dragged.machine).model} / {serial(dragged.number)}</strong></div>}
  </section>;
}
