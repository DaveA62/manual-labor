import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { MachineScreen } from './components/MachineScreen';
import { MachineShop } from './components/MachineShop';
import { Storage } from './components/Storage';
import { feedback } from './game/feedback';
import { clearLegacySave } from './game/save';
import { useGame } from './game/useGame';
import { Button, DialogPanel } from './ui/Controls';
import { money } from './ui/format';

type Screen = 'storage' | 'workshop' | 'catalog';
export default function App() {
  const { state, dispatch, saved } = useGame();
  const [screen, setScreen] = useState<Screen>('workshop');
  const [selected, setSelected] = useState(state.machines[0].id);
  const machine = state.machines.find(item => item.id === selected) ?? state.machines[0];
  const [renderer, setRenderer] = useState<'svg' | 'phaser'>(() => import.meta.env.DEV && new URLSearchParams(location.search).get('renderer') === 'phaser' ? 'phaser' : 'svg');
  const [sound, setSound] = useState(false);
  const [payday, setPayday] = useState(0);
  const [dialog, setDialog] = useState<'settings' | 'reset' | null>(null);
  const previousLifetime = useRef(state.lifetime);
  const openMachine = useCallback((id: string) => { setSelected(id); setScreen('workshop'); }, []);
  const openCatalog = useCallback(() => setScreen('catalog'), []);
  useEffect(() => {
    if (state.lifetime > previousLifetime.current) {
      setPayday(state.lifetime - previousLifetime.current);
      feedback('cash', sound);
    }
    previousLifetime.current = state.lifetime;
  }, [state.lifetime, sound]);
  useEffect(() => {
    if (!payday) return;
    const timer = window.setTimeout(() => setPayday(0), 1400);
    return () => window.clearTimeout(timer);
  }, [payday, state.lifetime]);
  return <div className="game-shell" data-screen={screen}>
    <header className="game-header">
      <button className="wordmark" onClick={() => setScreen('workshop')} aria-label="Manual Labor Workshop">
        <span className="brand-stamp" aria-hidden="true">M/L</span><span>MANUAL LABOR<small>QUESTIONABLY FUNCTIONAL</small></span>
      </button>
      <div className="header-cash" aria-label="Available cash" title={`${money(state.lifetime)} lifetime earnings`}>
        <span className="equipment-label">CASH</span><strong>{money(state.cash)}</strong>
        {payday > 0 && <span className="payday" key={state.lifetime}>+{money(payday)}</span>}
      </div>
      <Button className="square-control header-settings" aria-label="Settings" onClick={() => setDialog('settings')}><Icon name="settings" /></Button>
    </header>
    <nav className="primary-nav" aria-label="Primary navigation">
      {([{ id: 'workshop', label: 'Workshop', icon: 'workshop' }, { id: 'storage', label: 'Storage', icon: 'storage' }, { id: 'catalog', label: 'Catalog', icon: 'catalog' }] as const).map(item =>
        <button key={item.id} aria-current={screen === item.id ? 'page' : undefined} onClick={() => setScreen(item.id)}><Icon name={item.icon} /><span>{item.label}</span>{item.id === 'storage' && <small>{state.machines.length}/{state.slots.length}</small>}</button>)}
    </nav>
    <main className="game-content">
      {!saved && <div className="save-warning" role="status">Saving unavailable. Session progress only.</div>}
      {screen === 'storage' && <Storage state={state} dispatch={dispatch} onOpen={openMachine} onShop={openCatalog} />}
      {screen === 'catalog' && <MachineShop state={state} dispatch={dispatch} />}
      {screen === 'workshop' && <MachineScreen key={machine.id} state={machine} cash={state.cash} number={state.machines.indexOf(machine) + 1} dispatch={dispatch} sound={sound} renderer={renderer} />}
    </main>
    <DialogPanel open={dialog === 'settings'} onClose={() => setDialog(null)} title="Workshop record" code="CONTROL PANEL / 01" className="settings-dialog">
      <dl className="record-grid"><div><dt>Lifetime earnings</dt><dd>{money(state.lifetime)}</dd></div><div><dt>Bills printed</dt><dd>{state.bills.toLocaleString()}</dd></div><div><dt>Storage</dt><dd>{state.machines.length} / {state.slots.length}</dd></div><div><dt>Save</dt><dd>{saved ? 'LOCAL / OK' : 'UNAVAILABLE'}</dd></div></dl>
      <div className="settings-actions"><Button aria-pressed={sound} onClick={() => { setSound(value => !value); if (!sound) feedback('click', true); }}><Icon name={sound ? 'sound' : 'muted'} size={20} />Sound {sound ? 'on' : 'off'}</Button><Button tone="danger" onClick={() => setDialog('reset')}><Icon name="reset" size={18} />Reset save</Button></div>
      {import.meta.env.DEV && <div className="settings-actions" aria-label="Development renderer"><Button aria-pressed={renderer === 'svg'} onClick={() => setRenderer('svg')}>SVG baseline</Button><Button aria-pressed={renderer === 'phaser'} onClick={() => setRenderer('phaser')}>Phaser experiment</Button></div>}
      <span className="inspection-stamp">INSPECTION STATUS: PENDING</span>
    </DialogPanel>
    <DialogPanel open={dialog === 'reset'} onClose={() => setDialog(null)} title="Reset workshop?" code="DELETE LOCAL SAVE" className="reset-dialog">
      <p className="dialog-copy">Deletes all machines, upgrades, cash, and production progress.</p>
      <div className="settings-actions"><Button onClick={() => setDialog(null)}>Cancel</Button><Button tone="danger" onClick={() => { clearLegacySave(); dispatch({ type: 'reset' }); setScreen('workshop'); setSelected('press-initial'); setPayday(0); setDialog(null); }}>Reset everything</Button></div>
    </DialogPanel>
  </div>;
}
