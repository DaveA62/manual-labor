/** Host services only. Native adapters are installed before mounting React. */
export type FeedbackKind =
  | "click"
  | "stamp"
  | "cash"
  | "buy"
  | "pickup"
  | "glass"
  | "seal"
  | "continuum"
  | "reveal"
  | "ui"
  | "hover"
  | "switch"
  | "ratchet"
  | "paper"
  | "valve"
  | "slide"
  | "latch"
  | "release"
  | "collect"
  | "reject";
export interface MachineVoice {
  kind: "press" | "bottler";
  action: "lift" | "feed" | "flow" | "carriage" | "cap" | "collect";
  intensity: number;
}
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface GamePlatform {
  storage: SaveStorage;
  /** Reload-stable identity for this window’s isolated pending-action journal. */
  sessionId?(): string;
  lifecycle: {
    isActive(): boolean;
    /** Monotonic milliseconds, never wall-clock time for production. */
    now(): number;
    subscribe(listener: (active: boolean) => void): () => void;
  };
  silence?(): void;
  unlockAudio?(): void;
  setAudioVolume?(volume: number): void;
  machineAudio?(voice: MachineVoice | null, sound: boolean): void;
  feedback(kind: FeedbackKind, sound: boolean): void;
}
