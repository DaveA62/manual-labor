# Manual Labor

A mobile-first, side-view money press tycoon. Built with React, TypeScript, Vite, CSS, and hand-drawn SVG. Inline machine illustrations and self-hosted fonts; no game engine.

## Run

Use Node.js 22.18+ (Node 24 also works).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (including `/manual-labor/`). `npm test` checks the state machine, economy, save validation, and gesture math; `npm run build` typechecks and builds to `dist/`. `npm run preview` serves the build.

## Play

1. Drag green paper from the left stack onto the center plate.
2. Turn the crank one full revolution in the indicated direction.
3. Grab the raised head and pull it down quickly to stamp.
4. Turn the crank again to lift the head.
5. Drag the printed bill to the right collection tray for $5.

Crank direction alternates each completed bill. Mouse and touch use the same captured Pointer Events. A canceled gesture safely returns its object; slow stamps can be retried without losing paper. Keyboard alternative: Tab to the active machine part and press Enter or Space (four presses for a full crank turn).

## Storage and machines

Storage is the active workshop floor, presented as a viewport-sized, paginated bay grid. Start with two unlocked slots and one Money Press. Tap a card to operate it. Drag the grip with a mouse, or hold it for 430 ms before dragging on touch. The game frame does not scroll. Grips handle dragging; hold a page arrow to change pages during a drag. Drop on another press to swap, or into an empty slot to move. Keyboard: focus a grip and use arrow keys.

Catalog sells additional presses for $50. Each press has its own permanent ID, cycle progress, upgrades, earnings, and bill count. New machines use the first empty slot. Upgrades are bought separately for every instance:

| Upgrade | Cash-tier price | Effect |
| --- | --- | --- |
| Auto Feeder | $15 | Loads paper |
| Motorized Lift | $35 | Handles both crank steps |
| Auto Collector | $75 | Collects completed bills |
| Auto Stamper | $125 | Stamps paper |
| Improved Printing | $150 | Doubles this press’s bill value |

All stored presses operate simultaneously, including while shopping or operating a different press. Partial automation stops at the next manual action. Buying all four automation upgrades enables continuous production; Improved Printing is optional. Cards show Needs Input, Running, or Fully Automated, with a phase progress bar and a theoretical earnings/min estimate for fully automated presses.

Additional slots start at $50, then $90, $165, and so on. Configure machine prices, phase durations, upgrade prices, starting slots, and the slot price curve in `src/game/definitions.ts`.

A single 50 ms simulation clock runs above the screens; machine UI never owns production timers. Background here means other screens in the running game. Hidden-browser foreground ticks pause; authenticated cloud saves claim up to eight hours of offline production on return. Device-only offline earnings remain local and are not automatically imported. Stamping stays manual until that specific press buys Auto Stamper.

## Machine Refit

Open Modifications → Machine Refit. Each press advances within the Money Press family:

| Tier | Base bill value | Upgrade prices | Refit fee to enter |
| --- | --- | --- | --- |
| Cash Press | $5 | 1× | Supplied |
| Silver Press | $20 | 3× | $750 |
| Gold Press | $75 | 9× | $4,000 |

Install Auto Feeder, Motorized Lift, Auto Collector, and Auto Stamper on that press before refitting. Improved Printing is optional and doubles its current tier’s bill value. Confirming a refit deducts the fee once, removes all upgrades and automation without refunds, and returns production to Load. ID, serial, bay, earnings, and bill count remain intact; other presses are unaffected. Gold is the maximum tier. Family tier definitions configure fees, requirements, output, prices, and finishes in `src/game/definitions.ts`.

## Saves

Version 3 saves (retaining the `manual-labor:save:v2` storage key) contain the shared wallet, lifetime totals, instances with individual tiers, normalized production progress, and ordered slots (null means empty; array length is unlocked capacity). Existing v1 saves migrate into one original press with all cash, earnings, bill counts, and purchased upgrades preserved, plus a free second slot. The v1 backup is retained until reset; future loads prefer the current save. Existing v2 machines migrate to Cash Press with upgrades and cycle progress unchanged. Saves are validated, including IDs, slot references, machine types, family tier IDs, phases, and aggregate statistics.

