import { SKILLS, SKILL_BY_ID } from "../../config/continuum/skills.ts";
import { eligibleSkill, revealedNeighbors } from "./progression.ts";
import type { ServiceProgress } from "./types.ts";
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const money = (v: unknown): v is number =>
  typeof v === "number" &&
  v >= 0 &&
  (Number.isSafeInteger(v) ||
    (Number.isSafeInteger(Math.round(v * 100)) &&
      Math.abs(v * 100 - Math.round(v * 100)) < 1e-5));
const id = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 128;
const date = (v: unknown): v is string =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
/** Permanent points are never inferred from cash or accepted as an initial cloud import. */
export function parseService(v: unknown): ServiceProgress | null {
  if (
    !obj(v) ||
    !integer(v.years) ||
    !integer(v.lifetimeYears) ||
    v.years > v.lifetimeYears ||
    typeof v.recognition !== "boolean" ||
    !obj(v.skills) ||
    !Array.isArray(v.discovered) ||
    !Array.isArray(v.history) ||
    !id(v.careerId) ||
    !money(v.retiredEarnings) ||
    !integer(v.retiredUnits) ||
    !money(v.grantedCash) ||
    typeof v.careerMs !== "number" ||
    !Number.isFinite(v.careerMs) ||
    v.careerMs < 0
  )
    return null;
  if (
    Object.entries(v.skills).some(
      ([id, level]) =>
        !Object.hasOwn(SKILL_BY_ID, id) ||
        !integer(level) ||
        level < 1 ||
        level > SKILL_BY_ID[id].max,
    )
  )
    return null;
  if (
    v.history.some(
      (h) =>
        !obj(h) ||
        !id(h.id) ||
        !date(h.at) ||
        !money(h.cash) ||
        !integer(h.awarded) ||
        h.awarded < 1 ||
        !money(h.lifetime) ||
        !integer(h.units),
    )
  )
    return null;
  const s = v as unknown as ServiceProgress;
  if (
    new Set(s.history.map((h) => h.id)).size !== s.history.length ||
    s.history.reduce((n, h) => n + h.awarded, 0) !== s.lifetimeYears ||
    s.years + Object.values(s.skills).reduce((n, l) => n + l, 0) !==
      s.lifetimeYears ||
    s.recognition !== s.history.length > 0
  )
    return null;
  if (SKILLS.some((n) => (s.skills[n.id] ?? 0) > 0 && !eligibleSkill(s, n.id)))
    return null;
  let revealed = ["first-day"];
  for (const id of Object.keys(s.skills))
    revealed = revealedNeighbors(revealed, id);
  if (
    new Set(s.discovered).size !== s.discovered.length ||
    s.discovered.length !== revealed.length ||
    s.discovered.some((id) => !revealed.includes(id))
  )
    return null;
  if (s.session !== null) {
    const t = s.session,
      last = s.history.at(-1);
    if (
      !obj(t) ||
      !id(t.id) ||
      !integer(t.award) ||
      t.award < 1 ||
      !date(t.startedAt) ||
      typeof t.transitionSeen !== "boolean" ||
      t.first !== (s.history.length === 1) ||
      last?.id !== t.id ||
      last.awarded !== t.award ||
      s.careerId !== t.id
    )
      return null;
  }
  return s;
}
