# Manual Labor — Questionably Functional

Manual Labor is a dedicated 2D industrial machine game. Equipment is used, repaired, and increasingly overengineered. The interface belongs on that equipment: identification plates, maintenance panels, catalog sheets, and storage bays. It must never become a landing page or an administrative dashboard.

## Palette

Shared colors live in `src/tokens.css`. Use tokens in CSS and non-interactive SVG illustrations.

| Token | Color | Use |
| --- | --- | --- |
| `--paper` | `#E8DDBF` | Main field, paper labels, navigation |
| `--charcoal` | `#303B3B` | Structural outlines, text, frames, rails |
| `--orange` | `#E7A343` | Active navigation, purchase controls, manual actions |
| `--mint` | `#78A58A` | Machinery, maintenance headers, running lamps |
| `--red` | `#CB5948` | Destructive actions and actual warnings; use sparingly |
| `--panel` | `#F4ECD6` | Readable cream panels and equipment plates |
| `--mint-light` | `#B6C9B3` | Workshop field and storage bay interiors |
| `--steel-dark` | `#57786A` | Bay rails and secondary structural parts |
| `--frame` | `#C7C7AA` | Empty bays and inactive materials |

Use flat fills, clear tonal separation, and bold charcoal boundaries. Two-pixel UI seams are standard; primary machine silhouettes can use heavier strokes. No glossy UI gradients, glass panels, bloom, large soft shadows, or arbitrary new accent colors. Safety stripes may be flat repeated shapes, never a background decoration covering whole screens.

### Money Press tier finishes

Painted surfaces use scoped `--machine-paint`, `--machine-highlight`, and `--machine-shade` tokens. Cash uses the existing mint palette. Silver uses worn steel `#ABB5B7`, pale metal `#D4D9D5`, and blue-gray `#627E8D`. Gold uses aged brass `#B79950`, worn edges `#D9C78C`, and dark brass `#7F7045`. These are material finishes, not new interface themes. Charcoal structures, orange controls, cream identification plates, paper, wear marks, and shared animations remain consistent. Tier finishes must appear on the full machine and Storage thumbnails; installed hardware follows its own instance’s finish.

## Typography

- **Barlow Condensed 700:** headings, navigation, equipment labels, model numbers, and controls.
- **IBM Plex Sans 400/500/600:** instructions, balances, production numbers, descriptions, and status.
- Self-host Latin WOFF2 files (Fontsource 5.3.0 packages) in `src/assets/fonts/`; retained OFL licenses also ship in `public/fonts/`.
- Use uppercase for identification and structural labels, normal case for concise operational instructions.
- Keep critical instructions at 12px or larger and readable in the actual mobile layout. Small serial labels may be 9–11px. Reduce decoration before reducing control sizes or instructional text.
- Use tabular numeric treatment where values update. No emoji icons, novelty fonts, or unrelated type families.

## Machine illustration

- Build clean, layered SVG illustrations with legible silhouettes and charcoal outlines.
- Muted mint machinery, cream plates, charcoal frames, orange controls, limited red repair/warning details.
- Show how equipment works: shafts, crank wheels, press heads, plates, exposed bolts, and connections.
- Wear is intentional and sparse: chipped edges, mismatched panels, repairs, exposed fasteners, and replacement parts. Keep critical interactive parts visually distinct.
- Manufactured equipment should remain plausible before questionable additions accumulate. Never replace an interactive control with decoration.
- Catalog and storage thumbnails use a simplified flat vector illustration. Do not mount complete interactive machine UIs in a grid.
- The Money Press is a layered flat SVG in `src/components/press/Parts.tsx`. Frame, head, gears, crank, paper, and upgrade attachments are separate assemblies. The 720×510 viewBox and centers/drop regions are shared with pointer handling; changes must keep both synchronized. No SVG IDs are shared across instances.
- Installed hardware is instance-specific: feed rollers, motor/belt drive, ejector rollers, stamp actuator, and precision print insert. Animate only the assembly currently operating.
- `useMechanicalMotion.ts` is a bounded damped visual follower. Crank input stays direct; head movement has weight and stamping has downward resistance. Recent drag velocity decays after pauses. No cosmetic inertia awards progress.
- Stamp impacts trigger a short frame reaction and finite debris; paper settles or ejects along a short path. No infinite decorative gear motion. Sound remains optional and uses small procedural ratchet/impact transients.

## Game frame and navigation

- `html`, `body`, and `#root` have no normal page scrolling. The shell fits the visible viewport using `100dvh` with `100svh` / `100vh` fallbacks.
- Account for all four `env(safe-area-inset-*)` values. The mobile navigation occupies its own bottom row, including the home-indicator inset.
- Desktop uses a compact side rail. Short landscape screens also use a side rail to preserve vertical space. Navigation is persistent outside modal overlays.
- Every primary screen owns `min-height: 0`, `min-width: 0`, and a contained content area. Avoid content-sized descendants that expand the viewport.
- React to actual available element dimensions using `ResizeObserver`; do not assume a fixed phone, resolution, or browser toolbar height.
- Reduce identification decoration, thumbnail space, or optional status text on short screens. Do not shrink primary targets below 44×44px or force users to scroll for them.
- No hero sections, marketing taglines, website footers, dashboard stat rows, or vertically stacked product-card feeds.

