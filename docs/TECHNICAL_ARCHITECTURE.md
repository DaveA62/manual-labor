# Manual Labor — technical architecture

The browser game remains React + TypeScript + Vite. SVG is the production machine renderer. Phaser 3.90.0 is a development-only evaluation, not an engine migration. Money Press and Bottling Machine are independent families. No native packaging projects are included.

## Ownership and data flow

| Layer | Files | Responsibility |
| --- | --- | --- |
| Family definitions | `src/config/machines/`, `src/game/definitions.ts` registry | Phases, automation, upgrades, shop prices, prestige tiers, fees, output, finishes |
| Instance data | `src/game/types.ts`, `machines.ts` | Persistent ID, tier, upgrades, cycle progress, lifetime record; derived prices/status |
| Simulation | `src/game/simulation.ts` | Pure per-instance phase transitions; only collect → feed pays |
| Workshop reducer | `src/game/engine.ts` | All instances, wallet, purchases, slots, order, atomic prestige validation |
| Save codec | `src/game/codec.ts`, `save.ts` | Pure v1/v2/v3 migration and v4 validation/serialization; injectable storage wrapper |
| Session host | `src/game/useGame.ts`, `src/cloud/session.ts`, `src/runtime/clock.ts` | One 50ms foreground clock, local checkpoints, account journals, cloud reconciliation and lifecycle flush |
| React UI | `src/App.tsx`, `src/components/`, `src/ui/` | Navigation, HUD, Storage, Catalog, Modifications, accessible dialogs |
| Renderer interface | `src/runtime/machine.ts`, `useMachineRuntime.ts` | Selected instance snapshots, scoped manual intent, feedback and hints |
| Platform ports | `src/platform/` | Storage, activity/monotonic clock, optional sound/haptics |

Input becomes a `ManualAction` through the runtime. Its bound machine ID becomes an `operate` action in the existing reducer. React then commits a fresh snapshot. Renderers read snapshots and animate them; they cannot buy upgrades, pay fees, advance time, or award earnings through the interface. Cash feedback remains owned by the shared App lifetime observer, so switching renderers cannot duplicate payouts or cash sounds.

`useMachineRuntime` is a stable handle with refs updated after React commits. Imperative scenes read the latest committed instance instead of capturing initial props. SVG receives the same snapshot as a normal React prop. No renderer-specific data is saved.

## Production and lifecycle

The simulation and reducer use plain TypeScript values; they import no React, DOM, Phaser, storage, audio, or native SDKs. Many stored machines advance together even when their UI is unmounted. Partial automation stops at manual input. Reordering changes slots only. Prestige keeps the original instance ID, array position/serial, bay, and lifetime statistics.

`createProductionClock` reads the platform's monotonic time and activity. It caps a running tick at 250ms and resets its time origin on every activity change. Suspended/hidden time stops foreground ticks; the authenticated backend separately claims eligible offline production. A renderer RAF, Phaser update, tween, or texture callback never ticks production. React Strict Mode and renderer teardown must leave one session clock and no orphan scene listeners.

`GameSession`, observed by the small `useGame` React adapter, writes economy/order changes immediately and checkpoints motion once a second. Lifecycle events flush dirty state. Browser visibility, pagehide, and pageshow map to the lifecycle port. Saves retain the existing `manual-labor:save:v2` key and v4 payload. Existing Press tier balance, automation durations, and purchasing rules remain intact; the additive Bottler payload persists its physical state. Cloud envelopes add revisions, journal events, request receipts and server timestamps outside the game payload.

## Platform adapters

`GamePlatform` exposes only services already needed:

- `storage`: synchronous get/set/remove of serialized values; errors preserve the existing session-only warning behavior.
- `lifecycle`: activity, monotonic milliseconds, and a subscription that returns cleanup.
- `feedback`: optional procedural sound and haptics; failure must never affect production.

The default adapter calls localStorage, Page Visibility/page lifecycle events, performance.now, Web Audio, and optional vibration. Browser globals are accessed when services run, not when importing pure logic. `configurePlatform` selects an adapter before React mounts; never swap hosts mid-session. Save functions also accept storage directly for tests or tooling.

For future Capacitor or desktop packaging, retain the React shell and game core. Add an adapter at the composition root for application pause/resume, storage, and device feedback. Native asynchronous storage must hydrate before mounting the session and provide an ordered, durable write queue with explicit failure reporting; do not wrap an unawaited native write in this synchronous port and claim it saved. Extend the persistence lifecycle when that host is implemented. Native haptic/audio permission handling belongs in the adapter. No speculative native SDK dependencies or projects are added now.

