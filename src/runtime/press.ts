import { automated } from '../game/machines.ts';
import type { MachineInstance } from '../game/types.ts';
export type PressPart = 'paper' | 'crank' | 'head' | 'bill';
export function activePressPart(machine: MachineInstance): PressPart | null {
  if (automated(machine)) return null;
  return machine.phase === 'feed' ? 'paper' : machine.phase === 'stamp' ? 'head' : machine.phase === 'collect' ? 'bill' : 'crank';
}
export function pressHeadTarget(machine: MachineInstance) {
  return machine.phase === 'stamp' ? 208 + (automated(machine) ? machine.progress * 132 : 0)
    : machine.phase === 'collect' ? 208 : machine.phase === 'raise' || machine.phase === 'lift' ? 340 - machine.progress * 132 : 340;
}
