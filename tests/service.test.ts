import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkshop,
  reducer,
  advanceWorkshop,
} from "../src/game/engine.ts";
import {
  createMachine,
  earnings,
  upgradePrice,
  refitPrice,
} from "../src/game/machines.ts";
import {
  applyServiceCommand,
  retirementPreview,
  pointCost,
  eligibleSkill,
} from "../src/game/service/progression.ts";
import {
  derivedStats,
  productionModifiers,
  machinePrice,
  storagePrice,
} from "../src/game/service/stats.ts";
import { emptyService } from "../src/game/service/types.ts";
import type { ServiceCommand } from "../src/game/service/types.ts";
import { SKILLS, CONNECTIONS } from "../src/config/continuum/skills.ts";
import { RETIREMENT } from "../src/config/retirement.ts";
import { decodeSave, SAVE_VERSION } from "../src/game/codec.ts";
import { replay } from "../src/cloud/replay.ts";
import { synchronize } from "../src/cloud/server.ts";
import type { SaveRepository } from "../src/cloud/server.ts";
import { CloudConflict, RULES_VERSION } from "../src/cloud/protocol.ts";
import type {
  CloudRecord,
  SyncRequest,
  SyncResult,
  CloudTransport,
} from "../src/cloud/protocol.ts";
import { GameSession } from "../src/cloud/session.ts";
import type { WorkshopState } from "../src/game/types.ts";
import type { GamePlatform } from "../src/platform/contracts.ts";
import type { User } from "@supabase/supabase-js";
import {
  clampCamera,
  zoomAt,
  pinchAt,
} from "../src/components/continuum/camera.ts";
const stamp = "2026-10-29T12:00:00Z";
function cashState(cash = 25000) {
  const s = createWorkshop();
  s.cash = s.lifetime = cash;
  s.machines[0].lifetime = cash;
  return s;
}
function retired(points = 80) {
  let cash = 0;
  for (let i = 0; i < points; i++) cash += pointCost(i);
  return applyServiceCommand(
    cashState(cash),
    { type: "retire", careerId: "career-initial" },
    "retirement-1",
    stamp,
  );
}
function buy(s: WorkshopState, id: string, count = 1) {
  for (let i = 0; i < count; i++)
    s = applyServiceCommand(
      s,
      {
        type: "buy-skill",
        sessionId: s.service!.session!.id,
        skillId: id,
        fromLevel: s.service!.skills[id] ?? 0,
      },
      crypto.randomUUID(),
      stamp,
    );
  return s;
}
function begin(s: WorkshopState) {
  return applyServiceCommand(
    s,
    { type: "begin-career", sessionId: s.service!.session!.id },
    crypto.randomUUID(),
    stamp,
  );
}
function allSkills() {
  let s = retired();
  s = buy(s, "first-day", 5);
  for (const id of [
    "overtime",
    "firm-hand",
    "employee-discount",
    "bulk-procurement",
    "accrued-leave",
    "prior-experience",
    "standard-procedure",
    "uninterrupted-service",
    "expanded-premises",
    "lifetime-warranty",
    "seniority",
    "reinstatement",
    "operational-excellence",
    "institutional-knowledge",
    "endless-shift",
  ])
    s = buy(s, id, SKILLS.find((n) => n.id === id)!.max);
  return s;
}
class Repo implements SaveRepository {
  record: CloudRecord | null = null;
  now = Date.parse(stamp);
  receipts = new Map<string, SyncResult>();
  async read(_p: string, id: string) {
    return {
      now: new Date(this.now).toISOString(),
      record: structuredClone(this.record),
      receipt: structuredClone(this.receipts.get(id)),
    };
  }
  async commit(_p: string, expected: number, next: SyncResult) {
    if (this.receipts.has(next.requestId))
      return this.receipts.get(next.requestId)!;
    if ((this.record?.revision ?? 0) !== expected)
      throw new CloudConflict(this.record!);
    this.record = structuredClone(next);
    this.receipts.set(next.requestId, next);
    return next;
  }
}
const request = (
  revision: number,
  command?: ServiceCommand,
  initial?: WorkshopState,
): SyncRequest => ({
  id: crypto.randomUUID(),
  revision,
  events: [],
  offline: false,
  rulesVersion: RULES_VERSION,
  command,
  initial,
});
test("sequential conversion has no first-retirement cap and lifetime cost includes spent points", () => {
  for (const cash of [0, 24999.99, 25000, 64999.99, 65000, 120000, 2000000]) {
    let remaining = cash,
      lifetime = 0;
    while (remaining >= pointCost(lifetime)) {
      remaining -= pointCost(lifetime);
      lifetime++;
    }
    assert.equal(retirementPreview(cash).points, lifetime);
  }
  const p = retirementPreview(100000, 10);
  assert.equal(p.points, 0);
  assert.equal(p.needed, 75000);
  assert.equal(retirementPreview(1e12).spent <= 1e12, true);
  let s = buy(retired(1), "first-day");
  assert.equal(s.service!.years, 0);
  s = begin(s);
  s.cash = 40000;
  s.lifetime += 40000;
  s.machines[0].lifetime = 40000;
  s = applyServiceCommand(
    s,
    { type: "retire", careerId: s.service!.careerId },
    "second",
    stamp,
  );
  assert.equal(s.service!.lifetimeYears, 2);
  assert.equal(s.service!.years, 1);
  assert.equal(s.service!.skills["first-day"], 1);
});
test("retirement resets the entire career, preserves lifetime and history, and freezes old production", () => {
  const s = cashState(65000);
  s.machines.push({
    ...createMachine("b", "bottler"),
    tier: "premium",
    upgrades: [
      "bottle-loader",
      "flow-regulator",
      "auto-capper",
      "crate-conveyor",
    ],
  });
  s.slots = [s.machines[0].id, "b", null, null];
  const next = applyServiceCommand(
    s,
    { type: "retire", careerId: "career-initial" },
    "r",
    stamp,
  );
  assert.equal(next.cash, 0);
  assert.deepEqual(next.machines, []);
  assert.deepEqual(next.slots, [null, null]);
  assert.equal(next.lifetime, s.lifetime);
  assert.equal(next.service!.years, 2);
  assert.equal(next.service!.recognition, true);
  assert.equal(reducer(next, { type: "tick", elapsedMs: 1e9 }), next);
  assert.equal(reducer(next, { type: "reset" }), next);
  assert.equal(reducer(next, { type: "buy-slot" }), next);
  assert.throws(() =>
    applyServiceCommand(
      next,
      { type: "retire", careerId: "career-initial" },
      "again",
      stamp,
    ),
  );
  assert.throws(() =>
    applyServiceCommand(
      cashState(24999),
      { type: "retire", careerId: "career-initial" },
      "zero",
      stamp,
    ),
  );
  assert.deepEqual(decodeSave(JSON.stringify({ version: 5, ...next })), next);
});
test("discovery is separate from AND/OR eligibility and every one of 16 authored nodes is reachable", () => {
  let s = retired();
  assert.deepEqual(s.service!.discovered, ["first-day"]);
  assert.throws(() => buy(s, "overtime"));
  s = buy(s, "first-day");
  assert.equal(s.service!.discovered.length, 7);
  assert.equal(
    CONNECTIONS.filter(([a, b]) => a === "first-day" || b === "first-day")
      .length,
    6,
  );
  s = buy(s, "overtime", 2);
  assert.equal(eligibleSkill(s.service!, "standard-procedure"), true);
  assert.equal(eligibleSkill(s.service!, "operational-excellence"), false);
  s = buy(s, "bulk-procurement", 2);
  assert.equal(eligibleSkill(s.service!, "operational-excellence"), true);
  const complete = allSkills();
  assert.equal(SKILLS.length, 16);
  assert.equal(complete.service!.discovered.length, 16);
  assert.equal(Object.keys(complete.service!.skills).length, 16);
  assert.deepEqual(
    decodeSave(JSON.stringify({ version: 5, ...complete })),
    complete,
  );
});
test("skills enforce session, one-point cost, prerequisites, max and stale level confirmation", () => {
  let s = retired(6);
  const first = {
    type: "buy-skill",
    sessionId: s.service!.session!.id,
    skillId: "first-day",
    fromLevel: 0,
  } as const;
  s = applyServiceCommand(s, first, "p", stamp);
  assert.equal(s.service!.years, 5);
  assert.throws(() => applyServiceCommand(s, first, "again", stamp));
  s = buy(s, "first-day", 4);
  assert.throws(() => buy(s, "first-day"));
  s = buy(s, "firm-hand");
  assert.equal(s.service!.years, 0);
  assert.throws(() => buy(s, "overtime"));
  s = begin(s);
  assert.throws(() => buy(s, "firm-hand"));
  assert.equal(s.service!.session, null);
});
test("grouped bonuses add within groups and multiply across groups; quality stays separate", () => {
  const s = begin(allSkills()),
    stats = derivedStats(s.service),
    p = productionModifiers(s);
  assert.equal(stats.global, 1.4000000000000001);
  assert.equal(stats.manual, 0.4);
  assert.equal(stats.automated, 0.24);
  assert.equal(stats.offlineMs, 16 * 3600000);
  assert.equal(stats.storage, 5);
  assert.equal(stats.startingCash, 500);
  assert.equal(s.machines.length, 2);
  assert.equal(s.slots.length, 5);
  assert.equal(s.cash, 500);
  assert.equal(machinePrice("bottler", s.service), 187.5);
  assert.equal(upgradePrice(createMachine("x"), "motor", s.service), 28);
  const silver = { ...createMachine("x"), tier: "silver" };
  assert.equal(upgradePrice(silver, "motor", s.service), 68.25);
  assert.equal(refitPrice(silver, s.service), 3200);
  assert.equal(storagePrice(s), 50);
  const manual = {
    ...createMachine("m"),
    manualCycle: true,
    phase: "collect" as const,
  };
  assert.equal(earnings(manual, p), 16.8);
  const bottle = {
    ...createMachine("b", "bottler"),
    phase: "collect" as const,
    bottler: { ...createMachine("b", "bottler").bottler!, fill: 0.97 },
  };
  const m = {
    ...s,
    machines: [manual, bottle],
    slots: ["m", "b", null, null, null],
  };
  const after = reducer(
    reducer(m, {
      type: "operate",
      machineId: "m",
      action: { type: "collect" },
    }),
    { type: "operate", machineId: "b", action: { type: "collect" } },
  );
  assert.equal(Math.round((after.cash - s.cash) * 100), 11760);
  const forged = {
    ...s.service!,
    skills: {
      "employee-discount": 100,
      "bulk-procurement": 100,
      "lifetime-warranty": 100,
      "accrued-leave": 100,
    },
  };
  assert.equal(derivedStats(forged).machineDiscount, 0.5);
  assert.equal(derivedStats(forged).prestigeDiscount, 0.4);
  assert.equal(derivedStats(forged).offlineMs, 24 * 3600000);
});
test("speed modifies durations, early-career boundary splits exactly, and manual cycle classification persists", () => {
  const s = begin(allSkills());
  s.service!.careerMs = RETIREMENT.seniorityMs - 500;
  s.machines = [
    {
      ...createMachine("p"),
      upgrades: ["feeder", "motor", "stamper", "collector"],
    },
    {
      ...createMachine("b", "bottler"),
      upgrades: [
        "bottle-loader",
        "flow-regulator",
        "auto-capper",
        "crate-conveyor",
      ],
    },
  ];
  s.slots = ["p", "b", null, null, null];
  const big = advanceWorkshop(s, 60000, true);
  let small = s;
  for (let t = 0; t < 60000; t += 50) small = advanceWorkshop(small, 50, true);
  assert.equal(big.bills, small.bills);
  assert.equal(big.cash, small.cash);
  for (let i = 0; i < 2; i++)
    assert.ok(
      Math.abs(big.machines[i].progress - small.machines[i].progress) < 1e-6,
    );
  let manual = reducer(createWorkshop(), {
    type: "operate",
    machineId: "press-initial",
    action: { type: "feed" },
  });
  assert.equal(manual.machines[0].manualCycle, true);
  assert.deepEqual(
    decodeSave(JSON.stringify({ version: 5, ...manual })),
    manual,
  );
});
test("offline skill earnings use shared rules, stop partial machines, and consume a capped absence once", async () => {
  const repo = new Repo();
  const boot = await synchronize(
    "p",
    request(0, undefined, cashState(25000)),
    repo,
  );
  let out = await synchronize(
    "p",
    request(boot.revision, { type: "retire", careerId: "career-initial" }),
    repo,
  );
  out = await synchronize(
    "p",
    request(out.revision, {
      type: "buy-skill",
      sessionId: out.state.service!.session!.id,
      skillId: "first-day",
      fromLevel: 0,
    }),
    repo,
  );
  out = await synchronize(
    "p",
    request(out.revision, {
      type: "begin-career",
      sessionId: out.state.service!.session!.id,
    }),
    repo,
  );
  // Inject a server fixture after validated transactions, never a client-provided service save.
  repo.record!.state = begin(allSkills());
  repo.record!.state.machines = [
    {
      ...createMachine("auto"),
      upgrades: ["feeder", "motor", "stamper", "collector"],
    },
    {
      ...createMachine("partial", "bottler"),
      upgrades: ["crate-conveyor"],
      phase: "collect",
    },
  ];
  repo.record!.state.slots = ["auto", "partial", null, null, null];
  const before = structuredClone(repo.record!.state);
  repo.now += 30 * 3600000;
  const req = request(out.revision);
  req.offline = true;
  const result = await synchronize("p", req, repo);
  const expected = replay(before, [], 16 * 3600000, true).state;
  assert.equal(result.state.cash, expected.cash);
  assert.equal(result.state.machines[1].phase, "load");
  assert.equal(result.state.machines[1].bills, 1);
  assert.equal(result.reports[0].eligibleMs, 16 * 3600000);
  assert.equal(
    (await synchronize("p", req, repo)).state.cash,
    result.state.cash,
  );
  const repeat = await synchronize("p", request(result.revision), repo);
  assert.equal(repeat.state.cash, result.state.cash);
});
test("cloud retire/purchase/begin operations are atomic, idempotent, owner-scoped and old clients cannot erase service", async () => {
  const repo = new Repo(),
    boot = await synchronize(
      "p",
      request(0, undefined, cashState(65000)),
      repo,
    ),
    r = request(boot.revision, { type: "retire", careerId: "career-initial" });
  const results = await Promise.allSettled([
    synchronize("p", r, repo),
    synchronize("p", { ...r, id: crypto.randomUUID() }, repo),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(repo.record!.state.service!.years, 2);
  assert.deepEqual((await synchronize("p", r, repo)).state, repo.record!.state);
  const id = repo.record!.state.service!.session!.id;
  const purchase = request(repo.record!.revision, {
    type: "buy-skill",
    sessionId: id,
    skillId: "first-day",
    fromLevel: 0,
  });
  const bought = await synchronize("p", purchase, repo);
  assert.equal(bought.state.service!.years, 1);
  assert.equal(
    (await synchronize("p", purchase, repo)).revision,
    bought.revision,
  );
  repo.now += 24 * 3600000;
  const idle = await synchronize("p", request(bought.revision), repo);
  assert.equal(idle.state.cash, 0);
  assert.equal(idle.state.bills, 0);
  await assert.rejects(
    synchronize("p", { ...request(idle.revision), rulesVersion: 2 }, repo),
    /update required/,
  );
  const work = await synchronize(
    "p",
    request(idle.revision, { type: "begin-career", sessionId: id }),
    repo,
  );
  assert.equal(work.state.machines.length, 1);
  assert.equal(work.state.service!.years, 1);
  await assert.rejects(
    synchronize(
      "p",
      request(work.revision, { type: "begin-career", sessionId: id }),
      repo,
    ),
    /session changed/,
  );
  await assert.rejects(
    synchronize("other", request(0, undefined, work.state), new Repo()),
    /cannot be imported/,
  );
});
test("schema 5 migrates unretired saves without loss and rejects fabricated service graphs", () => {
  const old = cashState(12345);
  assert.deepEqual(decodeSave(JSON.stringify({ version: 4, ...old })), old);
  assert.equal(SAVE_VERSION, 5);
  const valid = retired(3);
  for (const mutate of [
    (s: WorkshopState) => s.service!.years++,
    (s: WorkshopState) => (s.service!.skills["unknown"] = 1),
    (s: WorkshopState) =>
      Object.defineProperty(s.service!.skills, "__proto__", {
        value: 1,
        enumerable: true,
      }),
    (s: WorkshopState) => s.service!.discovered.push("overtime"),
    (s: WorkshopState) => s.machines.push(createMachine("bad")),
  ]) {
    const s = structuredClone(valid);
    mutate(s);
    assert.equal(decodeSave(JSON.stringify({ version: 5, ...s })), null);
  }
});
test("camera anchor remains fixed while zooming and world/zoom limits are bounded", () => {
  const c = { x: 40, y: -60, zoom: 0.7 },
    a = { x: 100, y: 150 };
  const z = zoomAt(c, 1.1, a, 800, 600);
  assert.ok(
    Math.abs((a.x - 400) / c.zoom + c.x - ((a.x - 400) / z.zoom + z.x)) < 1e-8,
  );
  assert.equal(clampCamera({ x: 1e6, y: -1e6, zoom: 100 }).zoom, 1.6);
});
test("interrupted service transaction survives reload and retries its receipt before showing the reset", async () => {
  const data = new Map<string, string>();
  let now = 0;
  const host: GamePlatform = {
    sessionId: () => "service-test",
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
      removeItem: (k) => {
        data.delete(k);
      },
    },
    lifecycle: {
      isActive: () => true,
      now: () => now,
      subscribe: () => () => {},
    },
    feedback: () => {},
  };
  const repo = new Repo();
  repo.record = await synchronize(
    "player",
    request(0, undefined, cashState()),
    repo,
  );
  let lose = false;
  const transport: CloudTransport = {
    peek: async () => structuredClone(repo.record),
    commit: async (r) => {
      const out = await synchronize("player", r, repo);
      if (r.command?.type === "retire" && lose) {
        lose = false;
        throw Error("Connection interrupted");
      }
      return out;
    },
    acknowledge: async () => {},
  };
  let session = new GameSession(host);
  assert.equal(session.getSnapshot().servicePending, false);
  await session.attach({ id: "player" } as User, transport);
  lose = true;
  await assert.rejects(
    session.serviceOperation({ type: "retire", careerId: "career-initial" }),
  );
  assert.equal(session.getSnapshot().state.service, undefined);
  assert.equal(session.getSnapshot().servicePending, true);
  session = new GameSession(host);
  assert.equal(session.getSnapshot().servicePending, true);
  await session.attach({ id: "player" } as User, transport);
  assert.equal(session.getSnapshot().state.service!.years, 1);
  assert.equal(session.getSnapshot().state.service!.history.length, 1);
  assert.equal(session.getSnapshot().state.machines.length, 0);
  assert.equal(session.getSnapshot().servicePending, false);
});

test("two-pointer pinch preserves the world point under a moving midpoint, including zoom clamping", () => {
  const camera = { x: 40, y: -20, zoom: 1 },
    previous = { x: 250, y: 200 },
    other = { x: 450, y: 400 },
    next = { x: 50, y: 0 };
  const result = pinchAt(camera, previous, next, other, 800, 600),
    oldMid = { x: 350, y: 300 },
    newMid = { x: 250, y: 200 };
  assert.equal(result.zoom, 1.6);
  assert.ok(
    Math.abs(
      (oldMid.x - 400) / camera.zoom +
        camera.x -
        ((newMid.x - 400) / result.zoom + result.x),
    ) < 1e-8,
  );
  assert.ok(
    Math.abs(
      (oldMid.y - 300) / camera.zoom +
        camera.y -
        ((newMid.y - 300) / result.zoom + result.y),
    ) < 1e-8,
  );
});
