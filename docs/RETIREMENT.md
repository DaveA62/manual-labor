# Retirement and the Service Continuum

Retirement is optional and account-wide. Open **Account → Service → Retirement** during a career. A synchronized guest account qualifies; registration is not required. Retirement, skill purchases, transition acknowledgement and beginning a career require the authenticated cloud connection. Device-only saves cannot mint permanent points.

## Conversion and reset

The next Year costs `25,000 + 15,000 × lifetime Years earned`. Sequential costs permanently increase, including Years already spent. The preview computes the equivalent arithmetic-series sum; it has no first-retirement cap. $25,000 buys the first Year; $65,000 buys two; $120,000 buys three. A zero-point retirement is rejected. Remaining cash is discarded when the factory retires.

Retirement removes all machines, upgrades, refits, progress, cash and purchased bays. Account cash lifetime, unit totals, identity, retirement history, unspent/lifetime Years, skills and discovered nodes remain. First retirement grants **Service Recognition: +10% global earnings** once. The saved session contains no producing machines; offline claims cannot revive the retired factory.

**Begin New Career** is a separate persisted command. It starts one basic Cash Press, default bays plus permanent bays, and any starting cash/extra Press. Unspent Years carry forward. The tree cannot be reopened during a career. Account has a paginated read-only skill record. Reset Workshop restarts career equipment while retaining Service/history/lifetime; it does not renew Seniority's timer.

## Configuration and skill network

- `src/config/retirement.ts`: conversion, caps, minimum phase duration, starting-cash formula, Seniority window and camera/cinematic settings.
- `src/config/continuum/skills.ts`: stable IDs, coordinates, levels, effects and prerequisite expressions. `CONNECTIONS` is discovery topology, separate from prerequisites.
- `src/game/service/`: pure transactions, derived groups and save validation.
- `src/components/continuum/`: reusable camera, node, edge, discovery rendering, inspector and transition.

Every skill level costs exactly **1 Year**, validated only during an active session. The First Day starts as the only discovered node. Any purchased node reveals its connected neighbors permanently. Visibility does not imply eligibility. No respec.

| Region | Skill (ID) | Max | Effect per level | Prerequisite |
| --- | --- | ---: | --- | --- |
| Origin | The First Day (`first-day`) | 5 | +20% global earnings | None |
| Production | Overtime (`overtime`) | 5 | +5% automatic speed | First Day 1 |
| Production | Firm Hand (`firm-hand`) | 5 | +8% manual-cycle earnings | First Day 1 |
| Production | Standard Procedure (`standard-procedure`) | 3 | +10% global earnings | Overtime 2 OR Firm Hand 2 |
| Production | Uninterrupted Service (`uninterrupted-service`) | 1 | +20% automatic speed | Standard Procedure 3 |
| Industry | Employee Discount (`employee-discount`) | 5 | −5% machine prices | First Day 1 |
| Industry | Bulk Procurement (`bulk-procurement`) | 5 | −4% upgrade prices | First Day 1 |
| Industry | Expanded Premises (`expanded-premises`) | 3 | +1 permanent bay | Employee Discount 2 OR Bulk Procurement 2 |
| Industry | Lifetime Warranty (`lifetime-warranty`) | 1 | −20% refit fees | Expanded Premises 2 |
| Legacy | Accrued Leave (`accrued-leave`) | 4 | +2h offline capacity | First Day 1 |
| Legacy | Prior Experience (`prior-experience`) | 5 | Cash Press list price × 2 starting cash | First Day 1 |
| Legacy | Seniority (`seniority`) | 3 | +10% timed speed for first 10 career minutes | Accrued Leave 2 OR Prior Experience 2 |
| Legacy | Reinstatement (`reinstatement`) | 1 | +1 starting basic Cash Press | Seniority 3 |
| Convergence | Operational Excellence (`operational-excellence`) | 3 | +8% automatic-cycle earnings | Overtime 2 AND Bulk Procurement 2 |
| Convergence | Institutional Knowledge (`institutional-knowledge`) | 3 | −5% refitted-machine upgrade prices | Expanded Premises 1 AND Seniority 1 |
| Convergence | Endless Shift (`endless-shift`) | 1 | +15% fully automatic offline earnings | Uninterrupted Service 1 AND Accrued Leave 2 |

