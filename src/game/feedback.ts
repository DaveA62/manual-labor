import { getPlatform } from '../platform/index.ts';
import type { FeedbackKind } from '../platform/contracts.ts';
/** Compatibility facade: visual effects never control simulation. */
export function feedback(kind: FeedbackKind, sound: boolean) { getPlatform().feedback(kind, sound); }
