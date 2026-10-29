import { useState } from 'react';
import type { Dispatch } from 'react';
import { definition } from '../game/machines';
import { feedback } from '../game/feedback';
import type { MachineInstance, WorkshopAction } from '../game/types';
import { Button, DialogPanel, Pager } from '../ui/Controls';
import { money, serial } from '../ui/format';
import { useElementSize } from '../ui/useElementSize';
import { clampPage, pageCount } from '../ui/pagination';
import { Icon } from './Icon';

export function Modifications({ open, onClose, machine, number, cash, dispatch, sound }: { open: boolean; onClose: () => void; machine: MachineInstance; number: number; cash: number; dispatch: Dispatch<WorkshopAction>; sound: boolean }) {
  const [requestedPage, setPage] = useState(0);
  const { ref, height } = useElementSize<HTMLDivElement>(open);
  const upgrades = definition(machine).upgrades;
  const size = Math.max(1, Math.min(3, Math.floor((height + 8) / 96)));
  const pages = pageCount(upgrades.length, size);
  const page = clampPage(requestedPage, pages);
  return <DialogPanel open={open} onClose={onClose} title="Modifications" code={`${definition(machine).model} / PRESS ${serial(number)}`} className="maintenance-dialog">
    <div className="maintenance-record"><span>{machine.bills.toLocaleString()} {machine.bills === 1 ? 'bill' : 'bills'} <b>·</b> {money(machine.lifetime)} earned</span><strong>{money(cash)} available</strong></div>
    <div ref={ref} className="modification-slots">
      <div className="modification-list" style={{ gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}>
        {upgrades.slice(page * size, (page + 1) * size).map(upgrade => {
          const owned = machine.upgrades.includes(upgrade.id);
          const affordable = cash >= upgrade.cost;
          return <article className={`modification-row ${owned ? 'is-installed' : ''}`} key={upgrade.id}>
            <span className="modification-icon"><Icon name={upgrade.icon} size={25} /></span>
            <div><h3>{upgrade.name}</h3><p>{upgrade.description}</p></div>
            <Button tone={owned ? 'plain' : 'primary'} disabled={owned || !affordable} aria-label={owned ? `${upgrade.name} installed` : `Buy ${upgrade.name} for ${money(upgrade.cost)}`} onClick={() => { dispatch({ type: 'buy-upgrade', machineId: machine.id, upgradeId: upgrade.id }); feedback('buy', sound); }}>
              {owned ? <><Icon name="check" size={18} /><span>Installed</span></> : <><strong>{money(upgrade.cost)}</strong><span>{affordable ? 'Install' : 'Insufficient cash'}</span></>}
            </Button>
          </article>;
        })}
      </div>
    </div>
    <Pager page={page} pages={pages} onChange={setPage} />
  </DialogPanel>;
}
