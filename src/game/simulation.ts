import { advanceBottler, completeBottlerPhase, operateBottler } from './bottling.ts';
import { automated, cycleDuration, definition, earnings, fullyAutomated } from './machines.ts';
import type { MachineInstance, ManualAction } from './types.ts';

/** The only production transition that pays is collect → feed. */
export function completePhase(machine: MachineInstance): MachineInstance {
  if (machine.type === 'bottler') return completeBottlerPhase(machine);
  const phases = definition(machine).phases;
  const next = phases[(phases.indexOf(machine.phase) + 1) % phases.length];
  const payout = machine.phase === 'collect' ? earnings(machine) : 0;
  return { ...machine, phase: next, progress: 0, lifetime: machine.lifetime + payout, bills: machine.bills + (payout > 0 ? 1 : 0) };
}
export function operate(machine: MachineInstance, action: ManualAction): MachineInstance {
  if (machine.type === 'bottler') return operateBottler(machine, action);
  if (automated(machine)) return machine;
  if (action.type === 'turn') {
    if ((machine.phase !== 'raise' && machine.phase !== 'lift') || !Number.isFinite(action.amount)) return machine;
    const progress = Math.min(1, Math.max(0, machine.progress + action.amount));
    if (progress === machine.progress) return machine;
    return progress >= 1 - 1e-9 ? completePhase(machine) : { ...machine, progress };
  }
  if (action.type !== machine.phase) return machine;
  return completePhase(machine);
}

/** Advances one instance, carries leftover time, and stops precisely at manual input. */
export function advanceMachine(machine: MachineInstance, elapsedMs: number): MachineInstance {
  if (machine.type === 'bottler') return advanceBottler(machine, elapsedMs);
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || !automated(machine)) return machine;
  let current = machine;
  let remaining = elapsedMs;
  while (remaining > 0 && automated(current)) {
    // Bulk complete full cycles rather than looping per bill for large simulations.
    if (current.phase === 'feed' && current.progress === 0 && fullyAutomated(current)) {
      const cycles = Math.floor(remaining / cycleDuration(current));
      if (cycles > 0) {
        current = { ...current, lifetime: current.lifetime + cycles * earnings(current), bills: current.bills + cycles };
        remaining -= cycles * cycleDuration(current);
        if (remaining < 1e-7) break;
      }
    }
    const duration = definition(current).durationMs[current.phase]!;
    const needed = (1 - current.progress) * duration;
    if (remaining + 1e-7 >= needed) {
      remaining = Math.max(0, remaining - needed);
      current = completePhase(current);
    } else {
      current = { ...current, progress: current.progress + remaining / duration };
      remaining = 0;
    }
  }
  return current;
}
