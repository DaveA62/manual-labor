# Manual Labor

- React + TypeScript + Vite. Use CSS and SVG for visuals; keep dependencies minimal.
- Keep production rules, economy, and save validation in `src/game/`; components render state and translate input into actions.
- The five phases are feed → raise → stamp → lift → collect. Only collection pays. Crank direction alternates after collection.
- Automation replaces only its named actions. Stamping is manual until that instance buys Auto Stamper. Full automation requires every phase upgrade.
- Use Pointer Events with capture and cancellation; convert screen coordinates into SVG coordinates. Keep touch targets large and page scrolling available outside the machine.
- Keep one centralized simulation clock, independent of mounted screens. Pause hidden-browser time; never calculate offline earnings.
- Persist validated instance progress, slot order, and economy. Migrate v1 saves without losing the original press. Never award cash from visual effects or timers outside the reducer.
- Run `npm test` and `npm run build` before handing off gameplay changes. Check mouse and touch when preview is available.
- GitHub Pages uses `/manual-labor/`; update the Vite base if the repository name changes.
