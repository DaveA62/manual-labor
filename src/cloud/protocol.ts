import type { WorkshopAction, WorkshopState } from "../game/types.ts";
export const CLOUD_SCHEMA = 3;
export const RULES_VERSION = 1;
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
export type PlayerAction = Exclude<WorkshopAction, { type: "tick" }>;
export interface TimedAction {
  id: string;
  at: number;
  action: PlayerAction;
}
export interface ShiftReport {
  id: string;
  elapsedMs: number;
  eligibleMs: number;
  total: number;
  machines: { id: string; name: string; earnings: number }[];
  local?: boolean;
}
export interface CloudRecord {
  state: WorkshopState;
  revision: number;
  checkpoint: string;
  schemaVersion: number;
  reports: ShiftReport[];
}
export interface SyncRequest {
  id: string;
  revision: number;
  events: TimedAction[];
  initial?: WorkshopState;
  offline: boolean;
  rulesVersion: number;
}
export interface SyncResult extends CloudRecord {
  requestId: string;
}
export class CloudConflict extends Error {
  record: CloudRecord;
  constructor(record: CloudRecord) {
    super("A newer cloud save exists.");
    this.record = record;
  }
}
export interface CloudTransport {
  peek(): Promise<CloudRecord | null>;
  commit(request: SyncRequest): Promise<SyncResult>;
  acknowledge(id: string): Promise<void>;
}
