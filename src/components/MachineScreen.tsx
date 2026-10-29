import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { Press } from './Press';
import { Icon } from './Icon';
import { Modifications } from './Modifications';
import { automated, definition, direction, earnings, phaseLabel, tier } from '../game/machines';
import type { MachineInstance, ManualAction, WorkshopAction } from '../game/types';
import { Button, StatusLamp } from '../ui/Controls';
import { money, serial } from '../ui/format';

const phases = ['feed', 'raise', 'stamp', 'lift', 'collect'] as const;
const stepNames = ['Load', 'Raise', 'Stamp', 'Lift', 'Collect'];
export function MachineScreen({ state, cash, number, dispatch, sound }: { state: MachineInstance; cash: number; number: number; dispatch: Dispatch<WorkshopAction>; sound: boolean }) {
  const [hint, setHint] = useState('');
  const [modifications, setModifications] = useState(false);
  const previousPhase = useRef(state.phase);
  useEffect(() => { if (previousPhase.current !== state.phase) setHint(''); previousPhase.current = state.phase; }, [state.phase]);
  const operate = useCallback((action: ManualAction) => dispatch({ type: 'operate', machineId: state.id, action }), [dispatch, state.id]);
  const auto = automated(state);
  const clockwise = direction(state) === 1;
  const currentStep = phases.indexOf(state.phase);
  const instructions = {
    feed: 'Drag paper onto the plate.',
    raise: `Turn ${clockwise ? 'clockwise' : 'counterclockwise'} to raise.`,
    stamp: 'Pull the press head down quickly.',
    lift: `Turn ${clockwise ? 'clockwise' : 'counterclockwise'} to lift.`,
    collect: `Drag the bill into the right tray. +${money(earnings(state))}`,
  };
  return <section className="screen workshop-screen" aria-label={`Operate ${tier(state).name} #${number}`}>
    <header className="workshop-heading"><div className="machine-identity"><span className="equipment-label">{definition(state).model} / PRESS {serial(number)}</span><h1>{tier(state).name}</h1></div><StatusLamp running={auto}>{auto ? 'Running' : 'Needs input'}</StatusLamp><Button className="modifications-control" onClick={() => setModifications(true)} aria-label="Open Modifications"><Icon name="wrench" size={19} /><span className="mod-label-long">Modifications</span><span className="mod-label-short">Mods</span></Button></header>
    <div className="machine-enclosure">
      <div key={state.phase} className={`instruction mechanical-instruction ${auto ? 'automatic' : ''}`} aria-live="polite" aria-atomic="true"><span className="step-number">{serial(currentStep + 1)}</span><p>{auto ? phaseLabel[state.phase] : instructions[state.phase]}</p><span className="output-label">{money(earnings(state))}<small>/ BILL</small></span></div>
      <Press key={`${state.id}:${state.tier}`} state={state} dispatch={operate} sound={sound} hint={hint} onHint={setHint} />
      <div className="cycle-steps" aria-label="Production progress">{stepNames.map((label, index) => <div key={label} className={`cycle-step ${index === currentStep ? 'current' : index < currentStep ? 'done' : ''}`} aria-current={index === currentStep ? 'step' : undefined}><span className="step-node">{index < currentStep ? <Icon name="check" size={12} /> : index + 1}</span><span>{label}</span></div>)}</div>
    </div>
    <Modifications open={modifications} onClose={() => setModifications(false)} machine={state} number={number} cash={cash} dispatch={dispatch} sound={sound} />
  </section>;
}
