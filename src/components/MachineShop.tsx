import type { Dispatch } from 'react';
import { MACHINE_DEFINITIONS, slotPrice } from '../game/definitions';
import type { WorkshopAction, WorkshopState } from '../game/types';
import { MachineThumbnail } from './MachineThumbnail';
import { Icon } from './Icon';
import { newMachineId } from '../game/machines';

const money = (value: number) => '$' + value.toLocaleString('en-US');
export function MachineShop({ state, dispatch, onStorage }: { state: WorkshopState; dispatch: Dispatch<WorkshopAction>; onStorage: () => void }) {
  const free = state.slots.filter(id => id === null).length;
  const cost = slotPrice(state.slots.length);
  return <section className="shop-panel" aria-label="Machine Shop"><div className="section-heading"><div><div className="eyebrow">MAKE ROOM FOR MORE</div><h2>Machine Shop</h2><p>{free} available {free === 1 ? 'slot' : 'slots'} · {state.machines.length}/{state.slots.length} occupied</p></div><button className="outline-button" onClick={onStorage}>← Storage</button></div>
    <div className="shop-grid">{Object.values(MACHINE_DEFINITIONS).map(config => <article className="shop-card" key={config.type}><span className="slot-label">WORKSHOP CLASSIC</span><MachineThumbnail /><h3>{config.name}</h3><p>A fresh press with its own upgrades and production cycle. Buy as many as your floor can hold.</p><div className="shop-spec"><span>{money(config.baseEarnings)} per bill</span><span>{state.machines.filter(machine => machine.type === config.type).length} owned</span></div><button className={`purchase ${free > 0 && state.cash >= config.price ? 'can-buy' : ''}`} disabled={free === 0 || state.cash < config.price} onClick={() => dispatch({ type: 'buy-machine', machineType: config.type, id: newMachineId() })} aria-label={`Buy ${config.name} for ${money(config.price)}`}><span>{money(config.price)}</span><span>{free === 0 ? 'Storage full' : state.cash < config.price ? `${money(config.price - state.cash)} to go` : 'Buy machine +'}</span></button><p className="shop-note">Purchases fill the first empty slot. New machines start without upgrades.</p></article>)}</div>
    <div className="capacity-banner"><span className="capacity-icon"><Icon name="collect" size={28} /></span><div><h3>{free === 0 ? 'Your floor is full.' : 'A little extra space.'}</h3><p>Add a storage slot for {money(cost)}. The next slot costs {money(slotPrice(state.slots.length + 1))}.</p></div><button className="solid-button" disabled={state.cash < cost || !Number.isSafeInteger(cost)} onClick={() => dispatch({ type: 'buy-slot' })} aria-label={`Unlock storage slot for ${money(cost)}`}>Unlock slot <span>{money(cost)}</span></button></div>
  </section>;
}
