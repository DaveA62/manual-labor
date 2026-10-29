# Configuration reference

Tune values in `src/config/`. `src/game/definitions.ts` is the shared registry and compatibility export; do not create a second balance table in a renderer or Supabase function. Task 09 moved configuration without changing prices, payouts, durations, schema 4, rules version 2, or existing saves.

| Change | Exact file | Property | Used by Supabase? | Deployment / migration |
| --- | --- | --- | --- | --- |
| Money Press purchase price | `src/config/machines/moneyPress.ts` | `MONEY_PRESS.price` | Yes | Frontend + `game-sync`; no save migration |
| Press tier output | Same | `MONEY_PRESS.tiers[].baseEarnings` | Yes | Both; no migration for numeric changes |
| Press upgrade prices | Same | `MONEY_PRESS.upgrades[].cost`, `tiers[].upgradePriceMultiplier` | Yes | Both; no migration |
| Printing multiplier | Same | `PRESS_BALANCE.printingMultiplier` | Yes | Both; no migration |
| Press prestige | Same | `MONEY_PRESS.tiers[].refit.fee`, `.requiredUpgrades` | Yes | Both; numeric fees need no migration; changing required IDs needs review |
| Press automatic timing | Same | `MONEY_PRESS.durationMs` (milliseconds per phase) | Yes | Both; no migration for durations |
| Bottler purchase / output / upgrades / prestige | `src/config/machines/bottler.ts` | `BOTTLER.price`, `.tiers[].baseEarnings`, `.upgrades[].cost`, `.tiers[].upgradePriceMultiplier`, `.tiers[].refit` | Yes | Both; numeric values need no migration |
| Bottler automatic timing | Same | `BOTTLER.durationMs` | Yes | Both; no migration for durations |
| Bottle capacities / sequence | Same | `BOTTLING.capacity`, `.sizes` | Yes | Both; capacity values need no schema change. Adding/removing size IDs needs type/codec migration review |
| Fill quality bands / payout | Same | `BOTTLING.quality`, `.payout`, `.regulatedFill` | Yes | Both; review bands together with physical marks; no migration for numeric tuning |
| Valve travel / residual drip / spill limit | Same | `BOTTLING.valveTravel`, `.residualMs`, `.residualRate`, `.maxFill` | Yes | Both; update rules version and verify in-progress saves when changing physical limits |
| Storage pricing | `src/config/economy.ts` | `ECONOMY.slotBasePrice`, `.slotPriceMultiplier`, `.slotPriceRounding` | Yes | Both; existing capacity stays intact |
| New-workshop capacity | Same | `ECONOMY.startingSlots` (minimum 2) | Yes | Both; affects new/reset workshops only; never shrinks existing saves |
| Offline time limit | `src/config/production.ts` | `OFFLINE.capMs` | Yes | Both; no SQL migration for the numeric cap |
| Wide Workshop breakpoint | `src/config/ui.ts` | `UI.wide.minWidth`, `.minHeight` | No | Frontend only; no save migration |
| Desktop split / panel allocation | Same | `UI.wide.workspaceFraction`, `.maintenanceFraction`, `.gap` | No | Frontend only; test purchase/refit controls at the smallest eligible size |
| Upgrade rows / Storage density | Same | `UI.maintenance`, `UI.storage` | No | Frontend only; paginate whole rows/cards |
| Touch target / Storage hold timing | Same | `UI.touchTarget`, `.gestures` | No | Frontend only; preserve at least 44px targets and mouse/touch cancellation |
| Compact navigation / short-screen CSS | `src/styles.css` | Existing `@media (max-width:760px)` and short-landscape rules | No | Frontend only; wide eligibility has its single source in `UI.wide` |
| Shared cosmetic timing | `src/config/ui.ts` | `UI.animation` | No | Frontend only; never advances production |
| Palette, finishes, type, label backing | `src/tokens.css` | `:root` tokens, `[data-finish]`, `--plate-*`, `--readout-*` | No | Frontend only; run contrast checks |
| Minimum text contrast | `src/config/theme.ts` | `CONTRAST.normal` / `.large` | No | Validation thresholds: keep at least 4.5 / 3 |