## Screen conventions

### Workshop

One machine dominates a contained work area. The header holds identification and a Modifications control. A single short instruction describes the current manual step; automated actions show their action name. The cash counter and navigation stay in the frame. The press viewBox scales proportionally to fit both available width and height so all parts remain visible. Never crop interactive parts to make the machine look larger.

### Storage

Use industrial bays with structural rails, bolts, model/name plates, and compact status lamps. A measured grid allocates whole bays to a page. Capacity never expands the page vertically. Thumbnail art is omitted in short bays before text or controls become unusable.

Keep previous/next page controls and Add Bay accessible. For cross-page rearranging, the storage screen owns pointer capture; hovering over an enabled page arrow for 550ms turns the page without moving the machine. Drop in a destination bay to commit. Escape/pointer cancellation must never erase machine state. Keyboard arrow keys move across bay and page boundaries, restoring focus to the same machine.

### Catalog

Show one selected equipment entry per catalog page: illustration, model, operation/output specifications, ownership count, price, and purchase button. Keep capacity purchase and page controls on screen. New entries use the same catalog structure rather than extending a vertical product list.

### Modifications

Open a native modal maintenance panel above the stationary Workshop. Native dialog behavior provides focus containment, Escape, and focus return. List only as many whole upgrade rows as fit; use the shared pager for the rest. Show the selected press's production record and shared available cash. Never let maintenance purchases affect another press.

Machine Refit is a compact section within Modifications, selected beside Upgrades. Show current/next tier, base output, upgrade price multiplier, four required automation upgrades, and fee. Improved Printing is optional and resets too. Confirm the reset explicitly before dispatching a refit; Gold shows MAX TIER. Use a two-column arrangement on short landscape screens and paginate upgrade rows. Never stack new sections beneath the panel’s available viewport.

Settings/records and reset confirmation also use contained panels. Scrolling is reserved for genuinely long secondary content such as future legal text, inside that content's own region, never the primary game frame.

## Materials, shapes, and feedback

- Square or nearly square panels (`--corner: 2px`), clear seams, identification plates, visible bolt heads.
- Flat mechanical shadows may use small hard offsets. Avoid floating rounded card stacks.
- Use orange controls and mint running indicators consistently. Pair color with text and geometry; never communicate production state through color alone.
- Keep transitions immediate. Button movement is a one-pixel press; feedback uses short impact, ratchet, payout, or lamp effects.
- Respect `prefers-reduced-motion`. Status text remains meaningful with animations disabled.
- Preserve SVG Pointer Events, capture, cancellation, screen-to-SVG conversion, and mouse/touch parity. Handles use `touch-action: none`; page overscroll, pull-to-refresh, selection, and touch callouts are suppressed for the game.
- Keep Storage's long press at 430ms. Page changes and overlays never reset production. Animation remains presentation, not the source of gameplay progress or cash.

## Writing and humor

Use functional labels and numbers: **Load**, **Running**, **Needs input**, **Purchase machine**, **Add bay**, **Insufficient cash**. Instructions appear only where they enable an action. Descriptions state the upgrade effect once.

Deadpan humor belongs sparingly on equipment/environmental labels, e.g. **LOAD RATING: APPROXIMATE** or **INSPECTION STATUS: PENDING**. Never joke in routine status, errors, purchase requirements, or save warnings. No motivational phrases, filler descriptions, generic encouragement, forced jokes, decorative paragraphs, or unnecessary two-sentence explanations.

## Future features

Reuse `src/tokens.css` and `src/ui/Controls.tsx`, `useElementSize.ts`, and `pagination.ts`. New machines add registry/instance/simulation logic independently of illustrations and screens. Follow the same palette, type, outlines, status language, and viewport rules. Do not add new gameplay in a visual task or introduce a style per machine.

Before delivery: build, run gameplay/pagination checks, inspect Workshop/Storage/Catalog/Modifications at phone and short-landscape dimensions, verify there is no page overflow, confirm all targets and page controls are visible, and exercise both production gestures and rearranging without losing saved progress. Report physical-device verification limits honestly.

## Bottler family

BT–02 uses a mint load-bearing frame, transparent outlined vessels, orange rotary valve and capper grip, visible carriage rails and a separate output crate. Keep silhouette, hit areas and piping mechanically legible at phone size. Water uses pale clear liquid (`#A9C9C5`), Soda muted amber (`#B8794D`) with reinforced fittings and additional gauges, and Premium rich brown-red (`#986555`) with aged brass surfaces and quality-control hardware. These are physical liquid/material colors, never new UI themes.

Use independent SVG assemblies in `components/bottler/Parts.tsx`. Animate fluid, valve, carriage and capper from shared simulation snapshots; show a compact percentage/target plate and physical 95–100% marks. No quality modal or permanent instruction stack. Loader arm, valve motor, capper drive and crate conveyor reflect only that instance’s upgrades. Carbonation/flow motion runs while producing, and reduced motion disables repeated effects. Preserve the common Workshop enclosure, viewport sizing, pagination, navigation and maintenance panel.
