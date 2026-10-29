import { browserPlatform } from './browser.ts';
import type { GamePlatform } from './contracts.ts';
let current: GamePlatform = browserPlatform;
export const getPlatform = () => current;
/** Composition-root operation: call before React mounts, never during a session. */
export function configurePlatform(adapter: GamePlatform) { current = adapter; }
