import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Dispatch } from 'react';
import type { MachineInstance, WorkshopAction } from '../game/types';
import { feedback } from '../game/feedback';
import { createMachineRuntime } from './machine';
/** Stable bridge for imperative scenes; callbacks always read the latest committed props. */
export function useMachineRuntime(machine: MachineInstance, dispatch: Dispatch<WorkshopAction>, sound: boolean, hint: (message: string) => void) {
  const current = useRef({ machine, dispatch, sound, hint });
  useLayoutEffect(() => { current.current = { machine, dispatch, sound, hint }; });
  return useMemo(() => createMachineRuntime(machine.id, () => current.current.machine,
    action => current.current.dispatch(action), kind => feedback(kind, current.current.sound),
    message => current.current.hint(message)), [machine.id]);
}
