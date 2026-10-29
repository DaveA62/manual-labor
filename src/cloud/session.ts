import type { User } from "@supabase/supabase-js";
import { createWorkshop, reducer } from "../game/engine.ts";
import { readSave, writeSave } from "../game/save.ts";
import { decodeSave, SAVE_VERSION } from "../game/codec.ts";
import type { WorkshopAction, WorkshopState } from "../game/types.ts";
import type { GamePlatform } from "../platform/contracts.ts";
import { createProductionClock } from "../runtime/clock.ts";
import { CloudConflict, RULES_VERSION } from "./protocol.ts";
import type {
  CloudRecord,
  CloudTransport,
  ShiftReport,
  SyncRequest,
  TimedAction,
} from "./protocol.ts";
import {
  offlineReport,
  replay,
  validatedState,
  validEvents,
  validReport,
  pristineSave,
} from "./replay.ts";
export function requestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues)
    globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.random() * 256;
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export type SyncStatus =
  | "Local only"
  | "Connecting"
  | "Syncing"
  | "Synced"
  | "Offline"
  | "Conflict"
  | "Error";
interface Pending {
  request: SyncRequest;
  endAt: number;
}
interface Cache {
  current?: WorkshopState;
  base: WorkshopState;
  revision: number;
  events: TimedAction[];
  anchor: number;
  pending?: Pending;
  reports: ShiftReport[];
  dismissed: string[];
}
interface LocalBranch {
  state: WorkshopState;
  checkpoint: number;
  importable?: WorkshopState;
  unverified: boolean;
  report?: ShiftReport;
}
export interface SessionView {
  state: WorkshopState;
  saved: boolean;
  status: SyncStatus;
  error: string;
  user: User | null;
  report: ShiftReport | null;
  conflict: CloudRecord | null;
  recovery: boolean;
  localUnverified: boolean;
  ready: boolean;
  authNotice: string;
  blocked: boolean;
}
const OWNER = "manual-labor:owner",
  LOCAL = "manual-labor:local:v1";

