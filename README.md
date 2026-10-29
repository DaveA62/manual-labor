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

Buy Auto Feeder ($15), Motorized Lift ($35), Auto Collector ($75), and Improved Printing ($150, $10 per bill). The motor handles both lift steps; stamping always stays manual. Progress saves on this browser after earnings and purchases; an unfinished bill restarts on reload. There is no offline income. Sound is optional; toggle it in the header. The reset button opens a confirmation before clearing progression.

## Deploy to GitHub Pages

The workflow builds and tests pull requests, and deploys `main`. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source, then run the workflow or push to `main`. The expected project path is `https://DaveA62.github.io/manual-labor/`. Private repositories require a GitHub plan that supports Pages for private repositories; this setup does not change repository visibility. Pages serves the built game publicly unless your account provides private Pages access.

`vite.config.ts` sets `/manual-labor/` as the asset base. Change that value and the favicon path in `index.html` if you rename the repository or use a custom root domain. No router, server, API keys, or backend are required.

## Structure

- `src/game/engine.ts`: pure production state machine and economy.
- `src/game/useGame.ts`: browser persistence and phase-specific automation.
- `src/game/gestures.ts`: coordinate boundaries and gesture validation.
- `src/components/Press.tsx`: SVG machine and pointer input.
- `src/App.tsx`: workshop interface and upgrade shop.

Only progression is persisted under `manual-labor:save:v1`. Saves are versioned and validated; unavailable storage leaves the game playable and shows a status warning.
