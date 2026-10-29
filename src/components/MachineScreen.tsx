import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { Press } from './Press';
import { Icon } from './Icon';
import { automated, definition, direction, earnings } from '../game/machines';
import { feedback } from '../game/feedback';
import type { MachineInstance, ManualAction, WorkshopAction } from '../game/types';

const money = (value: number) => '$' + value.toLocaleString('en-US');
const phases = ['feed', 'raise', 'stamp', 'lift', 'collect'] as const;
export function MachineScreen({ state, cash, number, dispatch, sound, onStorage }: { state: MachineInstance; cash: number; number: number; dispatch: Dispatch<WorkshopAction>; sound: boolean; onStorage: () => void }) {
  const [hint, setHint] = useState('');
  const previousPhase = useRef(state.phase);
  useEffect(() => { if (previousPhase.current !== state.phase) setHint(''); previousPhase.current = state.phase; }, [state.phase]);
  const operate = useCallback((action: ManualAction) => dispatch({ type: 'operate', machineId: state.id, action }), [dispatch, state.id]);
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
  const automaticInstructions = state.phase === 'feed' ? 'Auto Feeder is loading the next sheet.' : state.phase === 'stamp' ? 'Auto Stamper is printing your bill.' : state.phase === 'collect' ? 'Auto Collector is putting your money away.' : 'Motorized Lift is raising the press head.';
  return <section aria-label={`Operate Money Press #${number}`}>
    <div className="machine-toolbar"><button className="outline-button" onClick={onStorage}>← Storage</button><p>THIS PRESS <strong>{money(state.lifetime)} earned</strong><span>{state.bills} bills printed</span></p></div>
      <div className="workshop-grid">
        <section className="machine-panel" aria-label="Money Press">
          <div className="panel-title"><div><span className="machine-number">01</span><h2>Money Press #{number}</h2><span className="model-tag">MK. I</span></div><span className="live-status"><span /> {auto ? 'AUTO RUNNING' : 'AWAITING OPERATOR'}</span></div>
          <div className="instruction" aria-live="polite" aria-atomic="true"><div className="step-number">{auto ? <Icon name="motor" /> : String(currentStep + 1).padStart(2, '0')}</div><div><h3>{auto ? 'A little help on the floor.' : instructions[state.phase][0]}</h3><p>{auto ? automaticInstructions : instructions[state.phase][1]}</p></div></div>
          <Press state={state} dispatch={operate} sound={sound} hint={hint} onHint={setHint} />
          <div className="cycle-steps" aria-label="Production progress">{['Load', 'Raise', 'Stamp', 'Lift', 'Collect'].map((label, index) => <div key={label} className={`cycle-step ${index === currentStep ? 'current' : index < currentStep ? 'done' : ''}`} aria-current={index === currentStep ? 'step' : undefined}><span className="step-node">{index < currentStep ? <Icon name="check" size={12} /> : index + 1}</span><span>{label}</span></div>)}</div>
          <div className="machine-footer"><span><span className="status-dot" /> {state.upgrades.length === 0 ? '100% elbow grease' : `${state.upgrades.filter(id => id !== 'printing').length}/4 actions automated`}</span><span>DRAG · ROTATE · REPEAT</span></div>
        </section>
        <aside className="upgrades-panel" aria-label="Workshop upgrades"><div className="upgrade-heading"><div className="eyebrow">LESS WORK. MORE WORKSHOP.</div><h2>Work smarter.</h2><p>Small investments. Lighter shifts.</p></div>
          <div className="upgrade-list">{definition(state).upgrades.map((upgrade, index) => {
            const owned = state.upgrades.includes(upgrade.id);
            const affordable = cash >= upgrade.cost;
            return <article className={`upgrade-card ${owned ? 'owned' : ''}`} key={upgrade.id}><div className="upgrade-top"><span className="upgrade-icon"><Icon name={upgrade.icon} size={24} /></span><span className="upgrade-category">{upgrade.id === 'printing' ? 'BETTER PAY' : 'AUTOMATION'} <span>0{index + 1}</span></span></div><h3>{upgrade.name}</h3><p>{upgrade.description}</p><button disabled={owned || !affordable} className={`purchase ${affordable && !owned ? 'can-buy' : ''}`} onClick={() => { dispatch({ type: 'buy-upgrade', machineId: state.id, upgradeId: upgrade.id }); feedback('buy', sound); }} aria-label={owned ? `${upgrade.name} installed` : `Buy ${upgrade.name} for ${money(upgrade.cost)}`}><span>{owned ? 'Installed' : money(upgrade.cost)}</span><span>{owned ? <Icon name="check" size={17} /> : affordable ? 'Install ↗' : `${money(upgrade.cost - cash)} to go`}</span></button></article>;
          })}</div>
          <div className="workshop-tip"><span>↳</span><p>Build each press at your own pace. <strong>Auto Stamper completes the automation loop.</strong></p></div>
        </aside>
      </div>
  </section>;
}
