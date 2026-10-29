# BT–02 Bottling Machine

The Bottler is the second family in the existing registry. SVG remains the production renderer. Storage, Catalog, Modifications, accounts, journals, currency, collection, and offline claims use the same shared systems as the Money Press.

## Balance

All values live in `src/game/definitions.ts`; quality and payout selectors live in `machines.ts`.

| Tier | Base payout | Precise manual | Poor manual | Upgrade multiplier | Fee to enter |
| --- | ---: | ---: | ---: | ---: | ---: |
| Water Bottler | $25 | $30 | $17.50 | 1× | $250 purchase |
| Soda Bottler | $100 | $120 | $70 | 3× | $3,750 refit |
| Premium Bottler | $375 | $450 | $262.50 | 9× | $20,000 refit |

Acceptable bottles pay base value. Precise is 95–100% inclusive; acceptable is 85–105% inclusive outside that band. Every other fill, including zero or a spill, still pays 70%. Currency is preserved to cents in the existing dollar balance. Counts remain integers. The legacy `bills` field now counts completed units across families; it is retained to preserve old saves and statistics.

| Upgrade | Water cost | Automated steps |
| --- | ---: | --- |
| Bottle Loader | $75 | Load |
| Flow Regulator | $150 | Fill; always base payout, never the manual precision bonus |
| Auto Capper | $250 | Transfer and cap |
| Crate Conveyor | $350 | Collection |

All four upgrades are required for refitting. Refit resets physical state/upgrades, charges once, and preserves ID, serial/index, slot, and lifetime records. Other machines are unchanged. The upgrade set costs $825 at Water tier; later costs scale by 3× and 9×. The $250 machine purchase is five times a second Money Press; its base output is also five times a Cash Press, with a longer and more involved manual cycle.

## Production and input

`load → fill → transfer → cap → collect` is the shared family phase sequence. Only collection pays. Intent enters `MachineRuntime` and the normal workshop reducer; `game/bottling.ts` contains pure family mechanics. No renderer animation advances time or money.

Each cycle selects Standard → Short → Tall from the persistent completed-unit count. Capacities are 100%, 80%, and 120%; controls and target percentage stay identical. The deterministic order keeps cloud replay and bulk offline simulation reproducible without a client RNG or new currency/state system.

Full-flow filling takes 4.0s / 3.2s / 4.8s. The valve travels 270° from shut to open. Positive pointer angle is clockwise and opens it; negative closes it. Aperture continuously multiplies flow. Closing leaves 240ms of residual flow at 12% aperture: 0.72% standard, 0.90% short, 0.60% tall. End stops snap negligible floating-point residue to zero/one. The spill limit is 125%. A closed valve must finish its drip before transfer; sliding can deliberately accept an underfilled bottle for reduced pay.

Auto timings: load 700ms, fill capacity × 4000ms, transfer 800ms, cap 650ms, collect 850ms. A complete three-size group takes 21s, averaging 7s per bottle. Fully automated rates are approximately $214 / $857 / $3,214 per minute. The rate is a long-run estimate; per-cycle filling varies with size.

Manual aperture and remaining drip are saved. An unattended open manual valve can fill/spill, but never transfers or collects on its own. With Auto Capper installed, closing a nonempty bottle and finishing its drip automatically hands it to the carriage/capper; no manual nudge is needed. Every partial upgrade combination stops at the first manual boundary. A conveyor may collect one already sealed manual bottle offline; indefinite offline production requires all four upgrades. Shared server time, the eight-hour cap, request receipts, and revision locks continue to apply.

The SVG uses the established 720×510 stage with independent reservoir, gauge, valve, carriage, bottle, capper, rack, chute, and upgrade assemblies. Hit areas expand to at least 44 screen pixels. Pointer capture survives the drag; cancellation/blur/resize clears transient input. An unfinished capper pull springs back on release. Enter operates active parts; valve Left/Right changes aperture and Home/End closes/opens. Keyboard alternatives do not replace the rotary pointer control.

Water uses pale clear liquid and mint equipment. Soda keeps mint paint with colored liquid, reinforced fittings and an extra gauge. Premium uses aged brass, rich liquid, and quality-control hardware. Thumbnails share family finishes. Installed hardware belongs to its machine and moves only during the relevant step. Reduced motion disables repeated fluid/impact effects; audio remains optional.

## Save and deployment

Task 08 writes local/cloud schema **4** and rules version **2**. Local v1/v2/v3 Press saves still decode with their original IDs, upgrades, tier, progress, ordering, balances and statistics. The original storage key is retained. `bottler` is an optional validated physical payload on the shared instance; it is required for the Bottler family, never synthesized over existing Press data.

Apply `supabase/migrations/*_bottler_schema_v4.sql` before deploying the updated `game-sync` function. It permits schema 3/4 and updates the existing commit RPC to save the submitted schema version and refuse downgrades. It does not rewrite player state, cash, production checkpoints or revisions. Existing schema-3 rows upgrade on their next successful synchronization.

Deploy `game-sync` with its relative dependencies including the new `src/game/bottling.ts`, then publish the frontend. CLI commands and project configuration are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Old rules-v1 clients remain supported for Press-only state/actions; they must reload if their account contains a Bottler. Interrupted v1 Press journals upgrade their rules marker without changing events or receipt UUIDs.

The backend shares the same family registry, validation, reducer, quality rules and simulation. Client payout totals/elapsed time are still ignored. No new public write grants, tables, identity flows, or privileged client keys are introduced. The existing initial-legacy-import and synthetic-manual-intent trust limitations remain documented; this is not a cheat-proof economy.

## Verification

`npm test` covers manual sequencing, every quality boundary, all tiers, fractional payouts, sizes/aperture/drip, valve end-stop residue, all 16 automation subsets, open-valve offline limits, bulk versus subdivided time, mixed-family saves, purchases/refits, legacy compatibility, server cap and duplicate/conflicting claims. `npm run build` also checks the existing Phaser experiment; it remains Press-only and excluded from production.

Browser QA uses disposable local fixtures for physical mouse loading, clockwise/counterclockwise rotation, carriage dragging, capping and swipe collection; upgrade installation/refit; Catalog/Storage; and phone/landscape/desktop containment. Real touchscreen comfort and audio quality require physical-device playtesting.
