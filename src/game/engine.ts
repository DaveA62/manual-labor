import { RETIREMENT } from "../config/retirement.ts";
import {
  cents,
  machinePrice,
  productionModifiers,
  storagePrice,
} from "./service/stats.ts";
import { startCareer } from "./service/progression.ts";
import { refitPrice } from "./machines.ts";
import { ECONOMY, MACHINE_DEFINITIONS } from "./definitions.ts";
import {
  canRefit,
  createMachine,
  initialBottle,
  definition,
  nextTier,
  upgradePrice,
} from "./machines.ts";
import { advanceMachine, operate } from "./simulation.ts";
import type {
  MachineInstance,
  WorkshopAction,
  WorkshopState,
} from "./types.ts";

export function createWorkshop(): WorkshopState {
  const machine = createMachine("press-initial");
  return {
    cash: 0,
    lifetime: 0,
    bills: 0,
    machines: [machine],
    slots: [machine.id, ...Array<null>(ECONOMY.startingSlots - 1).fill(null)],
  };
}
function withMachines(
  state: WorkshopState,
  machines: MachineInstance[],
): WorkshopState {
  if (machines.every((machine, index) => machine === state.machines[index]))
    return state;
  let earned = 0;
  let bills = 0;
  machines.forEach((machine, index) => {
    earned += machine.lifetime - state.machines[index].lifetime;
    bills += machine.bills - state.machines[index].bills;
  });
  return {
    ...state,
    machines,
    cash: cents(state.cash + earned),
    lifetime: cents(state.lifetime + earned),
    bills: state.bills + bills,
  };
}
export function advanceWorkshop(
  state: WorkshopState,
  elapsedMs: number,
  offline = false,
): WorkshopState {
  if (state.service?.session || !Number.isFinite(elapsedMs) || elapsedMs <= 0)
    return state;
  // Split once at the early-career boundary, including during long offline advances.
  const elapsed = state.service?.careerMs ?? 0;
  const boundary =
    state.service && elapsed < RETIREMENT.seniorityMs
      ? RETIREMENT.seniorityMs - elapsed
      : Infinity;
  const step = Math.min(elapsedMs, boundary);
  const modifiers = productionModifiers(state, offline);
  let next = withMachines(
    state,
    state.machines.map((m) => advanceMachine(m, step, modifiers)),
  );
  if (state.service)
    next = { ...next, service: { ...state.service, careerMs: elapsed + step } };
  return step < elapsedMs
    ? advanceWorkshop(next, elapsedMs - step, offline)
    : next;
}
export function reducer(
  state: WorkshopState,
  action: WorkshopAction,
): WorkshopState {
  if (state.service?.session) return state;
  switch (action.type) {
    case "reset": {
      if (!state.service) return createWorkshop();
      const next = startCareer(state, state.service);
      return {
        ...next,
        service: { ...next.service!, careerMs: state.service.careerMs },
      };
    }
    case "tick":
      return advanceWorkshop(state, action.elapsedMs);
    case "operate":
      return withMachines(
        state,
        state.machines.map((machine) =>
          machine.id === action.machineId
            ? operate(machine, action.action, productionModifiers(state))
            : machine,
        ),
      );
    case "buy-upgrade": {
      const machine = state.machines.find(
        (item) => item.id === action.machineId,
      );
      if (!machine) return state;
      const upgrade = definition(machine).upgrades.find(
        (item) => item.id === action.upgradeId,
      );
      if (!upgrade || machine.upgrades.includes(upgrade.id)) return state;
      const cost = upgradePrice(machine, upgrade.id, state.service);
      if (state.cash < cost) return state;
      return {
        ...state,
        cash: cents(state.cash - cost),
        machines: state.machines.map((item) =>
          item.id === machine.id
            ? { ...item, upgrades: [...item.upgrades, upgrade.id] }
            : item,
        ),
      };
    }
    case "refit": {
      const machine = state.machines.find(
        (item) => item.id === action.machineId,
      );
      // A confirmation belongs to one tier. Replayed/stale requests cannot charge again.
      if (
        !machine ||
        machine.tier !== action.fromTier ||
        !canRefit(machine, state.cash, state.service)
      )
        return state;
      const next = nextTier(machine)!;
      return {
        ...state,
        cash: cents(state.cash - refitPrice(machine, state.service)),
        machines: state.machines.map((item) =>
          item.id === machine.id
            ? {
                ...item,
                tier: next.id,
                upgrades: [],
                ...(item.manualCycle !== undefined
                  ? { manualCycle: false }
                  : {}),
                phase: definition(item).phases[0],
                progress: 0,
                ...(item.type === "bottler"
                  ? { bottler: initialBottle(item.bills) }
                  : {}),
              }
            : item,
        ),
      };
    }
    case "buy-machine": {
      const config = Object.hasOwn(MACHINE_DEFINITIONS, action.machineType)
        ? MACHINE_DEFINITIONS[action.machineType]
        : undefined;
      const slot = state.slots.indexOf(null);
      const cost = config
        ? machinePrice(action.machineType, state.service)
        : Infinity;
      if (
        !config ||
        slot < 0 ||
        state.cash < cost ||
        !action.id ||
        state.machines.some((item) => item.id === action.id)
      )
        return state;
      const slots = [...state.slots];
      slots[slot] = action.id;
      return {
        ...state,
        cash: cents(state.cash - cost),
        slots,
        machines: [
          ...state.machines,
          createMachine(action.id, action.machineType),
        ],
      };
    }
    case "buy-slot": {
      const cost = storagePrice(state);
      if (!Number.isSafeInteger(cost) || state.cash < cost) return state;
      return {
        ...state,
        cash: cents(state.cash - cost),
        slots: [...state.slots, null],
      };
    }
    case "move": {
      const from = state.slots.indexOf(action.machineId);
      if (
        from < 0 ||
        !Number.isInteger(action.to) ||
        action.to < 0 ||
        action.to >= state.slots.length ||
        from === action.to
      )
        return state;
      const slots = [...state.slots];
      [slots[from], slots[action.to]] = [slots[action.to], slots[from]];
      return { ...state, slots };
    }
  }
}
