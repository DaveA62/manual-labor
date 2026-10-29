export type EffectGroup =
  | "global"
  | "manual"
  | "automated"
  | "offline"
  | "speed"
  | "earlySpeed"
  | "machineDiscount"
  | "upgradeDiscount"
  | "prestigedUpgradeDiscount"
  | "prestigeDiscount"
  | "startingCash"
  | "storage"
  | "offlineMs"
  | "startingPresses";
export interface Requirement {
  id: string;
  level: number;
}
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  region: "Origin" | "Production" | "Industry" | "Legacy" | "Convergence";
  x: number;
  y: number;
  max: number;
  prerequisites: { all?: Requirement[]; any?: Requirement[] };
  effects: { group: EffectGroup; value: number }[];
}
const r = (id: string, level = 1): Requirement => ({ id, level });
const node = (
  id: string,
  name: string,
  description: string,
  region: SkillDefinition["region"],
  x: number,
  y: number,
  max: number,
  prerequisites: SkillDefinition["prerequisites"],
  group: EffectGroup,
  value: number,
): SkillDefinition => ({
  id,
  name,
  description,
  region,
  x,
  y,
  max,
  prerequisites,
  effects: [{ group, value }],
});
export const SKILLS: readonly SkillDefinition[] = [
  node(
    "first-day",
    "The First Day",
    "+20% global machine earnings per level.",
    "Origin",
    0,
    0,
    5,
    {},
    "global",
    0.2,
  ),
  node(
    "overtime",
    "Overtime",
    "+5% automated production speed per level.",
    "Production",
    -260,
    -230,
    5,
    { all: [r("first-day")] },
    "speed",
    0.05,
  ),
  node(
    "firm-hand",
    "Firm Hand",
    "+8% earnings for cycles with a manual action per level.",
    "Production",
    -410,
    40,
    5,
    { all: [r("first-day")] },
    "manual",
    0.08,
  ),
  node(
    "standard-procedure",
    "Standard Procedure",
    "+10% global machine earnings per level.",
    "Production",
    -610,
    -220,
    3,
    { any: [r("overtime", 2), r("firm-hand", 2)] },
    "global",
    0.1,
  ),
  node(
    "uninterrupted-service",
    "Uninterrupted Service",
    "+20% automated production speed.",
    "Production",
    -860,
    -400,
    1,
    { all: [r("standard-procedure", 3)] },
    "speed",
    0.2,
  ),
  node(
    "employee-discount",
    "Employee Discount",
    "−5% machine purchase prices per level.",
    "Industry",
    240,
    -250,
    5,
    { all: [r("first-day")] },
    "machineDiscount",
    0.05,
  ),
  node(
    "bulk-procurement",
    "Bulk Procurement",
    "−4% machine upgrade prices per level.",
    "Industry",
    420,
    20,
    5,
    { all: [r("first-day")] },
    "upgradeDiscount",
    0.04,
  ),
  node(
    "expanded-premises",
    "Expanded Premises",
    "+1 permanent Storage bay per level.",
    "Industry",
    650,
    -210,
    3,
    { any: [r("employee-discount", 2), r("bulk-procurement", 2)] },
    "storage",
    1,
  ),
  node(
    "lifetime-warranty",
    "Lifetime Warranty",
    "−20% individual machine refit fees.",
    "Industry",
    930,
    -100,
    1,
    { all: [r("expanded-premises", 2)] },
    "prestigeDiscount",
    0.2,
  ),
  node(
    "accrued-leave",
    "Accrued Leave",
    "+2 hours offline capacity per level.",
    "Legacy",
    -140,
    300,
    4,
    { all: [r("first-day")] },
    "offlineMs",
    7200000,
  ),
  node(
    "prior-experience",
    "Prior Experience",
    "Starting cash: 2× basic Cash Press list price per level.",
    "Legacy",
    220,
    290,
    5,
    { all: [r("first-day")] },
    "startingCash",
    1,
  ),
  node(
    "seniority",
    "Seniority",
    "+10% timed production speed per level for the first 10 career minutes.",
    "Legacy",
    110,
    650,
    3,
    { any: [r("accrued-leave", 2), r("prior-experience", 2)] },
    "earlySpeed",
    0.1,
  ),
  node(
    "reinstatement",
    "Reinstatement",
    "Begin each career with one additional basic Cash Press.",
    "Legacy",
    400,
    880,
    1,
    { all: [r("seniority", 3)] },
    "startingPresses",
    1,
  ),
  node(
    "operational-excellence",
    "Operational Excellence",
    "+8% earnings for cycles without manual input per level.",
    "Convergence",
    -90,
    -490,
    3,
    { all: [r("overtime", 2), r("bulk-procurement", 2)] },
    "automated",
    0.08,
  ),
  node(
    "institutional-knowledge",
    "Institutional Knowledge",
    "−5% upgrade prices on refitted machines per level.",
    "Convergence",
    620,
    410,
    3,
    { all: [r("expanded-premises"), r("seniority")] },
    "prestigedUpgradeDiscount",
    0.05,
  ),
  node(
    "endless-shift",
    "Endless Shift",
    "+15% fully automated offline earnings.",
    "Convergence",
    -570,
    570,
    1,
    { all: [r("uninterrupted-service"), r("accrued-leave", 2)] },
    "offline",
    0.15,
  ),
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((n) => [n.id, n]));
/** Discovery links are deliberately independent of eligibility requirements. */
export const CONNECTIONS: readonly (readonly [string, string])[] = [
  ["first-day", "overtime"],
  ["first-day", "firm-hand"],
  ["first-day", "employee-discount"],
  ["first-day", "bulk-procurement"],
  ["first-day", "accrued-leave"],
  ["first-day", "prior-experience"],
  ["overtime", "standard-procedure"],
  ["firm-hand", "standard-procedure"],
  ["standard-procedure", "uninterrupted-service"],
  ["employee-discount", "expanded-premises"],
  ["bulk-procurement", "expanded-premises"],
  ["expanded-premises", "lifetime-warranty"],
  ["accrued-leave", "seniority"],
  ["prior-experience", "seniority"],
  ["seniority", "reinstatement"],
  ["overtime", "operational-excellence"],
  ["bulk-procurement", "operational-excellence"],
  ["expanded-premises", "institutional-knowledge"],
  ["seniority", "institutional-knowledge"],
  ["uninterrupted-service", "endless-shift"],
  ["accrued-leave", "endless-shift"],
  ["firm-hand", "accrued-leave"],
  ["employee-discount", "prior-experience"],
  ["institutional-knowledge", "reinstatement"],
];
