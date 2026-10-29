export type Phase = 'feed' | 'raise' | 'stamp' | 'lift' | 'collect';
export type MachineType = 'money-press';
export type UpgradeId = 'feeder' | 'motor' | 'collector' | 'stamper' | 'printing';

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
}
export interface WorkshopState {
  cash: number;
  lifetime: number;
  bills: number;
  machines: MachineInstance[];
  /** The array length is the unlocked capacity; null is an available slot. */
  slots: (string | null)[];
}
export type ManualAction = { type: 'feed' } | { type: 'turn'; amount: number } | { type: 'stamp' } | { type: 'collect' };
export type WorkshopAction =
  | { type: 'operate'; machineId: string; action: ManualAction }
  | { type: 'tick'; elapsedMs: number }
  | { type: 'buy-upgrade'; machineId: string; upgradeId: UpgradeId }
  | { type: 'refit'; machineId: string; fromTier: string }
  | { type: 'buy-machine'; machineType: MachineType; id: string }
  | { type: 'buy-slot' }
  | { type: 'move'; machineId: string; to: number }
  | { type: 'reset' };
