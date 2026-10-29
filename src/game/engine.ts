import { ECONOMY, MACHINE_DEFINITIONS, slotPrice } from './definitions.ts';
import { canRefit, createMachine, initialBottle, definition, nextTier, upgradePrice } from './machines.ts';
import { advanceMachine, operate } from './simulation.ts';
import type { MachineInstance, WorkshopAction, WorkshopState } from './types.ts';

export function createWorkshop(): WorkshopState {
  const machine = createMachine('press-initial');
  return { cash: 0, lifetime: 0, bills: 0, machines: [machine], slots: [machine.id, ...Array<null>(ECONOMY.startingSlots - 1).fill(null)] };
}
function withMachines(state: WorkshopState, machines: MachineInstance[]): WorkshopState {
  if (machines.every((machine, index) => machine === state.machines[index])) return state;
  let earned = 0;
  let bills = 0;
  machines.forEach((machine, index) => {
    earned += machine.lifetime - state.machines[index].lifetime;
    bills += machine.bills - state.machines[index].bills;
  });
  return { ...state, machines, cash: state.cash + earned, lifetime: state.lifetime + earned, bills: state.bills + bills };
}
export function reducer(state: WorkshopState, action: WorkshopAction): WorkshopState {
  switch (action.type) {
    case 'reset': return createWorkshop();
    case 'tick': return withMachines(state, state.machines.map(machine => advanceMachine(machine, action.elapsedMs)));
    case 'operate': return withMachines(state, state.machines.map(machine => machine.id === action.machineId ? operate(machine, action.action) : machine));
    case 'buy-upgrade': {
      const machine = state.machines.find(item => item.id === action.machineId);
      if (!machine) return state;
      const upgrade = definition(machine).upgrades.find(item => item.id === action.upgradeId);
      if (!upgrade || machine.upgrades.includes(upgrade.id)) return state;
      const cost = upgradePrice(machine, upgrade.id);
      if (state.cash < cost) return state;
      return { ...state, cash: state.cash - cost, machines: state.machines.map(item => item.id === machine.id ? { ...item, upgrades: [...item.upgrades, upgrade.id] } : item) };
    }
    case 'refit': {
      const machine = state.machines.find(item => item.id === action.machineId);
      // A confirmation belongs to one tier. Replayed/stale requests cannot charge again.
      if (!machine || machine.tier !== action.fromTier || !canRefit(machine, state.cash)) return state;
      const next = nextTier(machine)!;
      return { ...state, cash: state.cash - next.refit!.fee, machines: state.machines.map(item => item.id === machine.id
        ? { ...item, tier: next.id, upgrades: [], phase: definition(item).phases[0], progress: 0, ...(item.type === 'bottler' ? { bottler: initialBottle(item.bills) } : {}) } : item) };
    }
    case 'buy-machine': {
      const config = Object.hasOwn(MACHINE_DEFINITIONS, action.machineType) ? MACHINE_DEFINITIONS[action.machineType] : undefined;
      const slot = state.slots.indexOf(null);
      if (!config || slot < 0 || state.cash < config.price || !action.id || state.machines.some(item => item.id === action.id)) return state;
      const slots = [...state.slots];
      slots[slot] = action.id;
      return { ...state, cash: state.cash - config.price, slots, machines: [...state.machines, createMachine(action.id, action.machineType)] };
    }
    case 'buy-slot': {
      const cost = slotPrice(state.slots.length);
      if (!Number.isSafeInteger(cost) || state.cash < cost) return state;
      return { ...state, cash: state.cash - cost, slots: [...state.slots, null] };
    }
    case 'move': {
      const from = state.slots.indexOf(action.machineId);
      if (from < 0 || !Number.isInteger(action.to) || action.to < 0 || action.to >= state.slots.length || from === action.to) return state;
      const slots = [...state.slots];
      [slots[from], slots[action.to]] = [slots[action.to], slots[from]];
      return { ...state, slots };
    }
  }
}
