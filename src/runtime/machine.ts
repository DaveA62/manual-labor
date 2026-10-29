import type { MachineInstance, ManualAction, WorkshopAction } from '../game/types.ts';
import type { FeedbackKind } from '../platform/contracts.ts';

/** Read snapshots; send intent. Renderers must never mutate state or award cash. */
export interface MachineRuntime {
  read(): MachineInstance;
  act(action: ManualAction): void;
  feedback(kind: FeedbackKind): void;
  hint(message: string): void;
}
export function createMachineRuntime(
  machineId: string,
  read: () => MachineInstance,
  dispatch: (action: WorkshopAction) => void,
  feedback: MachineRuntime['feedback'],
  hint: MachineRuntime['hint'],
): MachineRuntime {
  return { read, act: action => dispatch({ type: 'operate', machineId, action }), feedback, hint };
}
export interface MachineRendererProps { state: MachineInstance; runtime: MachineRuntime; hint: string }
