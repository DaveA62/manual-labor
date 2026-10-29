import { MACHINE_DEFINITIONS } from './definitions.ts';
import type { MachineInstance, MachineType, Phase, UpgradeId } from './types.ts';

let idSequence = 0;
/** randomUUID requires HTTPS; getRandomValues also works in local HTTP previews. */
export function newMachineId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return 'press-' + [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return `press-${Date.now().toString(36)}-${(++idSequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export function createMachine(id: string, type: MachineType = 'money-press'): MachineInstance {
  return { id, type, tier: MACHINE_DEFINITIONS[type].tiers[0].id, upgrades: [], phase: MACHINE_DEFINITIONS[type].phases[0], progress: 0, lifetime: 0, bills: 0 };
}
export const definition = (machine: MachineInstance) => MACHINE_DEFINITIONS[machine.type];
export const tier = (machine: MachineInstance) => definition(machine).tiers.find(item => item.id === machine.tier)!;
export const nextTier = (machine: MachineInstance) => {
  const tiers = definition(machine).tiers;
  return tiers[tiers.findIndex(item => item.id === machine.tier) + 1];
};
export const upgradePrice = (machine: MachineInstance, upgradeId: UpgradeId) => {
  const upgrade = definition(machine).upgrades.find(item => item.id === upgradeId);
  return upgrade ? upgrade.cost * tier(machine).upgradePriceMultiplier : Infinity;
};
export const canRefit = (machine: MachineInstance, cash: number) => {
  const requirements = nextTier(machine)?.refit;
  return !!requirements && cash >= requirements.fee && requirements.requiredUpgrades.every(id => machine.upgrades.includes(id));
};
export const earnings = (machine: MachineInstance) => tier(machine).baseEarnings * (machine.upgrades.includes('printing') ? 2 : 1);
export const direction = (machine: MachineInstance) => machine.bills % 2 === 0 ? 1 : -1;
export const automated = (machine: MachineInstance, phase: Phase = machine.phase) => machine.upgrades.includes(definition(machine).automation[phase]);
export const fullyAutomated = (machine: MachineInstance) => definition(machine).phases.every(phase => automated(machine, phase));
export const cycleDuration = (machine: MachineInstance) => definition(machine).phases.reduce((total, phase) => total + definition(machine).durationMs[phase], 0);
export const earningsPerMinute = (machine: MachineInstance) => fullyAutomated(machine) ? earnings(machine) * 60000 / cycleDuration(machine) : 0;
export const machineStatus = (machine: MachineInstance) => fullyAutomated(machine) ? 'Fully Automated' : automated(machine) ? 'Running' : 'Needs Input';
export const phaseLabel: Record<Phase, string> = { feed: 'Loading paper', raise: 'Raising head', stamp: 'Stamping', lift: 'Lifting head', collect: 'Collecting bill' };
