import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";
import { synchronize } from "../src/cloud/server.ts";
import type { SaveRepository } from "../src/cloud/server.ts";
import {
  CloudConflict,
  OFFLINE_CAP_MS,
  RULES_VERSION,
} from "../src/cloud/protocol.ts";
import type {
  CloudRecord,
  CloudTransport,
  SyncRequest,
  SyncResult,
} from "../src/cloud/protocol.ts";
import { offlineReport, replay, validEvents } from "../src/cloud/replay.ts";
import { createMachine, cycleDuration } from "../src/game/machines.ts";
import { createWorkshop, reducer } from "../src/game/engine.ts";
import { decodeSave } from "../src/game/codec.ts";
import type {
  MachineInstance,
  UpgradeId,
  WorkshopState,
} from "../src/game/types.ts";
import { GameSession, requestId } from "../src/cloud/session.ts";
import type { GamePlatform } from "../src/platform/contracts.ts";
const all: UpgradeId[] = ["feeder", "motor", "collector", "stamper"];
function full(id: string, tier = "cash"): MachineInstance {
  return { ...createMachine(id), tier, upgrades: [...all] };
}
function workshop(machines: MachineInstance[], cash = 0): WorkshopState {
  machines = machines.map((m, i) => ({
    ...m,
    lifetime: m.lifetime + (i === 0 ? cash : 0),
  }));
  return {
    cash,
    lifetime: machines.reduce((n, m) => n + m.lifetime, 0),
    bills: machines.reduce((n, m) => n + m.bills, 0),
    machines,
    slots: [...machines.map((m) => m.id), null],
  };
}
class Repository implements SaveRepository {
  record: CloudRecord | null = null;
  now = Date.parse("2026-10-29T00:00:00Z");
  receipts = new Map<string, SyncResult>();
  commits = 0;
  async read(_id: string, request: string) {
    return {
      now: new Date(this.now).toISOString(),
      record: structuredClone(this.record),
      receipt: structuredClone(this.receipts.get(request)),
    };
  }
  async commit(_id: string, revision: number, next: SyncResult) {
    const receipt = this.receipts.get(next.requestId);
    if (receipt) return receipt;
    if ((this.record?.revision ?? 0) !== revision)
      throw new CloudConflict(this.record!);
    this.record = structuredClone(next);
    this.receipts.set(next.requestId, next);
    this.commits++;
    return next;
  }
  transport: CloudTransport = {
    peek: async () => structuredClone(this.record),
    commit: (request) => synchronize("player", request, this),
    acknowledge: async (id) => {
      if (this.record)
        this.record.reports = this.record.reports.filter((r) => r.id !== id);
    },
  };
}
function request(revision: number, initial?: WorkshopState): SyncRequest {
  return {
    id: requestId(),
    revision,
    events: [],
    initial,
    offline: true,
    rulesVersion: RULES_VERSION,
  };
}
function host(windowId = "test") {
  const data = new Map<string, string>();
  const listeners = new Set<(v: boolean) => void>();
  let active = true,
    now = 0;
  const platform: GamePlatform = {
    sessionId: () => windowId,
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
      now: () => now,
      isActive: () => active,
      subscribe: (fn) => {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
    },
    feedback: () => {},
  };
  return {
    data,
    platform,
    activate(value: boolean) {
      active = value;
      listeners.forEach((fn) => fn(value));
    },
    advance(ms: number) {
      now += ms;
    },
  };
}
const user = { id: "player", is_anonymous: true } as User;