Pointer Events in SVG and Phaser's mouse/touch events are renderer adapters. They convert screen positions to the shared 720×510 machine coordinates. `src/game/gestures.ts` contains angle wrapping, direction-independent drop areas, recent stamp velocity, and bounded head resistance. `src/runtime/press.ts` provides the common active part and head target. The browser/WebView renderer may use DOM coordinates; the production simulation may not.

## Renderer contract

`MachineRuntime` has four operations: `read()`, `act(ManualAction)`, `feedback(kind)`, and `hint(text)`. Treat returned snapshots as immutable. The runtime is bound to a single machine; changing the selected machine creates another handle. Changing renderer, opening a menu, or reloading art must not reset a cycle or infer earnings from animation completion.

The baseline `Press.tsx` preserves pointer capture, cancellation, keyboard controls, and SVG screen conversion. Its layered artwork remains in `components/press/Parts.tsx`. Damped visual following is independent of production. Both renderers share the same coordinate system, direction, drop zones, stamp thresholds, tier finishes, and upgrade sources. Refit remounts presentation for that instance while the existing reducer handles the actual reset.

All machine renderers fit the existing contained Workshop area. The React shell still owns dynamic viewport sizing, safe areas, navigation and paginated screens. Preserve 44px targets in screen pixels after scaling, cancel transient gestures during resizing, and honor reduced motion. Modals must block the underlying machine. Phaser discards input whose original target is not its own canvas, including global window input over React dialogs.

## Phaser experiment

Run `npm ci` and `npm run dev`, then open `/manual-labor/?renderer=phaser`. In development, Settings also offers **SVG baseline** and **Phaser experiment**. The selection is session-only; switching preserves game state. The Press-only experiment uses the normal local save and wallet, so use a disposable browser profile when testing refits or resets. Production URLs ignore the query and show SVG; the toggle is compiled out.

`src/experiments/phaser/` contains the entire Phaser scene, texture bridge, React mounting adapter, and its CSS. Phaser is pinned as a devDependency. A `import.meta.env.DEV` guard around the dynamic import removes the dependency graph from production output. The TypeScript build still checks the experimental source. Do not add an eager Phaser import to the application, shared runtime, or game modules.

The texture bridge rasterizes the established SVG assemblies once per appearance change. It embeds the existing heading font and resolves shared finish tokens. Frame, head, crank, gears, feed assembly, lift motor, conveyor, stamp actuator, precision print insert, paper, and bills remain independent scene objects. The 720×510 logical view uses a 2× backing canvas and camera zoom with FIT scaling. Input uses the camera's world transform, not guessed CSS offsets. A ResizeObserver refreshes scaling and cancels a transient drag; it does not change production.

The scene uses manual pointer intent, recent downward velocity, resistance, damped head travel, linked gears, finite impact particles, restrained camera shake, and existing optional feedback. No Arcade/Matter physics, Phaser production timer, separate state machine, or Phaser audio manager is enabled. A focusable React keyboard alternative operates the current part. Pointer cancellation, outside release, blur, lifecycle suspension, unmount, and appearance changes discard transient drags. Async texture preparation is guarded against unmount; cleanup destroys the Game with `noReturn=false` so it can be mounted again. Import/render and texture initialization failures fall back to SVG.

To remove the experiment: remove its DEV import/branch from MachineScreen, the development Settings toggle/query from App, `src/experiments/phaser/`, and the Phaser devDependency. Keep the runtime and platform ports. No save migration is required.

## Evaluation

**Keep SVG as the production renderer.** Phaser successfully drives the same press through the existing reducer and gives a unified canvas scene graph, transforms, camera effects, and tweens. Those are useful candidates for future machines with many moving objects. They have not demonstrated a meaningful benefit for today's single active press: Storage already uses cheap thumbnails and the simulation is independent of rendering.

Phaser also introduces raster texture preparation, another lifecycle, explicit accessibility controls, and extra dev download/startup cost. SVG retains native vector sharpness, DOM hit areas, and simpler iteration on the current artwork. Canvas performance or mobile battery improvements are not established by this experiment. The pinned Phaser minified distribution is about 1.20 MB (315 KB gzip); this is a distribution-size measurement, not the experiment’s Vite transfer size. The Task 06 production JS is about 275 KB (86 KB gzip), with no Phaser engine or experimental CSS included. Remote-browser frame rates are not a representative device benchmark; measure on actual iOS/Android hardware before proposing a replacement.

