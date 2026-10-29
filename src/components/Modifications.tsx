import type { ServiceProgress } from "../game/service/types";
import { useState } from 'react';
import { UI } from '../config/ui';
import type { ComponentProps, Dispatch } from 'react';
import { canRefit, definition, nextTier, tier, upgradePrice, refitPrice } from '../game/machines';
import { feedback } from '../game/feedback';
import type { MachineInstance, WorkshopAction } from '../game/types';
import { Button, DialogPanel, Pager } from '../ui/Controls';
import { money, serial } from '../ui/format';
import { useElementSize } from '../ui/useElementSize';
import { clampPage, pageCount } from '../ui/pagination';
import { Icon } from './Icon';

function MaintenanceFrame({ inline, ...props }: ComponentProps<typeof DialogPanel> & { inline?: boolean }) {
  return inline ? <section className="equipment-panel inline-maintenance" aria-label="Modifications"><header className="panel-heading"><div><span className="equipment-label">{props.code}</span><h2>{props.title}</h2></div></header>{props.children}</section> : <DialogPanel {...props} />;
}

export function Modifications({ open, onClose, machine, number, cash, dispatch, sound, inline = false, service }: { service?:ServiceProgress; inline?: boolean; open: boolean; onClose: () => void; machine: MachineInstance; number: number; cash: number; dispatch: Dispatch<WorkshopAction>; sound: boolean }) {
  const [requestedPage, setPage] = useState(0);
  const [section, setSection] = useState<'upgrades' | 'refit'>('upgrades');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const { ref, height } = useElementSize<HTMLDivElement>(open && section === 'upgrades');
  const upgrades = definition(machine).upgrades;
  const current = tier(machine);
  const next = nextTier(machine);
  const requirements = next?.refit;
  const fee=refitPrice(machine,service);
  const eligible = canRefit(machine, cash,service);
  const confirming = confirmation === machine.tier;
  const size = Math.max(1, Math.min(UI.maintenance.maxRows, Math.floor((height - UI.maintenance.padding) / (inline ? UI.maintenance.inlineRowHeight : UI.maintenance.rowHeight))));
  const pages = pageCount(upgrades.length, size);
  const page = clampPage(requestedPage, pages);
  function close() { setConfirmation(null); onClose(); }
  return <MaintenanceFrame inline={inline} open={open} onClose={close} title="Modifications" code={`${definition(machine).model} / UNIT ${serial(number)} / ${current.name.toUpperCase()}`} className="maintenance-dialog">
    <div className="maintenance-record"><span>{machine.bills.toLocaleString()} {definition(machine).unit}{machine.bills === 1 ? '' : 's'} <b>·</b> {money(machine.lifetime)} earned</span><strong>{money(cash)} available</strong></div>
    <nav className="maintenance-tabs" aria-label="Maintenance sections">
      <Button aria-pressed={section === 'upgrades'} onClick={() => { setSection('upgrades'); setConfirmation(null); }}>Upgrades <span>{current.upgradePriceMultiplier}× prices</span></Button>
      <Button aria-pressed={section === 'refit'} onClick={() => setSection('refit')}>Machine Refit</Button>
    </nav>
    {section === 'upgrades' ? <>
      <div ref={ref} className="modification-slots">
        <div className="modification-list" style={{ gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}>
          {upgrades.slice(page * size, (page + 1) * size).map(upgrade => {
            const owned = machine.upgrades.includes(upgrade.id);
            const cost = upgradePrice(machine, upgrade.id,service);
            const affordable = cash >= cost;
            return <article className={`modification-row ${owned ? 'is-installed' : ''}`} key={upgrade.id}>
              <span className="modification-icon"><Icon name={upgrade.icon} size={25} /></span>
              <div><h3>{upgrade.name}</h3><p>{upgrade.description}</p></div>
              <Button data-feedback="none" tone={owned ? 'plain' : 'primary'} disabled={owned || !affordable} aria-label={owned ? `${upgrade.name} installed` : `Buy ${upgrade.name} for ${money(cost)}`} onClick={() => { dispatch({ type: 'buy-upgrade', machineId: machine.id, upgradeId: upgrade.id }); feedback('buy', sound); }}>
                {owned ? <><Icon name="check" size={18} /><span>Installed</span></> : <><strong>{money(cost)}</strong><span>{affordable ? 'Install' : 'Insufficient cash'}</span></>}
              </Button>
            </article>;
          })}
        </div>
      </div>
      <Pager page={page} pages={pages} onChange={setPage} />
    </> : <section className="refit-section" aria-label="Machine Refit">
      <div className="refit-route"><div><span className="equipment-label">CURRENT TIER</span><h3>{current.name}</h3><span>{money(current.baseEarnings)} / {definition(machine).unit} base</span></div><Icon name="right" size={22} /><div><span className="equipment-label">{next ? 'NEXT TIER' : 'MAX TIER'}</span><h3>{next?.name ?? current.name}</h3><span>{next ? `${money(next.baseEarnings)} / ${definition(machine).unit} · ${next.upgradePriceMultiplier}× prices` : 'No further refits'}</span></div></div>
      {next && requirements ? <>
        {confirming ? <div className="refit-confirmation" role="group" aria-label="Confirm machine refit">
          <h3>Confirm refit</h3><p>Removes all upgrades and automation from this machine. Production restarts at Load. No upgrade refunds.</p><p>ID, serial, bay, and lifetime record stay intact.</p>
        </div> : <div className="refit-requirements"><span className="equipment-label">REQUIRED UPGRADES</span><ul>{requirements.requiredUpgrades.map(id => {
          const installed = machine.upgrades.includes(id);
          return <li key={id}><Icon name={installed ? 'check' : 'wrench'} size={16} /><span>{upgrades.find(item => item.id === id)?.name}</span><strong>{installed ? 'Installed' : 'Required'}</strong></li>;
        })}</ul><p>All upgrades and automation reset.</p></div>}
        <footer className="refit-actions"><div><span className="equipment-label">REFIT FEE</span><strong>{money(fee)}</strong></div>
          {confirming && <Button onClick={() => setConfirmation(null)}>Cancel</Button>}
          <Button data-feedback="none" tone="primary" disabled={!eligible} aria-label={confirming ? `Confirm refit to ${next.name} for ${money(fee)}` : `Refit to ${next.name}`} onClick={event => {
            // A double click must not accept the confirmation it just opened.
            if (confirming && event.detail > 1) return;
            if (!confirming) { setConfirmation(machine.tier); return; }
            dispatch({ type: 'refit', machineId: machine.id, fromTier: confirmation! });
            setConfirmation(null); setPage(0); feedback('buy', sound);
          }}>{confirming ? 'Confirm refit' : eligible ? 'Refit machine' : cash < fee ? 'Insufficient cash' : 'Install required upgrades'}</Button>
        </footer>
      </> : <div className="refit-max"><span>MAX TIER</span><p>{money(current.baseEarnings)} / {definition(machine).unit} base · {current.upgradePriceMultiplier}× upgrade prices</p></div>}
    </section>}
  </MaintenanceFrame>;
}