## Shared bonus rules

Bonuses in one group add. Applicable groups multiply. Recognition, First Day and Standard Procedure add to the global group. A cycle with any accepted manual production action uses the manual group; an entirely automatic cycle uses the automatic group. `manualCycle` persists mid-cycle, including after upgrades. Collection pays once. Payout is rounded to cents per completed unit, then aggregated. Bottle quality is an independent multiplier; regulated bottles keep base quality without a precision bonus.

Example: First Day 1 + Recognition gives `1 + .20 + .10 = 1.30`; Firm Hand 1 makes a manual Cash bill `5 × 1.30 × 1.08 = $7.02`. Endless Shift multiplies only payouts from fully automated machines during trusted offline simulation. A partially automated machine can finish automated actions once, then stops at manual input.

Speed changes each automatic phase's duration, never payout. Seniority joins that speed group and also speeds manual time-based bottle flow; physical crank/drag distances remain unchanged. Every timed phase is at least 100ms. Long advances split at the exact 10-minute Seniority boundary. Server wall time consumes that window even beyond the offline earning cap. Both families and offline bulk paths share these functions.

Machine discounts cap at 50%; upgrade discounts (including Institutional Knowledge) at 50%; refit discounts at 40%. Offline capacity starts at 8h and caps at 24h (the initial network reaches 16h). Prior Experience grants $100 per level with current list prices. Reinstatement adds one Press; starting capacity is at least the machine count. Permanent bays do not advance the cash-purchased bay price exponent. These provisional values are configurable, not playtest balance claims.

## Persistence and authority

Save schema **5**, rules **3**. Legacy v1–v4 data retains machines, cash, refits, ordering and progress. An absent `service` means no previous retirement; it is not populated with inferred points. Account lifetime equals retired totals plus current machine totals. Starting resource grants are recorded separately from cash earnings. Codec validation checks all point accounting, node IDs/levels/prerequisites, discovery closure, history/session identity, retirement factory emptiness and cent values.

`SyncRequest.command` carries intent, never points, prices or replacement Service state. The authenticated handler derives the owner from `auth.getUser`. `synchronize` loads a trusted checkpoint, applies shared production/replay, validates the command and commits one new revision through the existing service-role-only `ml_commit` transaction. Row/advisory locks, expected revisions and UUID receipts prevent double retirement or purchases. Career/session IDs and `fromLevel` reject repeated intent even under a fresh request UUID. Initial legacy import cannot include Service state.

The client flushes its gameplay journal, freezes factory input, durably stores the command request, and waits for the canonical response. The reset is committed before the cinematic mounts. Interrupted requests reuse their UUID after reload; there is no optimistic permanent-point award. Pending transactions remain blocked until retry or explicit cloud recovery. Conflicts retain recovery snapshots and require **Load Cloud Save**; no automatic merge. Old rules 1/2 continue only before an account gains Service state. They cannot mutate a retired account.

The SQL migration widens the schema constraint, rejects Service downgrades, acknowledges retired-factory reports, and retains RLS/no-client-write permissions. No new exposed table or identity permission is needed. Deploy migration, then the shared function bundle, then frontend. Existing caveats remain: historical legacy cash import and the origin of manual player input cannot be proven; this is not a cheat-proof economy. A lifecycle hint classifies short offline returns (long server gaps are also treated as offline); browser focus itself cannot be authenticated. The server still owns elapsed time, checkpoints, caps, skill rates and payouts.

## Presentation and access

The Continuum is a deliberate exception to factory art: near-black space, restrained violet/silver/pale-gold illumination, thin curved paths and luminous nodes. No factory panels, gears or ordinary navigation. Keep existing fonts and readable contrast. Drag/pinch/wheel pan and zoom in world coordinates, clamp camera bounds, preserve pointer anchors, expose keyboard node controls and recenter. Nodes have enlarged screen-sized hit regions. Discovery is paid for only by the node purchase, never separately.

First retirement uses a 6.4s CRT collapse → darkness → first light → Years sequence. Audio is silenced through the platform port; optional quiet tones mark entry/purchase. Later transitions are 1.9s and skippable. Reduced motion uses a 900ms still/fade presentation with no flicker. Transition acknowledgement is persisted; refreshing resumes the same session, never the retired factory or another award. Cinematic time never advances game rules.