Task 06 validation includes existing game tests plus runtime scoping, injected storage, and suspend/resume checks. Browser QA exercises mouse feed/crank/collection, slow stamp rejection, keyboard stamping, renderer switching with partial progress, upgrade assemblies, tiers, reloads, and viewport containment. Physical touchscreen and fast manual stamping require device playtesting. Packaging, app-store behavior, and native lifecycle integration remain future work.

Official API references for the pinned implementation:

- [Phaser 3.90 FIT scaling](https://docs.phaser.io/api-documentation/3.90.0/constant/scale)
- [Phaser input](https://docs.phaser.io/phaser/concepts/input)
- [Phaser TextureManager](https://docs.phaser.io/api-documentation/3.88.2/class/textures-texturemanager)
- [Game teardown](https://docs.phaser.io/api-documentation/class/game)

## Authentication, cloud saves and offline production (Task 07)

The permanent deployment/security instructions are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Supabase Auth automatically creates a guest when no session exists, persists/refreshes it, and supports PKCE Google/email flows. Guest identity upgrades retain the player UUID; existing-account sign-in never merges save rows. React owns the compact Account and Shift Report dialogs.

`cloud/session.ts` coordinates the existing reducer, a window/account-scoped outbox, local recovery snapshots, session changes and an optimistic cache. Meaningful actions synchronize after a debounce; foreground checkpoints synchronize every ten seconds. Hidden windows do not continue cloud checkpoint heartbeats, preserving the eight-hour offline limit. Requests are persisted before transmission and retried with the same UUID. Actions entered during a request remain in the journal and are rebased onto the canonical response. Stale revisions stop uploads until an explicit conflict choice; a device fork remains local.

`cloud/server.ts` and `cloud/replay.ts` run in the Edge Function without React, renderer or browser imports. The authenticated `game-sync` handler verifies the JWT with `auth.getUser`, derives its owner ID, reads database time, advances the shared simulation, and replays validated game actions. Client positions of events are clamped within the server's allowed elapsed-time budget. Client-provided elapsed time, payout totals and replacement balances are never used. An initial validated legacy snapshot is accepted once for compatibility; subsequent state changes require shared reducer actions.

A service-role-only transactional RPC serializes each player, checks the expected revision, saves the previous revision, applies the new snapshot/checkpoint/report, and records the request receipt atomically. RLS restricts player table reads to the owner, while direct writes and privileged RPC execution are revoked from browser roles. Report acknowledgement is a separate nonfinancial operation. Retrying a committed request returns its receipt; concurrent stale requests conflict. The server advances at 100% for at most eight hours and consumes the entire wall-clock gap even when capped. Partial automation stops at manual input. Each instance keeps its own rules, tier, upgrades and statistics.

Local-only offline calculation is explicitly unverified and remains in its own device branch. A pre-offline snapshot is retained for a safe initial import; device-only money is never silently uploaded to cloud currency. A Shift Report contains already-applied earnings, and Collect only acknowledges it.

The economy is not claimed to be cheat-proof: historical legacy balances and human-origin manual actions cannot be proved by this architecture. New families and rule changes must be validated in the shared replay/simulation and deployed to server and client with the same RULES_VERSION. Future Capacitor/desktop adapters must provide redirect/deep-link and protected auth-session handling, ordered persistence and lifecycle integration. No native projects are added.

## Bottling family (Task 08)

See [BOTTLER.md](BOTTLER.md) for balance, physical controls, timing, migration and validation details. Family definitions now include unit names and step labels. The UI chooses the established SVG renderer per family; Phaser remains a Press-only experiment. `game/simulation.ts` delegates Bottler operations to pure `game/bottling.ts`, retaining one workshop reducer and one clock for every stored instance.

Bottler physical state (`size`, capacity-normalized `fill`, `valve`, residual `dripMs`, `regulated`) is validated in the v4 codec and serialized with the instance. Manual intents are load, valve delta, carriage delta, capper delta, and collect. Time-based flow runs in simulation, including manual-open-valve/drip behavior, independently of the rendered screen. Only collection changes lifetime/output counts, which the existing reducer adds to the shared wallet. Fully automated bulk simulation groups three deterministic sizes and matches subdivided ticks.

Cloud schema 4 is additive; existing schema-3 rows are untouched until synchronized. The versioned migration widens the schema constraint and updates the existing service-only transactional commit to preserve schema and reject downgrades. Rules version 2 understands both families; rules v1 is accepted only for Press-only state and intent. Old pending Press receipts retain their UUIDs. Currency validation now accepts cents for exact 70% payouts; the historical `bills` field remains the aggregate completed-unit count for compatibility. No separate Bottler save, wallet, clock or offline endpoint exists.

## Configuration and measured Workshop (Task 09)

[CONFIGURATION.md](CONFIGURATION.md) is the tuning reference. The former definition exports remain compatible, but authoritative balance values now live in `src/config/machines/` and `config/economy.ts`. `config/production.ts` supplies the shared offline cap. These modules are plain TypeScript with no React, DOM or platform dependencies and are bundled unchanged into `game-sync`. No saved IDs, physical payload, schema version or default balance changed. Bulk Bottler timing/rate estimates derive from the same capacity sequence as ordinary ticks.

`App` measures the available main content box with `useElementSize`. The `wideWorkshop` selector checks both dimensions. The machine remains in the same React position when the layout switches; its renderer gets the same runtime and saved instance. Wide mode mounts `Modifications` with an inline equipment frame and `Storage` with compact paginated bays beside it. These are presentations of the existing shared action controls, not separate economy implementations. Compact mode retains native maintenance dialogs and full Storage.

`config/ui.ts` owns wide breakpoints, panel proportions, row/card sizing, touch/hold settings and common animation durations. UI-only settings never enter cloud simulation. Colors/type/materials remain solely in `tokens.css`; `config/theme.ts` specifies contrast limits. Shared `SvgPlate` components protect information from moving artwork, while decorative assemblies ignore pointer events. Native/WebView hosts retain the same measured layout and screen-to-SVG transforms.

Task 09 requires no SQL migration or auth configuration. Deploy the Edge Function with the additional config dependencies before publishing the frontend; rules version 2 remains unchanged because all live production values/behavior are preserved.

## Account Service and Retirement (Task 10)

[RETIREMENT.md](RETIREMENT.md) defines the exact initial network, stacking, conversion, reset and authority rules. `config/retirement.ts` and `config/continuum/skills.ts` are the single server/client sources. `game/service/{types,codec,progression,stats}.ts` is React/DOM-free. Career machine simulation is frozen when `service.session` exists; it contains no machines. Account lifetime records archive removed factory totals separately from the next factory. Schema 5 explicitly validates this relationship and preserves v1–v4 data.

Retirement, purchasing a level, acknowledging the cinematic and starting a career use `SyncRequest.command`, separate from ordinary optimistic gameplay intent. The session flushes events, persists the command UUID and locks input. The authenticated server validates ownership and cash/points/eligibility from its canonical snapshot, computes the outcome, then commits through the existing revision-checked, locked Postgres transaction. Only its durable response mounts the cinematic. Pending commands survive reload; duplicate UUIDs return receipts, stale career/session/level confirmations reject, and concurrent devices conflict. Never accept client-supplied point totals or initial Service progress. SQL retains owner reads, revoked client writes and service-role-only RPC execution.

Derived production context carries grouped earnings, timed speed and offline applicability into both family simulators, including bulk cycles. Accepted manual input tags the current cycle persistently; quality is separate. Long ticks split at Seniority expiry. The server advances wall-clock career age beyond the capped production budget so reconnecting cannot renew the early bonus. UI price selectors share the reducer's discounts, free-bay offset and rounding. Reset Workshop keeps permanent Service and cannot refresh Seniority.

React owns the full-screen Continuum and finite transition, not its economy. Reusable SVG nodes/edges and a camera hook use pointer capture, wheel anchors and two-pointer pinch without physics or dependencies. Discovery and eligibility are independent data systems. Camera state is cosmetic; purchased levels/discovery are immediately server persisted. Retirement suspends periodic production heartbeats; explicit commands and reconnects still synchronize. The optional platform `silence()` port cuts factory audio, while quiet entry/discovery tones use existing feedback. Future hosts must implement equivalent audio/lifecycle handling without moving Service transactions into renderers.

The additive SQL migration is `20261029200206_retirement_continuum.sql`; deploy it before the rules-3 Edge Function and frontend. Rules 1/2 remain accepted for accounts without Service only. No auth provider/dashboard permission changes are needed. Physical touchscreen/pinch behavior and audio need device verification in addition to automated camera/transaction tests.
