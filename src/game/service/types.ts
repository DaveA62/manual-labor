export interface RetirementEntry {
  id: string;
  at: string;
  cash: number;
  awarded: number;
  lifetime: number;
  units: number;
}
export interface ServiceProgress {
  years: number;
  lifetimeYears: number;
  recognition: boolean;
  skills: Record<string, number>;
  discovered: string[];
  history: RetirementEntry[];
  session: null | {
    id: string;
    award: number;
    first: boolean;
    startedAt: string;
    transitionSeen: boolean;
  };
  careerId: string;
  careerMs: number;
  retiredEarnings: number;
  retiredUnits: number;
  grantedCash: number;
}
export type ServiceCommand =
  | { type: "retire"; careerId: string }
  | { type: "buy-skill"; sessionId: string; skillId: string; fromLevel: number }
  | { type: "begin-career"; sessionId: string }
  | { type: "ack-transition"; sessionId: string };
export const emptyService = (): ServiceProgress => ({
  years: 0,
  lifetimeYears: 0,
  recognition: false,
  skills: {},
  discovered: ["first-day"],
  history: [],
  session: null,
  careerId: "career-initial",
  careerMs: 0,
  retiredEarnings: 0,
  retiredUnits: 0,
  grantedCash: 0,
});