## Common edits

- Change a machine's initial cost with `.price`. Set each tier's base output independently; prestige is a tier in the same family.
- Upgrade cost = `upgrades[].cost × current tier.upgradePriceMultiplier`. Prestige fees are the **next** tier's `refit.fee`. Existing purchases are never repriced/refunded.
- Storage bay cost = base price × multiplier per extra bay, rounded up to `slotPriceRounding`. Existing unlocked slots and ordering persist.
- Bottle fill is normalized to the selected size. Keep the precise band inside the acceptable band. The regulator pays base value; `.payout` governs manual quality. Full size-sequence timing and rate estimates derive from the configured capacities, including offline bulk simulation.
- Offline production remains 100% efficient and capped at eight hours by default. `OFFLINE.capMs` limits eligible elapsed time; it is not a client-controlled payout or efficiency multiplier.
- Wide mode starts at **1060×660 available content pixels**, after header, navigation, padding and safe areas (roughly 1188×752 outer pixels with default desktop chrome). It allocates 62.5% to the machine and 37.5% to management. Smaller width **or** height uses the compact Workshop. No user-agent/device detection is involved.
- Colors and fonts have one authoritative source in CSS. `theme.ts` contains contrast requirements, not a duplicate palette. UI dimensions/timings become CSS variables from `ui.ts`; stylesheet fallbacks preserve the same default appearance.

## Applying changes safely

1. Change only the authoritative config property. Keep persistent machine/type/tier/upgrade IDs stable.
2. For **production or economy rule changes**, increment `RULES_VERSION` in `src/cloud/protocol.ts`, plan old-client compatibility, and deploy `game-sync` with the frontend. Config refactors with identical values do not require a rules/schema bump.
3. Run `npm test` and `npm run build`. Check partially completed and fully automated instances, prestige, and offline payout parity. For UI changes, inspect wide, narrow, short, phone and landscape layouts.
4. Deploy the authenticated function with its relative shared imports (including `src/config/economy.ts`, `production.ts`, and `machines/{types,moneyPress,bottler}.ts`). See [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Publish the Pages frontend using the existing workflow.

Numeric balance changes normally need no SQL migration. Removing/renaming IDs, changing phase meaning, or changing persisted field interpretation requires an explicit versioned codec/cloud migration and recovery plan. Never clear player data to apply configuration. Existing cash and lifetime statistics are historical records; tuning output changes future production only. For a live rate change, plan the checkpoint cutover so an absence is not inadvertently repriced under a new rate.

## Retirement / permanent Service (Task 10)

| Change | Exact file | Property | Supabase? | Deployment / migration |
| --- | --- | --- | --- | --- |
| Year conversion | `src/config/retirement.ts` | `RETIREMENT.pointBase`, `.pointGrowth` | Yes | Both, rules bump; never rewrite earned/spent history |
| Recognition / caps / minimum phase | Same | `.recognition`, `*DiscountCap`, `.minimumPhaseMs`, `.offlineCapMs` | Yes | Both, rules bump; verify existing careers |
| Starting cash | Same | `.startingCashPriceMultiple` × Cash Press list price × skill level | Yes | Both; affects future careers |
| Early career window | Same | `.seniorityMs` | Yes | Both; persisted career age remains |
| Skills, effects and prerequisites | `src/config/continuum/skills.ts` | `SKILLS[].max`, `.prerequisites`, `.effects` | Yes | Both; ID removals/prerequisite changes need migration review |
| Spatial layout / discovery | Same | `SKILLS[].x/y`, `CONNECTIONS` | Discovery yes | Both for discovery; topology changes need saved-closure migration review |
| Camera / transition timing | `src/config/retirement.ts` | `CONTINUUM` | No game rules | Frontend only |

See [RETIREMENT.md](RETIREMENT.md). Save schema is now 5/rules 3. Defaults from Task 09 remain unchanged for unretired accounts. Permanent points are not a device-importable resource. Changing rates on live careers requires an explicit checkpoint cutover, as with machine tuning.
