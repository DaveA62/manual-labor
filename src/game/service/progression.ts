import { RETIREMENT } from "../../config/retirement.ts";
import { CONNECTIONS, SKILL_BY_ID } from "../../config/continuum/skills.ts";
import { createMachine } from "../machines.ts";
import { derivedStats } from "./stats.ts";
import { emptyService } from "./types.ts";
import type { ServiceProgress, ServiceCommand } from "./types.ts";
import type { WorkshopState } from "../types.ts";
export const pointCost = (lifetimeYears: number) =>
  RETIREMENT.pointBase + RETIREMENT.pointGrowth * lifetimeYears;
export function retirementPreview(cash: number, lifetimeYears = 0) {
  const base = pointCost(lifetimeYears),
    growth = RETIREMENT.pointGrowth;
  const cost = (n: number) => n * base + (growth * n * (n - 1)) / 2;
  // Exact sequential arithmetic-series cost; no cap on a first retirement.
  let points = Math.max(
    0,
    Math.floor(
      (2 * cash) /
        (Math.sqrt((base - growth / 2) ** 2 + 2 * growth * cash) +
          base -
          growth / 2),
    ),
  );
  while (cost(points + 1) <= cash) points++;
  while (points > 0 && cost(points) > cash) points--;
  return {
    points,
    spent: cost(points),
    remaining: cash - cost(points),
    nextCost: pointCost(lifetimeYears + points),
    needed: Math.max(0, cost(points + 1) - cash),
  };
}
export function eligibleSkill(service: ServiceProgress, id: string) {
  const node = Object.hasOwn(SKILL_BY_ID, id) ? SKILL_BY_ID[id] : undefined;
  if (!node) return false;
  const has = ({ id, level }: { id: string; level: number }) =>
    (service.skills[id] ?? 0) >= level;
  return (
    (!node.prerequisites.all || node.prerequisites.all.every(has)) &&
    (!node.prerequisites.any || node.prerequisites.any.some(has))
  );
}
export function revealedNeighbors(discovered: readonly string[], id: string) {
  return [
    ...new Set([
      ...discovered,
      id,
      ...CONNECTIONS.flatMap(([a, b]) =>
        a === id ? [b] : b === id ? [a] : [],
      ),
    ]),
  ];
}
export function startCareer(
  state: WorkshopState,
  service: ServiceProgress,
): WorkshopState {
  const stats = derivedStats(service);
  const machines = Array.from({ length: 1 + stats.startingPresses }, (_, i) =>
    createMachine(`career-${service.careerId}-press-${i}`),
  );
  const slots = [
    ...machines.map((m) => m.id),
    ...Array<null>(
      Math.max(stats.storage, machines.length) - machines.length,
    ).fill(null),
  ];
  return {
    ...state,
    cash: stats.startingCash,
    machines,
    slots,
    service: {
      ...service,
      session: null,
      careerMs: 0,
      grantedCash: service.grantedCash + stats.startingCash,
      retiredEarnings: state.lifetime,
      retiredUnits: state.bills,
    },
  };
}
/** Called only after authenticated server replay; never part of a client action journal. */
export function applyServiceCommand(
  state: WorkshopState,
  command: ServiceCommand,
  requestId: string,
  now: string,
): WorkshopState {
  const s = state.service ?? emptyService();
  if (command.type === "retire") {
    if (s.session || command.careerId !== s.careerId)
      throw Error("Career changed. Reload the retirement preview.");
    const award = retirementPreview(state.cash, s.lifetimeYears).points;
    if (award < 1) throw Error("Insufficient cash for a Year of Service.");
    const next: ServiceProgress = {
      ...s,
      years: s.years + award,
      lifetimeYears: s.lifetimeYears + award,
      recognition: true,
      history: [
        ...s.history,
        {
          id: requestId,
          at: now,
          cash: state.cash,
          awarded: award,
          lifetime: state.lifetime,
          units: state.bills,
        },
      ],
      session: {
        id: requestId,
        award,
        first: s.history.length === 0,
        startedAt: now,
        transitionSeen: false,
      },
      retiredEarnings: state.lifetime,
      retiredUnits: state.bills,
      careerId: requestId,
      careerMs: 0,
    };
    return {
      ...state,
      cash: 0,
      machines: [],
      slots: Array<null>(derivedStats(next).storage).fill(null),
      service: next,
    };
  }
  if (!s.session || command.sessionId !== s.session.id)
    throw Error("Retirement session changed. Reload your cloud save.");
  if (command.type === "ack-transition")
    return {
      ...state,
      service: { ...s, session: { ...s.session, transitionSeen: true } },
    };
  if (command.type === "begin-career") return startCareer(state, s);
  const node = Object.hasOwn(SKILL_BY_ID, command.skillId)
      ? SKILL_BY_ID[command.skillId]
      : undefined,
    level = s.skills[command.skillId] ?? 0;
  if (
    !node ||
    !s.discovered.includes(node.id) ||
    level !== command.fromLevel ||
    level >= node.max ||
    s.years < 1 ||
    !eligibleSkill(s, node.id)
  )
    throw Error("Skill purchase unavailable.");
  return {
    ...state,
    service: {
      ...s,
      years: s.years - 1,
      skills: { ...s.skills, [node.id]: level + 1 },
      discovered: revealedNeighbors(s.discovered, node.id),
    },
  };
}
