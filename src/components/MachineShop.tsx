import { machinePrice, storagePrice } from "../game/service/stats";
import { useState } from 'react';
import type { Dispatch } from 'react';
import { MACHINE_DEFINITIONS } from '../game/definitions';
import type { WorkshopAction, WorkshopState } from '../game/types';
import { MachineThumbnail } from './MachineThumbnail';
import { newMachineId } from '../game/machines';
import { Button, Pager, ScreenHeading } from '../ui/Controls';
import { money, serial } from '../ui/format';
import { clampPage } from '../ui/pagination';

export function MachineShop({ state, dispatch }: { state: WorkshopState; dispatch: Dispatch<WorkshopAction> }) {
  const [requestedPage, setPage] = useState(0);
  const entries = Object.values(MACHINE_DEFINITIONS);
  const page = clampPage(requestedPage, entries.length);
  const config = entries[page];
  const free = state.slots.filter(id => id === null).length;
  const price=machinePrice(config.type,state.service);
  const cost = storagePrice(state);
  return <section className="screen catalog-screen" aria-label="Catalog">
    <ScreenHeading title="Catalog" code="INDUSTRIAL EQUIPMENT"><span className="capacity-plate">{free} FREE {free === 1 ? 'BAY' : 'BAYS'}</span></ScreenHeading>
    <article className="catalog-entry">
      <div className="catalog-entry-heading"><span className="catalog-number">{serial(page + 1)}</span><div><span className="equipment-label">MODEL {config.model}</span><h2>{config.name}</h2></div><span className="owned-label">{state.machines.filter(machine => machine.type === config.type).length} OWNED</span></div>
      <div className="catalog-illustration"><span className="catalog-watermark" aria-hidden="true">{config.model}</span><MachineThumbnail type={config.type} /><span className="inspection-stamp">CONDITION: OPERABLE</span></div>
      <div className="catalog-spec"><span>OUTPUT<strong>{money(config.tiers[0].baseEarnings)} / {config.unit}</strong></span><span>OPERATION<strong>Manual</strong></span><span>SUPPLIED<strong>{config.tiers[0].name}</strong></span></div>
      <div className="catalog-purchase"><div><span className="equipment-label">UNIT PRICE</span><strong>{money(price)}</strong></div><Button data-feedback="buy" tone="primary" disabled={free === 0 || state.cash < price} onClick={() => dispatch({ type: 'buy-machine', machineType: config.type, id: newMachineId() })} aria-label={`Buy ${config.name} for ${money(price)}`}>{free === 0 ? 'No free bays' : state.cash < price ? `Need ${money(price - state.cash)}` : 'Purchase machine'}<span>{money(price)}</span></Button></div>
    </article>
    <footer className="screen-footer"><div className="capacity-control"><span>{state.machines.length}/{state.slots.length} BAYS</span><Button data-feedback="buy" disabled={state.cash < cost || !Number.isSafeInteger(cost)} onClick={() => dispatch({ type: 'buy-slot' })} aria-label={`Unlock storage slot for ${money(cost)}`}>Add bay <strong>{money(cost)}</strong></Button></div><Pager page={page} pages={entries.length} onChange={setPage} /></footer>
  </section>;
}
