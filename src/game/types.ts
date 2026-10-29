import type { ServiceProgress } from "./service/types.ts";
export type PressPhase = 'feed' | 'raise' | 'stamp' | 'lift' | 'collect';
export type BottlerPhase = 'load' | 'fill' | 'transfer' | 'cap' | 'collect';
export type Phase = PressPhase | BottlerPhase;
export type MachineType = 'money-press' | 'bottler';
export type UpgradeId = 'feeder' | 'motor' | 'collector' | 'stamper' | 'printing' | 'bottle-loader' | 'flow-regulator' | 'auto-capper' | 'crate-conveyor';
export type BottleSize = 'short' | 'standard' | 'tall';
export interface BottlerState {
  size: BottleSize;
  /** Fill normalized to this bottle’s capacity; 1 = target, 1.25 = spill limit. */
  fill: number;
  valve: number;
  dripMs: number;
  regulated: boolean;
}

export interface MachineInstance {
  id: string;
  type: MachineType;
  /** Tier ID within this machine family’s definition. */
  tier: string;
  upgrades: UpgradeId[];
  phase: Phase;
  /** Normalized progress through the current action, including automated actions. */
  progress: number;
  lifetime: number;
  bills: number;
  bottler?: BottlerState;
  /** Any accepted manual action in this cycle, retained through automation changes. */
  manualCycle?: boolean;
}
export interface WorkshopState {
  service?: ServiceProgress;
  cash: number;
  lifetime: number;
  bills: number;
  machines: MachineInstance[];
  /** The array length is the unlocked capacity; null is an available slot. */
  slots: (string | null)[];
}
export type ManualAction = { type: 'feed' } | { type: 'turn'; amount: number } | { type: 'stamp' } | { type: 'collect' } | { type: 'load' } | { type: 'valve'; amount: number } | { type: 'transfer'; amount: number } | { type: 'cap'; amount: number };
export type WorkshopAction =
  | { type: 'operate'; machineId: string; action: ManualAction }
  | { type: 'tick'; elapsedMs: number }
  | { type: 'buy-upgrade'; machineId: string; upgradeId: UpgradeId }
  | { type: 'refit'; machineId: string; fromTier: string }
  | { type: 'buy-machine'; machineType: MachineType; id: string }
  | { type: 'buy-slot' }
  | { type: 'move'; machineId: string; to: number }
  | { type: 'reset' };