test("cloud bootstrap preserves legacy migration, IDs, tiers, order, upgrades and wallet once", async () => {
  const repo = new Repository();
  const migrated = decodeSave(
    JSON.stringify({
      version: 2,
      ...workshop(
        [
          { ...full("silver", "silver"), phase: "lift", progress: 0.42 },
          createMachine("manual"),
        ],
        500,
      ),
    }),
  )!;
  const first = await synchronize("player", request(0, migrated), repo);
  assert.deepEqual(first.state, migrated);
  const forged = workshop([full("gold", "gold")], 999999);
  const second = await synchronize("player", request(1, forged), repo);
  assert.deepEqual(second.state, migrated);
  assert.equal(second.schemaVersion, 5);
});
test("server caps independent tier earnings at eight hours, partial automation stops, manual presses do not run", async () => {
  const repo = new Repository();
  const original = workshop([
    full("a"),
    { ...full("b", "gold"), upgrades: [...all, "printing"] },
    {
      ...createMachine("partial"),
      phase: "collect",
      progress: 0.4,
      upgrades: ["collector"],
    },
    createMachine("manual"),
    { ...createMachine("refitted"), tier: "silver" },
  ]);
  await synchronize("player", request(0, original), repo);
  repo.now += 24 * 3600000;
  const result = await synchronize("player", request(1), repo);
  const expected = replay(original, [], OFFLINE_CAP_MS).state;
  assert.deepEqual(result.state, expected);
  assert.equal(result.state.machines[2].bills, 1);
  assert.equal(result.state.machines[2].phase, "feed");
  assert.equal(result.state.machines[3].bills, 0);
  assert.equal(result.state.machines[4].bills, 0);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].eligibleMs, OFFLINE_CAP_MS);
  assert.equal(result.reports[0].elapsedMs, 24 * 3600000);
  assert.equal(result.reports[0].total, result.state.cash);
  assert.equal(
    result.state.machines[1].lifetime,
    Math.floor(OFFLINE_CAP_MS / cycleDuration(original.machines[1])) * 150,
  );
});
test("request replay, concurrent duplicate claims, and a second claim at the same time cannot double pay", async () => {
  const repo = new Repository();
  await synchronize("player", request(0, workshop([full("a")])), repo);
  repo.now += 60000;
  const claim = request(1);
  const [a, b] = await Promise.all([
    synchronize("player", claim, repo),
    synchronize("player", claim, repo),
  ]);
  assert.deepEqual(a, b);
  assert.equal(repo.commits, 2);
  const again = await synchronize("player", request(2), repo);
  assert.equal(again.state.cash, a.state.cash);
  assert.equal(again.reports.length, 1);
});
test("simultaneous different sessions conflict atomically and stale saves cannot overwrite", async () => {
  const repo = new Repository();
  await synchronize("player", request(0, workshop([full("a")])), repo);
  repo.now += 60000;
  const results = await Promise.allSettled([
    synchronize("player", request(1), repo),
    synchronize("player", request(1), repo),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(repo.commits, 2);
  const rejected = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.ok(rejected.reason instanceof CloudConflict);
  const cash = repo.record!.state.cash;
  await assert.rejects(
    synchronize("player", request(1, createWorkshop()), repo),
    CloudConflict,
  );
  assert.equal(repo.record!.state.cash, cash);
});
test("untrusted elapsed, payout totals, invalid actions, and unknown rules cannot mutate cloud currency", async () => {
  const repo = new Repository();
  await synchronize("player", request(0, workshop([createMachine("a")])), repo);
  const malicious = {
    ...request(1),
    elapsedMs: 1e20,
    payout: 1e10,
    state: workshop([full("a")], 1e10),
  };
  const result = await synchronize("player", malicious, repo);
  assert.equal(result.state.cash, 0);
  await assert.rejects(
    synchronize("player", { ...request(2), rulesVersion: 99 }, repo),
    /update required/,
  );
  assert.equal(
    validEvents([
      { id: "event", at: 0, action: { type: "tick", elapsedMs: 1e20 } },
    ]),
    false,
  );
  assert.equal(
    validEvents([
      { id: "event", at: 0, action: { type: "set-cash", cash: 1e20 } },
    ]),
    false,
  );
  assert.equal(
    validEvents([
      {
        id: "event",
        at: 0,
        action: {
          type: "operate",
          machineId: "a",
          action: { type: "turn", amount: Infinity },
        },
      },
    ]),
    false,
  );
  assert.equal(repo.record!.state.cash, 0);
});
test("server replays paid upgrades and individual prestige through the shared reducer", async () => {
  const repo = new Repository();
  const state = workshop([full("a"), full("b", "silver")], 1000);
  await synchronize("player", request(0, state), repo);
  const refit = {
    ...request(1),
    events: [
      {
        id: requestId(),
        at: 0,
        action: { type: "refit" as const, machineId: "a", fromTier: "cash" },
      },
    ],
  };
  const result = await synchronize("player", refit, repo);
  assert.equal(result.state.cash, 250);
  assert.equal(result.state.machines[0].tier, "silver");
  assert.deepEqual(result.state.machines[0].upgrades, []);
  assert.deepEqual(result.state.machines[1], state.machines[1]);
});
test("offline reports exclude empty periods and never modify the already-applied state", () => {
  const before = workshop([full("a")]),
    after = replay(before, [], 60000).state;
  assert.equal(offlineReport(before, before, 60000, requestId()), null);
  const report = offlineReport(before, after, 60000, requestId())!;
  assert.equal(report.total, after.cash);
  assert.equal(after.cash, 75);
});
test("client conflict choice preserves local recovery snapshots instead of silently overwriting cloud", async () => {
  const repo = new Repository();
  await synchronize("player", request(0, workshop([full("cloud")], 100)), repo);
  const h = host();
  h.data.set(
    "manual-labor:save:v2",
    JSON.stringify({ version: 3, ...workshop([createMachine("local")], 50) }),
  );
  const session = new GameSession(h.platform);
  await session.attach(user, repo.transport);
  assert.equal(session.getSnapshot().status, "Conflict");
  assert.equal(session.getSnapshot().state.cash, 50);
  assert.equal(repo.record!.state.cash, 100);
  await session.resolveCloud();
  assert.equal(session.getSnapshot().state.cash, 100);
  assert.ok(h.data.get("manual-labor:recovery")?.includes("local"));
  session.stop();
});
test("network interruption retries the persisted request ID and retains actions added in flight", async () => {
  const repo = new Repository();
  const h = host();
  let release: () => void = () => {};
  let delayed = false;
  let calls = 0;
  const transport: CloudTransport = {
    ...repo.transport,
    commit: async (r) => {
      calls++;
      if (delayed)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return repo.transport.commit(r);
    },
  };
  const session = new GameSession(h.platform);
  await session.attach(user, transport);
  const id = session.getSnapshot().state.machines[0].id;
  session.dispatch({
    type: "operate",
    machineId: id,
    action: { type: "feed" },
  });
  delayed = true;
  const saving = session.sync();
  session.dispatch({
    type: "operate",
    machineId: id,
    action: { type: "turn", amount: 1 },
  });
  delayed = false;
  release();
  await saving;
  assert.equal(session.getSnapshot().state.machines[0].phase, "stamp");
  let fail = true;
  const ids: string[] = [];
  const interrupted: CloudTransport = {
    ...repo.transport,
    commit: async (r) => {
      ids.push(r.id);
      const result = await repo.transport.commit(r);
      if (fail) {
        fail = false;
        throw Error("Connection lost after commit");
      }
      return result;
    },
  };
  await session.attach(user, interrupted, true);
  assert.equal(session.getSnapshot().status, "Offline");
  await session.sync();
  assert.equal(ids[0], ids[1]);
  assert.equal(session.getSnapshot().status, "Synced");
  assert.ok(calls >= 2);
  session.stop();
});
test("local-only offline production is quarantined and Collect only acknowledges", async () => {
  const real = Date.now;
  let now = 100000000;
  Date.now = () => now;
  try {
    const h = host();
    const before = workshop([full("a")], 100);
    h.data.set(
      "manual-labor:save:v2",
      JSON.stringify({ version: 3, ...before }),
    );
    h.data.set(
      "manual-labor:local:v1",
      JSON.stringify({
        state: before,
        checkpoint: now - 24 * 3600000,
        unverified: false,
      }),
    );
    const session = new GameSession(h.platform);
    session.start();
    const earned = session.getSnapshot().state.cash;
    assert.ok(earned > 100);
    assert.equal(session.getSnapshot().report?.eligibleMs, OFFLINE_CAP_MS);
    session.acknowledge();
    assert.equal(session.getSnapshot().state.cash, earned);
    assert.equal(session.getSnapshot().report, null);
    const repo = new Repository();
    await session.attach(user, repo.transport);
    assert.equal(session.getSnapshot().status, "Conflict");
    assert.equal(repo.record, null);
    await session.resolveCloud();
    assert.equal(repo.record!.state.cash, 100);
    assert.ok(h.data.get("manual-labor:recovery")?.includes(String(earned)));
    session.stop();
    const next = new GameSession(h.platform);
    await next.attach(user, repo.transport);
    assert.equal(next.getSnapshot().state.cash, 100);
    next.stop();
  } finally {
    Date.now = real;
  }
});
test("guest linking on the same user ID never changes machine state or migrates twice", async () => {
  const repo = new Repository(),
    h = host(),
    session = new GameSession(h.platform);
  await session.attach(user, repo.transport);
  const state = session.getSnapshot().state;
  const commits = repo.commits;
  await session.attach(
    { ...user, is_anonymous: false, email: "verified@example.test" } as User,
    repo.transport,
  );
  assert.equal(session.getSnapshot().state, state);
  assert.equal(repo.commits, commits);
  assert.equal(session.getSnapshot().user?.is_anonymous, false);
  session.stop();
});

test("second device loads the same cloud account; another active window gets a conflict, not a lost journal", async () => {
  const repo = new Repository();
  const a = host("window-a"),
    b = { ...a.platform, sessionId: () => "window-b" };
  const first = new GameSession(a.platform);
  await first.attach(user, repo.transport);
  const id = first.getSnapshot().state.machines[0].id;
  first.dispatch({ type: "operate", machineId: id, action: { type: "feed" } });
  await first.sync();
  const second = new GameSession(b);
  await second.attach(user, repo.transport);
  assert.equal(second.getSnapshot().state.machines[0].phase, "raise");
  first.dispatch({
    type: "operate",
    machineId: id,
    action: { type: "turn", amount: 0.25 },
  });
  await first.sync();
  assert.equal(first.getSnapshot().status, "Conflict");
  assert.equal(first.getSnapshot().state.machines[0].progress, 0.25);
  assert.equal(repo.record!.state.machines[0].progress, 0);
  assert.ok(a.data.has("manual-labor:cloud:v1:player:window-a"));
  assert.ok(a.data.has("manual-labor:cloud:v1:player:window-b"));
  first.stop();
  second.stop();
});

test("a short return still creates a report when money was produced", async () => {
  const repo = new Repository();
  await synchronize("player", request(0, workshop([full("a")])), repo);
  repo.now += cycleDuration(full("a"));
  const result = await synchronize("player", request(1), repo);
  assert.equal(result.reports[0].total, 5);
});

test("an unearned partial manual cycle still requires a conflict choice before loading another save", async () => {
  const repo = new Repository();
  await synchronize(
    "player",
    request(0, workshop([createMachine("cloud")])),
    repo,
  );
  const h = host();
  const local = createWorkshop();
  local.machines[0].phase = "raise";
  local.machines[0].progress = 0.37;
  h.data.set("manual-labor:save:v2", JSON.stringify({ version: 3, ...local }));
  const session = new GameSession(h.platform);
  await session.attach(user, repo.transport);
  assert.equal(session.getSnapshot().status, "Conflict");
  assert.equal(session.getSnapshot().blocked, true);
  assert.equal(session.getSnapshot().state.machines[0].progress, 0.37);
  session.dispatch({
    type: "operate",
    machineId: local.machines[0].id,
    action: { type: "turn", amount: 0.25 },
  });
  assert.equal(session.getSnapshot().state.machines[0].progress, 0.37);
  session.keepLocal();
  assert.equal(session.getSnapshot().blocked, false);
  assert.equal(session.getSnapshot().state.machines[0].progress, 0.37);
  session.stop();
});
