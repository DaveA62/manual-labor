# Manual Labor

A mobile-first, side-view money press tycoon. Built with React, TypeScript, Vite, CSS, and hand-drawn SVG. No external assets or game engine.

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

Storage is the active workshop floor. Start with two unlocked slots and one Money Press. Tap a card to operate it. Drag the grip with a mouse, or hold it for 430 ms before dragging on touch. Cards keep native vertical scrolling; grips handle dragging. Drop on another press to swap, or into an empty slot to move. Keyboard: focus a grip and use arrow keys.

Machine Shop sells additional presses for $50. Each press has its own permanent ID, cycle progress, upgrades, earnings, and bill count. New machines use the first empty slot. Upgrades are bought separately for every instance:

| Upgrade | Price | Effect |
| --- | --- | --- |
| Auto Feeder | $15 | Loads paper |
| Motorized Lift | $35 | Handles both crank steps |
| Auto Collector | $75 | Collects completed bills |
| Auto Stamper | $125 | Stamps paper |
| Improved Printing | $150 | Doubles this press’s bill value |

All stored presses operate simultaneously, including while shopping or operating a different press. Partial automation stops at the next manual action. Buying all four automation upgrades enables continuous production; Improved Printing is optional. Cards show Needs Input, Running, or Fully Automated, with a phase progress bar and a theoretical earnings/min estimate for fully automated presses.

Additional slots start at $50, then $90, $165, and so on. Configure machine prices, phase durations, upgrade prices, starting slots, and the slot price curve in `src/game/definitions.ts`.

A single 50 ms simulation clock runs above the screens; machine UI never owns production timers. Background here means other screens in the running game. Hidden browser time is paused, and reloading never awards offline income. Stamping stays manual until that specific press buys Auto Stamper.

## Saves

Version 2 saves (`manual-labor:save:v2`) contain the shared wallet, lifetime totals, instances, normalized production progress, and ordered slots (null means empty; array length is unlocked capacity). Existing v1 saves migrate into one original press with all cash, earnings, bill counts, and purchased upgrades preserved, plus a free second slot. The v1 backup is retained until reset; future loads prefer the v2 save. Saves are validated, including IDs, slot references, machine types, phases, and aggregate statistics.

Economy and order changes save immediately. Production progress checkpoints once per second and flushes on page hide or navigation away. Simulation resumes from the saved phase after reload. Sound is optional. Reset confirms before replacing the entire workshop and clearing the legacy backup. If browser storage is unavailable, a warning appears and play continues for the session.

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
- `src/components/MachineShop.tsx`: machine acquisition and capacity purchases.
- `src/components/MachineScreen.tsx`: selected instance and its upgrade shop.
- `src/components/Press.tsx`: the original SVG press and pointer input.

Run `npm test` for isolation, simultaneous production, all automation combinations, purchase constraints, migration, reload continuity, and save graph validation. `npm run build` typechecks and builds the production application. No additional machine types, offline earnings, or skill systems are implemented.
