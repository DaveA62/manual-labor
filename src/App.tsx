import { useEffect, useRef, useState } from 'react';
import { Press } from './components/Press';
import { Icon } from './components/Icon';
import { automated, direction, earnings, UPGRADES } from './game/engine';
import { feedback } from './game/feedback';
import { useGame } from './game/useGame';

const money = (value: number) => '$' + value.toLocaleString('en-US');
const phases = ['feed', 'raise', 'stamp', 'lift', 'collect'] as const;
export default function App() {
  const { state, dispatch, saved } = useGame();
  const [sound, setSound] = useState(false);
  const [hint, setHint] = useState('');
  const [payday, setPayday] = useState(0);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const previousBills = useRef(state.bills);
  const previousPhase = useRef(state.phase);
  useEffect(() => {
    if (state.bills > previousBills.current) { setPayday(earnings(state)); feedback('cash', sound); }
    previousBills.current = state.bills;
  }, [state.bills, sound, state]);
  useEffect(() => {
    if (!payday) return;
    const timer = window.setTimeout(() => setPayday(0), 1600);
    return () => window.clearTimeout(timer);
  }, [payday, state.bills]);
  useEffect(() => {
    if (previousPhase.current !== state.phase) setHint('');
    previousPhase.current = state.phase;
  }, [state.phase]);
  const auto = automated(state);
  const clockwise = direction(state) === 1;
  const currentStep = phases.indexOf(state.phase);
  const instructions = {
    feed: ['A fresh start.', 'Drag a blank sheet from the left stack onto the press plate.'],
    raise: ['Put your back into it.', `Rotate the crank ${clockwise ? 'clockwise ↻' : 'counterclockwise ↺'} one full turn to raise the head.`],
    stamp: ['Make an impression.', 'Grab the raised press head and pull it down fast.'],
    lift: ['One more turn.', `Rotate ${clockwise ? 'clockwise ↻' : 'counterclockwise ↺'} again to reveal your freshly printed bill.`],
    collect: ['An honest day’s pay.', `Drag your bill to the collection tray on the right. That’s ${money(earnings(state))} earned.`],
  };
  const automaticInstructions = state.phase === 'feed' ? 'Auto Feeder is loading the next sheet.' : state.phase === 'collect' ? 'Auto Collector is putting your money away.' : 'Motorized Lift is raising the press head.';
  return <div className="app-shell">
    <header className="topbar">
      <a className="wordmark" href="#" aria-label="Manual Labor home"><span className="brand-mark">m<span>l</span></span><span>MANUAL LABOR<span className="wordmark-sub">A LITTLE WORK GOES A LONG WAY.</span></span></a>
      <div className="header-actions"><span className="local-tag"><span /> LOCAL WORKSHOP</span><button className="icon-button" onClick={() => { setSound(value => !value); if (!sound) feedback('click', true); }} aria-label={sound ? 'Mute sound' : 'Enable sound'} aria-pressed={sound}><Icon name={sound ? 'sound' : 'muted'} /></button><button className="icon-button" onClick={() => resetDialog.current?.showModal()} aria-label="Reset save"><Icon name="reset" size={20} /></button></div>
    </header>
    <main>
      <section className="intro-row"><div><div className="eyebrow">YOUR SHIFT STARTS HERE</div><h1>Made by hand.<br className="mobile-break" /> <span>For now.</span></h1><p>Work the press. Make a little money. Work a little less.</p></div><div className="shift-note"><span className="tiny-cross">✳</span><span>NO BOSS.<br />JUST THE MACHINE.</span></div></section>
      <section className="stats-bar" aria-label="Workshop earnings">
        <div className="cash-stat"><span className="stat-label">AVAILABLE CASH</span><strong>{money(state.cash)}</strong>{payday > 0 && <span className="payday" key={state.bills}>+{money(payday)}</span>}</div>
        <div><span className="stat-label">LIFETIME EARNINGS</span><strong>{money(state.lifetime)}</strong></div>
        <div><span className="stat-label">PER BILL</span><strong>{money(earnings(state))}<span className="small-unit"> / print</span></strong></div>
        <div className="printed-stat"><span className="stat-label">BILLS PRINTED</span><strong>{state.bills.toLocaleString()}</strong></div>
        <div className="save-status"><span className={saved ? 'status-dot' : 'status-dot warning'} />{saved ? 'Progress saved' : 'Saving unavailable'}</div>
      </section>
      <div className="workshop-grid">
        <section className="machine-panel" aria-label="Money Press">
          <div className="panel-title"><div><span className="machine-number">01</span><h2>Money Press</h2><span className="model-tag">MK. I</span></div><span className="live-status"><span /> {auto ? 'AUTO RUNNING' : 'AWAITING OPERATOR'}</span></div>
          <div className="instruction" aria-live="polite" aria-atomic="true"><div className="step-number">{auto ? <Icon name="motor" /> : String(currentStep + 1).padStart(2, '0')}</div><div><h3>{auto ? 'A little help on the floor.' : instructions[state.phase][0]}</h3><p>{auto ? automaticInstructions : instructions[state.phase][1]}</p></div></div>
          <Press state={state} dispatch={dispatch} sound={sound} hint={hint} onHint={setHint} />
          <div className="cycle-steps" aria-label="Production progress">{['Load', 'Raise', 'Stamp', 'Lift', 'Collect'].map((label, index) => <div key={label} className={`cycle-step ${index === currentStep ? 'current' : index < currentStep ? 'done' : ''}`} aria-current={index === currentStep ? 'step' : undefined}><span className="step-node">{index < currentStep ? <Icon name="check" size={12} /> : index + 1}</span><span>{label}</span></div>)}</div>
          <div className="machine-footer"><span><span className="status-dot" /> {state.upgrades.length === 0 ? '100% elbow grease' : `${state.upgrades.filter(id => id !== 'printing').length}/3 actions automated`}</span><span>DRAG · ROTATE · REPEAT</span></div>
        </section>
        <aside className="upgrades-panel" aria-label="Workshop upgrades"><div className="upgrade-heading"><div className="eyebrow">LESS WORK. MORE WORKSHOP.</div><h2>Work smarter.</h2><p>Small investments. Lighter shifts.</p></div>
          <div className="upgrade-list">{UPGRADES.map((upgrade, index) => {
            const owned = state.upgrades.includes(upgrade.id);
            const affordable = state.cash >= upgrade.cost;
            return <article className={`upgrade-card ${owned ? 'owned' : ''}`} key={upgrade.id}><div className="upgrade-top"><span className="upgrade-icon"><Icon name={upgrade.icon} size={24} /></span><span className="upgrade-category">{index === 3 ? 'BETTER PAY' : 'AUTOMATION'} <span>0{index + 1}</span></span></div><h3>{upgrade.name}</h3><p>{upgrade.description}</p><button disabled={owned || !affordable} className={`purchase ${affordable && !owned ? 'can-buy' : ''}`} onClick={() => { dispatch({ type: 'buy', id: upgrade.id }); feedback('buy', sound); }} aria-label={owned ? `${upgrade.name} installed` : `Buy ${upgrade.name} for ${money(upgrade.cost)}`}><span>{owned ? 'Installed' : money(upgrade.cost)}</span><span>{owned ? <Icon name="check" size={17} /> : affordable ? 'Install ↗' : `${money(upgrade.cost - state.cash)} to go`}</span></button></article>;
          })}</div>
          <div className="workshop-tip"><span>↳</span><p>Even a well-oiled machine needs a human touch. <strong>The stamp is always yours.</strong></p></div>
        </aside>
      </div>
      <footer className="page-footer"><span>MANUAL LABOR <span className="footer-version">/ VOL. 001</span></span><span>One machine. Endless possibilities. <span className="footer-spark">✳</span></span></footer>
    </main>
    <dialog ref={resetDialog} className="reset-dialog"><form method="dialog"><div className="eyebrow">A CLEAN WORKBENCH</div><h2>Start a new shift?</h2><p>This clears all cash, lifetime earnings, and upgrades saved on this browser.</p><div className="dialog-actions"><button value="cancel" className="secondary-button" autoFocus>Keep working</button><button value="reset" className="danger-button" onClick={() => { dispatch({ type: 'reset' }); setHint(''); setPayday(0); }}>Reset everything</button></div></form></dialog>
  </div>;
}
