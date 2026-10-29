import { useMachineAudio } from "../presentation/useMachineAudio";
import type { ServiceProgress } from "../game/service/types";
import { productionModifiers } from "../game/service/stats";
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { Bottler } from './Bottler';
import { Press } from './Press';
import { RendererBoundary } from '../ui/RendererBoundary';
import { useMachineRuntime } from '../runtime/useMachineRuntime';
import { Icon } from './Icon';
import { Modifications } from './Modifications';
import { automated, definition, direction, earnings, bottlePayout, phaseLabel, tier } from '../game/machines';
import type { MachineInstance, Phase, WorkshopAction } from '../game/types';
import { Button, StatusLamp } from '../ui/Controls';
import { money, serial } from '../ui/format';

const ExperimentalPress = import.meta.env.DEV ? lazy(() => import('../experiments/phaser/PhaserPress')) : null;
export function MachineScreen({ state, cash, number, dispatch, sound, renderer = 'svg', managed = false, service }: { service?:ServiceProgress; managed?: boolean; renderer?: 'svg' | 'phaser'; state: MachineInstance; cash: number; number: number; dispatch: Dispatch<WorkshopAction>; sound: boolean }) {
  useEffect(() => { if (managed) setModifications(false); }, [managed]);
  const [hint, setHint] = useState('');
  const [modifications, setModifications] = useState(false);
  const previousPhase = useRef(state.phase);
  useEffect(() => { if (previousPhase.current !== state.phase) setHint(''); previousPhase.current = state.phase; }, [state.phase]);
  useMachineAudio(state,sound);
  const runtime = useMachineRuntime(state, dispatch, sound, setHint);
  const modifiers=productionModifiers({service});
  const config = definition(state);
  const { phases, stepNames } = config;
  const bottling = state.type === 'bottler';
  const auto = automated(state);
  const clockwise = direction(state) === 1;
  const currentStep = phases.indexOf(state.phase);
  const instructions: Record<Phase,string> = {
    load: 'Drag a bottle into the filling bracket.',
    fill: state.upgrades.includes('auto-capper') ? 'Turn clockwise to fill. Close to release.' : 'Turn clockwise to fill. Close, then slide right.',
    transfer: 'Slide the carriage beneath the capper.',
    cap: 'Pull the orange lever down.',
    feed: 'Drag paper onto the plate.',
    raise: `Turn ${clockwise ? 'clockwise' : 'counterclockwise'} to raise.`,
    stamp: 'Pull the press head down quickly.',
    lift: `Turn ${clockwise ? 'clockwise' : 'counterclockwise'} to lift.`,
    collect: bottling ? `Swipe the bottle into the crate. +${money(bottlePayout({...state,manualCycle:state.manualCycle||!automated(state)},modifiers))}` : `Drag the bill into the right tray. +${money(earnings({...state,manualCycle:state.manualCycle||!automated(state)},modifiers))}`,
  };
  return <section className="screen workshop-screen" aria-label={`Operate ${tier(state).name} #${number}`}>
    <header className="workshop-heading"><div className="machine-identity"><span className="equipment-label">{definition(state).model} / UNIT {serial(number)}</span><h1>{tier(state).name}</h1></div><StatusLamp running={auto}>{auto ? 'Running' : 'Needs input'}</StatusLamp>{!managed && <Button className="modifications-control" onClick={() => setModifications(true)} aria-label="Open Modifications"><Icon name="wrench" size={19} /><span className="mod-label-long">Modifications</span><span className="mod-label-short">Mods</span></Button>}</header>
    <div className="machine-enclosure">
      <div key={state.phase} className={`instruction mechanical-instruction ${auto ? 'automatic' : ''}`} aria-live="polite" aria-atomic="true"><span className="step-number">{serial(currentStep + 1)}</span><p>{auto ? phaseLabel[state.phase] : instructions[state.phase]}</p><span className="output-label">{money(earnings({...state,manualCycle:state.manualCycle||!automated(state)},modifiers))}<small>/ {config.unit.toUpperCase()}</small></span></div>
      {bottling ? <Bottler key={`${state.id}:${state.tier}`} state={state} runtime={runtime} hint={hint} /> : renderer === 'phaser' && ExperimentalPress ? <RendererBoundary key={`${state.id}:${state.tier}`} fallback={<Press state={state} runtime={runtime} hint="Phaser unavailable. SVG active." />}><Suspense fallback={<div className="machine-scene">Loading renderer…</div>}><ExperimentalPress key={`${state.id}:${state.tier}`} state={state} runtime={runtime} hint={hint} /></Suspense></RendererBoundary> : <Press key={`${state.id}:${state.tier}`} state={state} runtime={runtime} hint={hint} />}
      <div className="cycle-steps" aria-label="Production progress">{stepNames.map((label, index) => <div key={label} className={`cycle-step ${index === currentStep ? 'current' : index < currentStep ? 'done' : ''}`} aria-current={index === currentStep ? 'step' : undefined}><span className="step-node">{index < currentStep ? <Icon name="check" size={12} /> : index + 1}</span><span>{label}</span></div>)}</div>
    </div>
    {!managed && <Modifications service={service} open={modifications} onClose={() => setModifications(false)} machine={state} number={number} cash={cash} dispatch={dispatch} sound={sound} />}
  </section>;
}
