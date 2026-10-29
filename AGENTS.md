# Manual Labor

Read [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) before UI or illustration changes.

- React, TypeScript, Vite, CSS, and SVG. Avoid new dependencies unless necessary.
- Identity: **Questionably Functional**. Used industrial equipment, layered vectors, bold charcoal outlines, repaired mint machinery, cream plates, orange controls, restrained red warnings. Flat fills, exposed bolts, nearly square panels. No glossy UI, emoji icons, rounded dashboard cards, or marketing layouts.
- Tokens: `src/tokens.css`. Barlow Condensed for headings/labels; IBM Plex Sans for UI and numbers. Self-host fonts; retain licenses. Reuse `src/ui/` controls and pagination.
- Writing: functional labels, numbers, and one short instruction when needed. No motivational/filler copy or forced jokes. Deadpan humor is sparse and confined to equipment/environmental labels.
- Primary screens fit one visible viewport. Use `100dvh` with fallbacks, all safe-area insets, zero page overflow, and `min-height: 0` / `min-width: 0` in the frame. Compact persistent mobile bottom navigation; desktop/short-landscape side rail.
- Workshop keeps every interactive part visible. Modifications is a contained modal. Storage uses a measured paginated bay grid; Catalog selects one entry per page. Never solve capacity or extra upgrades with a scrolling primary screen. Secondary long text may have its own bounded scroll region.
- Keep targets at least 44×44px. Remove decoration before shrinking controls. Preserve mouse/touch Pointer Events, capture, cancellation, and screen-to-SVG conversion. Prevent browser overscroll, selection, and touch callouts during gameplay. Honor reduced motion.
- Storage: 430ms touch hold; screen-owned capture survives pagination; hover enabled page arrows for 550ms to turn pages while dragging. Keyboard arrows cross pages with focus following the same machine. Reordering changes slots only.
- Money Press artwork lives in `src/components/press/Parts.tsx`; damped presentation motion in `useMechanicalMotion.ts`; pointer handling in `Press.tsx`. Preserve the 720×510 coordinate contract and 44px responsive hit areas. Upgrade assemblies read only the selected instance. Cosmetic motion never advances production.
- Production rules, economy, and save validation stay in `src/game/`. Screens render instances and dispatch actions; a single simulation clock owns all production independent of mounted UI.
- Phases: feed → raise → stamp → lift → collect. Only collection pays. Direction alternates after collection. Automation is per instance; Auto Stamper enables automatic stamping. Hidden-browser time is paused; no offline earnings.
- Persist validated instance progress, slot order, and economy. Preserve v1 migration. Visual effects never award cash or drive simulation. Screen/page/overlay transitions must not reset progress.
- Run `npm test` and `npm run build`. Verify Workshop, Storage, Catalog, and Modifications at phone/short-landscape/desktop sizes: no page overflow, reachable controls, intact gestures, cross-page rearranging, and unchanged saves. Report physical touch testing limits.
- GitHub Pages uses `/manual-labor/`; update the Vite base and favicon path if renamed. Keep temporary QA fixtures out of commits/builds.