Economy and order changes save immediately. Production progress checkpoints once per second and flushes on page hide or navigation away. Simulation resumes from the saved phase after reload. Sound is optional. Reset confirms before replacing the entire workshop and clearing the legacy backup. If browser storage is unavailable, a warning appears and play continues for the session.

## Renderer experiment and platform direction

SVG remains the production renderer. In `npm run dev`, open `/manual-labor/?renderer=phaser` or use Settings → Phaser experiment. Switch back with Settings → SVG baseline. Both operate the same instance through the existing reducer and normal local save; use a disposable browser profile for destructive testing. The production build excludes Phaser and its toggle.

Phaser is not yet a compelling replacement for this single active vector machine. The experiment evaluates shared SVG-part textures, pointer interaction, camera effects, and scene cleanup without migrating gameplay. See [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) for the runtime interface, host adapters, evaluation, and future Capacitor/desktop direction. No native projects have been created.

## Cloud accounts and offline production

Copy `.env.example` to `.env.local` for development. Account supports automatic guests, Google linking/sign-in, email verification/password flows, cloud status, conflict choices, and device backups. The Shift Report acknowledges earnings already applied by the authenticated server. See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for SQL/Edge deployment, GitHub repository variables, Auth redirect settings, trust limitations, and live test steps.

## Deploy to GitHub Pages

The workflow builds and tests pull requests, and deploys `main`. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source, then run the workflow or push to `main`. The expected project path is `https://DaveA62.github.io/manual-labor/`. Private repositories require a GitHub plan that supports Pages for private repositories; this setup does not change repository visibility. Pages serves the built game publicly unless your account provides private Pages access.

`vite.config.ts` sets `/manual-labor/` as the asset base. Change that value and the favicon path in `index.html` if you rename the repository or use a custom root domain. No router, server, API keys, or backend are required.

## Structure

- `src/game/types.ts`: instance, workshop, and action data contracts.
- `src/game/definitions.ts`: machine registry, prices, timings, and upgrade definitions.
- `src/game/machines.ts`: instance factory and derived status, direction, and rate helpers.
- `src/game/simulation.ts`: pure per-instance production transitions.
- `src/game/engine.ts`: shared economy, purchases, reordering, and centralized simulation reducer.
- `src/game/useGame.ts`: the single browser clock and save lifecycle.
- `src/game/save.ts`: validation and legacy migration.
- `src/components/Storage.tsx`: sortable slot grid and production cards.
- `src/components/MachineShop.tsx`: one catalog entry per page, machine acquisition, and capacity purchases.
- `src/components/MachineScreen.tsx`: selected instance and its contained Modifications panel.
- `src/components/Press.tsx`: layered SVG press and pointer input; shared artwork in `src/components/press/Parts.tsx`.

The visual system is documented in [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md). Shared palette/type tokens live in `src/tokens.css`; shared equipment controls and pagination live in `src/ui/`. Workshop, Storage, Catalog, and the Modifications overlay fit the dynamic viewport. Fonts are self-hosted with retained OFL licenses.

Run `npm test` for pagination, isolation, simultaneous production, all automation combinations, purchase constraints, migration, reload continuity, and save graph validation. `npm run build` typechecks and builds the production application. No additional machine types or skill systems are implemented. Supabase authentication, revision-checked cloud saves, and offline production are documented in [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

The BT–02 Bottling Machine is available in the Catalog for $250. Its rotary flow valve, bottle carriage, spring capper and swipe collection form a second manual cycle. Four independent upgrades, Water/Soda/Premium refits, quality payouts, shared Storage and trusted offline production are included. See [Bottler balance and architecture](docs/BOTTLER.md). Existing saves migrate to schema 4 automatically.

For tuning prices, tier output, upgrade/refit costs, Storage, offline limits and desktop layout, use [CONFIGURATION.md](docs/CONFIGURATION.md). Wide Workshops show the machine beside shared Modifications and paginated Storage; narrow or short windows retain the compact screen.

Retirement is available in **Account → Service** once current cash funds a Year of Service. It opens the persisted, retirement-only Service Continuum. See [RETIREMENT.md](docs/RETIREMENT.md) for all 16 nodes, shared bonus groups, provisional balance, schema 5 migration and atomic cloud operations.
