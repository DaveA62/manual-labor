/** Host services only. Native adapters are installed before mounting React. */
export type FeedbackKind = 'click' | 'stamp' | 'cash' | 'buy' | 'pickup';
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface GamePlatform {
  storage: SaveStorage;
  lifecycle: {
    isActive(): boolean;
    /** Monotonic milliseconds, never wall-clock time for production. */
    now(): number;
    subscribe(listener: (active: boolean) => void): () => void;
  };
  feedback(kind: FeedbackKind, sound: boolean): void;
}