/** Central session coordinator. All production and cloud reconciliation are independent of React. */
export class GameSession {
  private host: GamePlatform;
  private transport: CloudTransport | null = null;
  private cache: Cache | null = null;
  private owner: string;
  private windowId: string;
  private startedOnce = false;
  private hadLocalCheckpoint = false;
  private cacheKey = (id: string) =>
    `manual-labor:cloud:v1:${id}:${this.windowId}`;
  private branch: LocalBranch;
  private listeners = new Set<() => void>();
  private view: SessionView;
  private flight = false;
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private running = false;
  private active = true;
  private intervals: ReturnType<typeof setInterval>[] = [];
  private cleanup: (() => void)[] = [];
  private offlineNext = false;
  private activeElapsed = 0;
  private detached = false;
  constructor(host: GamePlatform) {
    this.host = host;
    this.windowId = host.sessionId?.() ?? requestId();
    this.owner = this.get(OWNER) ?? "local";
    const state = readSave(host.storage);
    const local = this.parse<LocalBranch>(LOCAL);
    this.branch =
      local &&
      decodeSave(JSON.stringify({ version: SAVE_VERSION, ...local.state })) &&
      Number.isFinite(local.checkpoint)
        ? local
        : {
            state: this.owner === "local" ? state : createWorkshop(),
            checkpoint: Date.now(),
            unverified: false,
          };
    if (this.branch.report && !validReport(this.branch.report))
      this.branch.report = undefined;
    this.hadLocalCheckpoint = !!local;
    this.view = {
      state,
      saved: true,
      status: "Local only",
      error: "",
      user: null,
      report: null,
      conflict: null,
      recovery: false,
      localUnverified: this.branch.unverified,
      ready: false,
      authNotice: "",
      blocked: false,
    };
  }
  getSnapshot = () => this.view;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(patch: Partial<SessionView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private get(key: string) {
    try {
      return this.host.storage.getItem(key);
    } catch {
      return null;
    }
  }
  private parse<T>(key: string): T | null {
    try {
      return JSON.parse(this.get(key) ?? "null");
    } catch {
      return null;
    }
  }
  private put(key: string, value: unknown) {
    try {
      this.host.storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  private setOwner(owner: string) {
    this.owner = owner;
    try {
      this.host.storage.setItem(OWNER, owner);
    } catch {
      this.update({ saved: false });
    }
  }
  private backup(reason: string) {
    const previous = this.parse<unknown[]>("manual-labor:recovery") ?? [];
    this.put(
      "manual-labor:recovery",
      [
        {
          reason,
          owner: this.owner,
          at: Date.now(),
          state: this.view.state,
          cache: this.cache,
        },
        ...previous,
      ].slice(0, 5),
    );
  }
  persist = () => {
    let ok = writeSave(this.view.state, this.host.storage);
    if (this.cache && this.view.user) this.cache.current = this.view.state;
    if (this.cache && this.view.user)
      ok = this.put(this.cacheKey(this.view.user.id), this.cache) && ok;
    if (this.owner === "local") {
      this.branch = {
        ...this.branch,
        state: this.view.state,
        checkpoint: this.active ? Date.now() : this.branch.checkpoint,
      };
      ok = this.put(LOCAL, this.branch) && ok;
    }
    if (ok !== this.view.saved) this.update({ saved: ok });
  };
  start() {
    if (this.running) return;
    this.running = true;
    this.active = this.host.lifecycle.isActive();
    if (!this.startedOnce && this.owner === "local") {
      if (this.hadLocalCheckpoint) this.resumeLocal();
      else this.persist();
    }
    this.startedOnce = true;
    const clock = createProductionClock(this.host.lifecycle, (elapsedMs) => {
      this.activeElapsed += elapsedMs;
      this.dispatch({ type: "tick", elapsedMs });
    });
    this.intervals = [
      setInterval(clock.advance, 50),
      setInterval(() => {
        if (this.active) this.persist();
      }, 1000),
      setInterval(() => {
        if (this.active) void this.sync();
      }, 10000),
    ];
    this.cleanup = [
      clock.dispose,
      this.host.lifecycle.subscribe((active) => {
        this.active = active;
        if (!active) {
          this.branch.checkpoint = Date.now();
          this.persist();
          void this.sync(false, true);
          this.offlineNext = true;
        } else if (this.cache) {
          void this.sync(true);
        } else if (this.owner === "local") this.resumeLocal();
      }),
    ];
  }
  stop() {
    this.persist();
    this.generation++;
    this.flight = false;
    clearTimeout(this.syncTimer);
    this.running = false;
    this.intervals.forEach(clearInterval);
    this.cleanup.forEach((fn) => fn());
  }
  dispatch = (action: WorkshopAction) => {
    if (this.view.blocked) return;
    if (
      action.type !== "tick" &&
      this.cache &&
      this.cache.events.length >= 10000
    ) {
      this.update({ error: "Sync required before more actions." });
      return;
    }
    const next = reducer(this.view.state, action);
    if (next === this.view.state) return;
    if (action.type !== "tick" && this.cache) {
      this.cache.events.push({
        id: requestId(),
        at: Math.max(
          this.cache.events.at(-1)?.at ?? 0,
          Date.now() - this.cache.anchor,
        ),
        action,
      });
    }
    if (action.type === "reset") {
      this.backup("Before reset");
      if (this.cache) {
        this.cache.dismissed.push(...this.cache.reports.map((r) => r.id));
        this.cache.reports = [];
      }
      if (this.owner === "local")
        this.branch = {
          state: next,
          checkpoint: Date.now(),
          unverified: false,
        };
      this.update({ report: null, localUnverified: false });
    }
    this.update({ state: next });
    if (action.type !== "tick") {
      // Continuous crank motion checkpoints once a second; financial/discrete actions save immediately.
      if (
        action.type !== "operate" ||
        !["turn", "valve", "transfer", "cap"].includes(action.action.type)
      )
        this.persist();
      clearTimeout(this.syncTimer);
      this.syncTimer = setTimeout(() => {
        void this.sync();
      }, 750);
    }
  };
  private resumeLocal() {
    const elapsed = Math.max(0, Date.now() - this.branch.checkpoint);
    const before = this.view.state;
    const after = replay(before, [], elapsed).state;
    if (after !== before) {
      this.branch.importable ??= before;
      this.branch.unverified = true;
      const report = offlineReport(before, after, elapsed, requestId());
      if (report) {
        report.local = true;
        this.branch.report = report;
      }
      this.update({
        state: after,
        report: this.branch.report ?? null,
        localUnverified: true,
      });
    }
    if (this.branch.report) this.update({ report: this.branch.report });
    this.persist();
  }
  authError(message: string) {
    this.update({ status: "Error", error: message, ready: true });
  }
  setAuthNotice(message: string) {
    this.update({ authNotice: message });
  }
  setRecovery(value: boolean) {
    this.update({ recovery: value });
  }
  private restoredCache(id: string) {
    const c = this.parse<Cache>(this.cacheKey(id));
    try {
      if (
        c &&
        Number.isSafeInteger(c.revision) &&
        c.revision >= 0 &&
        Number.isFinite(c.anchor) &&
        validEvents(c.events) &&
        Array.isArray(c.reports) &&
        Array.isArray(c.dismissed)
      ) {
        validatedState(c.base);
        if (
          c.current &&
          !decodeSave(JSON.stringify({ version: SAVE_VERSION, ...c.current }))
        )
          c.current = undefined;
        c.reports = c.reports.filter(validReport);
        c.dismissed = c.dismissed.filter((id) => typeof id === "string");
        if (
          c.pending &&
          (!Number.isFinite(c.pending.endAt) ||
            !c.pending.request ||
            !validEvents(c.pending.request.events) ||
            !Number.isSafeInteger(c.pending.request.revision))
        )
          c.pending = undefined;
        // v1 outbox contains only unchanged Money Press intent; preserve interrupted requests.
        if (c.pending?.request.rulesVersion === 1)
          c.pending.request.rulesVersion = RULES_VERSION;
        return c;
      }
    } catch {
      /* Retain damaged cache for recovery. */
    }
    return null;
  }
  async attach(
    user: User | null,
    transport: CloudTransport | null,
    force = false,
  ) {
    if (
      !force &&
      this.view.user?.id === user?.id &&
      this.transport === transport
    ) {
      this.update({ user, ready: true });
      return;
    }
    this.persist();
    this.generation++;
    this.flight = false;
    this.detached = false;
    this.transport = transport;
    const previousOwner = this.owner;
    this.update({
      user,
      ready: true,
      error: "",
      conflict: null,
      status: user ? "Connecting" : "Local only",
      blocked: !!user && previousOwner !== "local" && previousOwner !== user.id,
    });
    if (!user || !transport) {
      this.cache = null;
      this.setOwner("local");
      this.update({
        state: this.branch.state,
        report: this.branch.report ?? null,
        localUnverified: this.branch.unverified,
        blocked: false,
      });
      return;
    }
    const cached = this.restoredCache(user.id);
    if (cached) {
      this.cache = cached;
      this.setOwner(user.id);
      const current = cached.current
        ? validatedState(cached.current)
        : replay(cached.base, cached.events, cached.events.at(-1)?.at ?? 0)
            .state;
      this.update({ state: current, blocked: false, localUnverified: false });
      this.offlineNext = true;
      await this.sync(true);
      return;
    }
    this.cache = null;
    const generation = this.generation;
    try {
      const cloud = await transport.peek();
      if (generation !== this.generation) return;
      if (cloud) {
        if (previousOwner !== user.id && !pristineSave(this.view.state)) {
          this.update({
            status: "Conflict",
            conflict: cloud,
            blocked: true,
            error: "Cloud save exists. Choose which copy to play.",
          });
          return;
        }
        await this.loadCloud(cloud);
        return;
      }
      if (previousOwner === "local" && this.branch.unverified) {
        this.update({
          status: "Conflict",
          error:
            "Local offline progress cannot be imported. Import the pre-offline save or keep playing locally.",
        });
        return;
      }
      const initial =
        previousOwner === "local" ? this.view.state : createWorkshop();
      this.backup("Before first cloud migration");
      this.setOwner(user.id);
      this.cache = {
        base: initial,
        revision: 0,
        events: [],
        anchor: Date.now(),
        reports: [],
        dismissed: [],
      };
      this.update({ state: initial, blocked: false });
      await this.sync(true);
    } catch (error) {
      this.fail(error);
    }
  }
  private async loadCloud(cloud: CloudRecord) {
    validatedState(cloud.state);
    this.backup("Before cloud load");
    this.cache = {
      base: cloud.state,
      revision: cloud.revision,
      events: [],
      anchor: Date.now(),
      reports: cloud.reports,
      dismissed: [],
    };
    this.setOwner(this.view.user!.id);
    this.update({
      state: cloud.state,
      conflict: null,
      error: "",
      status: "Connecting",
      localUnverified: false,
      blocked: false,
    });
    this.persist();
    await this.sync(true);
  }
  retry = async () => {
    if (this.cache) await this.sync(true);
    else await this.attach(this.view.user, this.transport, true);
  };
  exportBackup = () => ({
    version: SAVE_VERSION,
    state: this.view.state,
    recovery: this.parse<unknown[]>("manual-labor:recovery") ?? [],
  });
  resolveCloud = async () => {
    if (!this.transport) return;
    this.generation++;
    this.flight = false;
    this.detached = false;
    try {
      const cloud = await this.transport.peek();
      if (cloud) await this.loadCloud(cloud);
      else if (this.owner === "local" && this.branch.importable) {
        this.backup("Local offline branch retained");
        const initial = this.branch.importable;
        this.setOwner(this.view.user!.id);
        this.cache = {
          base: initial,
          revision: 0,
          events: [],
          anchor: Date.now(),
          reports: [],
          dismissed: [],
        };
        this.update({
          state: initial,
          conflict: null,
          status: "Connecting",
          error: "",
          localUnverified: false,
          blocked: false,
        });
        await this.sync(true);
      } else
        throw new Error(
          "No earlier verified save. Keep this device copy or reset the workshop before syncing.",
        );
    } catch (error) {
      this.fail(error);
    }
  };
  keepLocal = () => {
    this.backup("Cloud conflict fork");
    this.generation++;
    this.flight = false;
    this.cache = null;
    this.detached = true;
    this.branch = {
      state: this.view.state,
      checkpoint: Date.now(),
      unverified: true,
    };
    this.setOwner("local");
    this.update({
      status: "Local only",
      conflict: null,
      error: "Device copy retained. Cloud copy unchanged.",
      localUnverified: true,
      blocked: false,
    });
    this.persist();
  };
  private fail(error: unknown) {
    if (error instanceof CloudConflict) {
      this.backup("Cloud revision conflict");
      this.update({
        status: "Conflict",
        conflict: error.record,
        error: error.message,
      });
    } else
      this.update({
        status: "Offline",
        error:
          error instanceof Error ? error.message : "Synchronization failed.",
      });
  }
  sync = async (offline = false, checkpoint = false) => {
    this.offlineNext ||= offline;
    const cache = this.cache,
      transport = this.transport,
      user = this.view.user;
    if (
      !cache ||
      !transport ||
      !user ||
      this.flight ||
      this.detached ||
      (!this.active && !checkpoint) ||
      this.view.status === "Conflict"
    )
      return;
    this.flight = true;
    const generation = this.generation;
    const endAt = Date.now(),
      activeMark = this.activeElapsed,
      reused = !!cache.pending;
    cache.pending ??= {
      endAt,
      request: {
        id: requestId(),
        revision: cache.revision,
        events: [...cache.events],
        initial: cache.revision === 0 ? cache.base : undefined,
        offline: this.offlineNext,
        rulesVersion: RULES_VERSION,
      },
    };
    const pending = cache.pending;
    if (!reused) this.offlineNext = false;
    let succeeded = false;
    this.persist();
    this.update({ status: "Syncing" });
    try {
      const result = await transport.commit(pending.request);
      if (generation !== this.generation) return;
      validatedState(result.state);
      const included = new Set(pending.request.events.map((e) => e.id));
      let tail = cache.events
        .filter((e) => !included.has(e.id))
        .map((e) => ({
          ...e,
          at: Math.max(0, e.at - (pending.endAt - cache.anchor)),
        }));
      cache.base = result.state;
      cache.revision = result.revision;
      cache.events = tail;
      cache.anchor = pending.endAt;
      cache.pending = undefined;
      if (reused && Date.now() - pending.endAt >= 30000) {
        cache.anchor = Date.now();
        tail = tail.map((e) => ({ ...e, at: 0 }));
        cache.events = tail;
      }
      cache.reports = result.reports.filter(
        (r) => !cache.dismissed.includes(r.id),
      );
      const predicted = replay(
        result.state,
        tail,
        this.active ? Math.max(0, this.activeElapsed - activeMark) : 0,
      ).state;
      succeeded = true;
      this.update({
        state: predicted,
        status: "Synced",
        error: "",
        conflict: null,
        report: cache.reports[0] ?? null,
        localUnverified: false,
      });
      this.persist();
      for (const id of cache.dismissed)
        void transport.acknowledge(id).catch(() => {});
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.flight = false;
        if (succeeded && this.offlineNext && this.active)
          queueMicrotask(() => {
            void this.sync(true);
          });
      }
    }
  };
  acknowledge = () => {
    const report = this.view.report;
    if (!report) return;
    if (report.local) {
      this.branch.report = undefined;
      this.update({ report: null });
      this.persist();
      return;
    }
    if (this.cache) {
      this.cache.dismissed.push(report.id);
      this.cache.reports = this.cache.reports.filter((r) => r.id !== report.id);
      this.update({ report: this.cache.reports[0] ?? null });
      this.persist();
      void this.transport?.acknowledge(report.id).catch(() => {});
    }
  };
  prepareAuth = async () => {
    this.persist();
    this.backup("Before account change");
    await this.sync();
  };
}
