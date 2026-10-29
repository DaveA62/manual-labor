import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { MachineScreen } from './components/MachineScreen';
import { MachineShop } from './components/MachineShop';
import { Storage } from './components/Storage';
import { earnings } from './game/machines';
import { feedback } from './game/feedback';
import { clearLegacySave } from './game/save';
import { useGame } from './game/useGame';

const money = (value: number) => '$' + value.toLocaleString('en-US');
type Screen = 'storage' | 'workshop' | 'shop';
export default function App() {
  const { state, dispatch, saved } = useGame();
  const [screen, setScreen] = useState<Screen>('storage');
  const [selected, setSelected] = useState(state.machines[0].id);
  const machine = state.machines.find(item => item.id === selected) ?? state.machines[0];
  const [sound, setSound] = useState(false);
  const [payday, setPayday] = useState(0);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const previousLifetime = useRef(state.lifetime);
  const openMachine = useCallback((id: string) => { setSelected(id); setScreen('workshop'); }, []);
  const openStorage = useCallback(() => setScreen('storage'), []);
  const openShop = useCallback(() => setScreen('shop'), []);
  useEffect(() => {
    if (state.lifetime > previousLifetime.current) { setPayday(state.lifetime - previousLifetime.current); feedback('cash', sound); }
    previousLifetime.current = state.lifetime;
  }, [state.lifetime, sound]);
  useEffect(() => {
    if (!payday) return;
    const timer = window.setTimeout(() => setPayday(0), 1600);
    return () => window.clearTimeout(timer);
  }, [payday, state.lifetime]);
  return <div className="app-shell">
    <header className="topbar">
      <a className="wordmark" href="#" onClick={openStorage} aria-label="Manual Labor home"><span className="brand-mark">m<span>l</span></span><span>MANUAL LABOR<span className="wordmark-sub">A LITTLE WORK GOES A LONG WAY.</span></span></a>
      <div className="header-actions"><span className="local-tag"><span /> LOCAL WORKSHOP</span><button className="icon-button" onClick={() => { setSound(value => !value); if (!sound) feedback('click', true); }} aria-label={sound ? 'Mute sound' : 'Enable sound'} aria-pressed={sound}><Icon name={sound ? 'sound' : 'muted'} /></button><button className="icon-button" onClick={() => resetDialog.current?.showModal()} aria-label="Reset save"><Icon name="reset" size={20} /></button></div>
    </header>
    <main>
      <section className="intro-row"><div><div className="eyebrow">YOUR SHIFT STARTS HERE</div><h1>Made by hand.<br className="mobile-break" /> <span>For now.</span></h1><p>Work the press. Make a little money. Work a little less.</p></div><div className="shift-note"><span className="tiny-cross">✳</span><span>NO BOSS.<br />JUST THE MACHINES.</span></div></section>
      <section className="stats-bar" aria-label="Workshop earnings">
        <div className="cash-stat"><span className="stat-label">AVAILABLE CASH</span><strong>{money(state.cash)}</strong>{payday > 0 && <span className="payday" key={state.lifetime}>+{money(payday)}</span>}</div>
        <div><span className="stat-label">LIFETIME EARNINGS</span><strong>{money(state.lifetime)}</strong></div>
        <div><span className="stat-label">{screen === 'workshop' ? 'THIS PRESS / BILL' : 'MACHINES'}</span><strong>{screen === 'workshop' ? money(earnings(machine)) : `${state.machines.length}/${state.slots.length}`}</strong></div>
        <div className="printed-stat"><span className="stat-label">BILLS PRINTED</span><strong>{state.bills.toLocaleString()}</strong></div>
        <div className="save-status"><span className={saved ? 'status-dot' : 'status-dot warning'} />{saved ? 'Progress saved' : 'Saving unavailable'}</div>
      </section>
      {!saved && <p className="save-warning" role="status">Browser storage is unavailable. Progress will last only for this session.</p>}
      <nav className="workshop-tabs" aria-label="Workshop sections"><button aria-current={screen === 'storage' ? 'page' : undefined} onClick={openStorage}>Storage <span>{state.machines.length}/{state.slots.length}</span></button><button aria-current={screen === 'workshop' ? 'page' : undefined} onClick={() => setScreen('workshop')}>Workshop</button><button aria-current={screen === 'shop' ? 'page' : undefined} onClick={openShop}>Machine Shop</button></nav>
      {screen === 'storage' && <Storage state={state} dispatch={dispatch} onOpen={openMachine} onShop={openShop} />}
      {screen === 'shop' && <MachineShop state={state} dispatch={dispatch} onStorage={openStorage} />}
      {screen === 'workshop' && <MachineScreen key={machine.id} state={machine} cash={state.cash} number={state.machines.indexOf(machine) + 1} dispatch={dispatch} sound={sound} onStorage={openStorage} />}
      <footer className="page-footer"><span>MANUAL LABOR <span className="footer-version">/ VOL. 002</span></span><span>A little more floor. A little less work. <span className="footer-spark">✳</span></span></footer>
    </main>
    <dialog ref={resetDialog} className="reset-dialog"><form method="dialog"><div className="eyebrow">A CLEAN WORKBENCH</div><h2>Start a new shift?</h2><p>This clears all machines, slots, upgrades, cash, and lifetime earnings saved on this browser.</p><div className="dialog-actions"><button value="cancel" className="secondary-button" autoFocus>Keep working</button><button value="reset" className="danger-button" onClick={() => { clearLegacySave(); dispatch({ type: 'reset' }); setScreen('storage'); setSelected('press-initial'); setPayday(0); }}>Reset everything</button></div></form></dialog>
  </div>;
}
