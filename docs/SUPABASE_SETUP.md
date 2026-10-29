# Supabase deployment and verification

Project: `pjushzgqgdudxrufjjkx`. The browser uses `https://pjushzgqgdudxrufjjkx.supabase.co`, never `/rest/v1/` as its client URL.

## Environment

Copy `.env.example` to `.env.local` for development. Only these public build variables belong in Vite:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Their supplied project values are in `.env.example`. `.env.local` is ignored. Never place service-role keys, secret API keys, database passwords, or management tokens in `VITE_*`, client source, GitHub repository variables, screenshots, or logs. Missing variables leave the local game playable with cloud controls disabled.

In GitHub → `DaveA62/manual-labor` → Settings → Secrets and variables → Actions → Variables, add those two repository variables using `.env.example`. Re-run the **Build and deploy to GitHub Pages** workflow. The workflow reads repository variables at build time, with the supplied public project values as defaults so the initial Pages deployment works immediately. Set the variables explicitly for configuration/rotation; changing them requires a new build. Keep Pages using GitHub Actions and the `/manual-labor/` Vite base.

## Deploy database and function

Use an authenticated Supabase CLI (the publishable key cannot deploy infrastructure). From the repository root:

```sh
npx supabase --help
npx supabase login
npx supabase link --help
npx supabase link --project-ref pjushzgqgdudxrufjjkx
npx supabase db push --help
npx supabase db push
npx supabase functions deploy --help
npx supabase functions deploy game-sync --project-ref pjushzgqgdudxrufjjkx
```

The migration in `supabase/migrations/` creates four RLS-protected player tables, read policies, backend-only transactional RPCs, and recovery retention. Inspect existing remote migration history before pushing to an already modified project. Do not run the migration repeatedly in the SQL editor after it has been applied. To create later migrations, use `supabase migration new <name>`.

`supabase/config.toml` sets `verify_jwt=false` for **this function** because publishable API keys are not JWTs. The handler still requires a real user bearer token and verifies it with `auth.getUser(token)` on every request. Never remove that check. The user ID comes exclusively from that verified response, never the body. Supabase supplies the runtime URL and API key dictionaries. The function prefers `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`, supports local single-key values, and retains legacy anon/service-role fallbacks for compatibility. Privileged keys stay inside the Edge Function.

Default browser origins are `https://davea62.github.io`, `http://localhost:5173`, `http://localhost:4173`, and the development preview `http://terminal.local:4173`. If another development origin is needed, set the function's `ALLOWED_ORIGINS` secret to a comma-separated list with no trailing slashes:

```sh
npx supabase secrets set --help
npx supabase secrets set 'ALLOWED_ORIGINS=https://davea62.github.io,http://localhost:5173,http://localhost:4173,http://terminal.local:4173' --project-ref pjushzgqgdudxrufjjkx
```

CORS is not authorization. Non-browser callers must still authenticate. Remove temporary preview origins when no longer used. Deploy the function after rule changes alongside the frontend; bump `RULES_VERSION` when changing production/economy interpretation.

## Authentication dashboard

In Authentication configuration:

1. Allow new signups and anonymous sign-ins.
2. Enable Email and **Confirm Email**. Configure production SMTP so verification/recovery mail can reach players; the built-in trial sender is limited.
3. Enable **manual identity linking**.
4. Save both the Google OAuth web client ID and client secret in the Google provider. A live Task 07 linking probe reported **Unsupported provider: missing OAuth secret**; Google is enabled, but that provider credential must be completed before login works. Do not paste it into the app or any `VITE_*` variable. Google's authorized redirect URI is `https://pjushzgqgdudxrufjjkx.supabase.co/auth/v1/callback`.
5. Set Site URL to `https://davea62.github.io/manual-labor/`.
6. Allow application redirects for `https://davea62.github.io/manual-labor/**`, `http://localhost:5173/manual-labor/**`, and `http://localhost:4173/manual-labor/**`. Add the exact temporary preview origin/path only when testing it. The app returns to the existing root document using `?auth=google`, `?auth=verify`, or `?auth=recovery`; GitHub Pages needs no extra route.

The app uses PKCE, persistent Supabase sessions, and automatic token refresh. Finish email/Google callbacks in the browser profile that initiated the flow so its PKCE verifier is available. Email guest linking first verifies the email with `updateUser({email})`, then offers password setup after returning; it never creates a replacement guest UUID. Google guest conversion calls `linkIdentity`, while signing into an existing account is a separate action. No automatic save merges occur. An identity collision leaves the current save intact and offers existing-account sign-in.

Future Capacitor/Steam wrappers need their own approved redirect/deep-link adapter and protected session storage; don't hardcode web callbacks into native projects. No native wrapper is included here.

## Save operations and recovery

The `game-sync` function exposes authenticated `peek`, `commit`, and report `ack` operations. It replays validated game actions through the shared reducer, advances all machines with shared simulation using database timestamps, and commits with a revision compare-and-swap. There are no client SQL writes to cash or checkpoints. Requests have persistent UUID receipts so a lost HTTP response can be retried without applying the transaction twice.

`ml_saves` stores the v4 snapshot, monotonically increasing revision, schema version, server production checkpoint, and created/updated timestamps. `ml_save_snapshots` retains the previous ten revisions. `ml_save_receipts` keeps the most recent 128 transaction receipts per player. Older retried requests still fail the revision check rather than granting income again. `ml_shift_reports` stores already-applied reports and acknowledgements independently of the financial revision.

The original localStorage save key and v1/v2/v3 migration remain supported. Local account caches include a base revision, checkpoint-relative action journal, pending request, and dismissed report IDs. Journals are scoped by account and browser-window identity. A second device/window loads the same cloud account; a stale active session receives a visible conflict. **Load cloud / earlier save** preserves the current device snapshot before loading the cloud copy. **Keep device copy** keeps an isolated local fork and stops uploading it. Neither choice overwrites cloud state with an arbitrary local balance. Use Download backup before clearing browser data.

Five local recovery snapshots are kept under `manual-labor:recovery`, plus the previous local branch when choosing a cloud copy. Backups contain game data, not Supabase access/refresh tokens. Server snapshot recovery is an administrator operation: inspect the owner's historical revision, validate it with the v4 codec, and restore through an audited new revision. Never reset a live revision to an old number, edit checkpoint times to grant money, or expose an unrestricted restore-cash RPC.

A signed-out guest has no recoverable login method. Link Google or verify email/set a password first to use the same progress on another device. Anonymous sign-out requires an explicit confirmation and keeps a device backup. Sign-out does not delete cloud rows.

## Offline production

The server consumes time since its saved production checkpoint, caps eligibility at eight hours, and uses 100% efficiency. Fully automated machines loop, partially automated machines stop at the next manual step, and unautomated presses wait. Refit machines use their remaining automation and own tier; other instances are independent. The production checkpoint always moves to the current server time, including when the cap truncates a longer absence, so discarded time cannot be reclaimed.

Only foreground simulation runs locally for cloud accounts. Return/reconnect requests reconcile to the canonical server state. Device-only offline simulation is explicitly quarantined: it creates a local Shift Report and retains a pre-offline importable snapshot. It is never silently imported as authoritative cloud money. A legacy pre-Task-07 save has no offline grant and can be imported once into an empty account without changing its cash, machine IDs/order, upgrades, prestige, or progress.

Shift Report totals have already been applied atomically before display. Collect/Escape only acknowledges the report. Rows are paginated, empty reports are omitted, and acknowledgements are retried without touching cash.

## Security limits

This is **not a cheat-proof economy**. The server refuses supplied payout totals, client elapsed time, arbitrary replacement snapshots after bootstrap, and direct wallet writes. It validates ownership and replays purchases, refits, manual actions, and automation through the existing rules. However, it cannot prove that a manual action came from a human gesture. A modified client can synthesize legal manual actions or choose their positions within the server-approved time budget. The one-time legacy import necessarily trusts historical device data; it is an explicit compatibility exception and must not be reused as a general save replacement API. Do not add leaderboards or financial rewards assuming those inputs are verified.

New machine families must work in the pure shared simulation/reducer, define bounded automation, participate in validation, and have server/client parity tests. Never implement offline rewards from renderer completion callbacks or client clock differences. Do not authorize with user-editable `user_metadata`. Backend RPCs are SECURITY INVOKER, executable only by `service_role`, with no user wallet write grants. Keep RLS and owner SELECT predicates on every exposed table.

## Verification

```sh
npm test
npm run build
npx deno check supabase/functions/game-sync/index.ts
# With a local Supabase stack / Docker available:
npx supabase test db
```

Automated tests cover legacy migration, all tiers and automation patterns, eight-hour caps, partial/manual machines, atomic conflicts, concurrent/retried claims, request tampering, same-ID guest linking, second-device loading, pending actions added during network requests, local-offline quarantine, and report acknowledgement. The migration has also been exercised in an embedded PostgreSQL runtime for RLS ownership, denied writes/RPCs, compare-and-swap, receipt replay, and snapshot retention.

After deploying the real backend, verify with disposable test accounts:

1. New browser profile: Guest account appears without interrupting gameplay; Account becomes Synced.
2. Link Google, return, and verify the same machine IDs, bay order, and record. Repeat with email verification and password setup. An already-linked identity must not merge saves.
3. Sign in on a second browser/device; load the cloud save. Make changes in both sessions and confirm the stale one shows Conflict. Keep or load explicitly.
4. Save a fully automated press, close, and return. Verify per-machine Shift Report totals; reload and Collect must not add the payout again. Include a partial press and a newly refitted manual press.
5. Verify email sign-in, verification, password recovery, and sign-out locally and on GitHub Pages using the redirect URLs above.
6. Re-test portrait, short landscape, and desktop panels. Real touchscreen/fast-stamp and native deep-link testing require devices.

Live anonymous authentication, second-client cloud loading, SQL ownership restrictions, concurrent conflicts, duplicate claims, and the eight-hour cap passed against the deployed backend. Google completion is blocked by the provider's missing OAuth client secret. Email verification, password recovery, and permanent-account cross-device sign-in still require a user-controlled mailbox and login; they have not been completed. Physical touchscreen and native deep-link checks also remain device tests.

## Deployment record

The `cloud_saves` migration and `game-sync` function were applied to the supplied project during Task 07. The local migration filename matches remote history. Later `supabase db push` runs should therefore see it as applied. Backend authentication, migration, owner isolation, denied writes/RPCs, second-client loads, and server cap/idempotency checks were exercised against the live service with disposable anonymous QA accounts. Google/email completion still requires a user-controlled test login and mailbox. The anonymous cloud and manual production loop were also verified in the browser; a manually produced bill persisted once with $5 lifetime earnings on that instance.

The security advisor flags owner-scoped access by authenticated anonymous users; that access is intentional for guest saves and is not a public `anon` role grant. It also reports leaked-password protection disabled: enable it in Auth settings if available for the project ([guide](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). The performance advisor reported no findings after the initial migration.

## Task 08 deployment

Read [BOTTLER.md](BOTTLER.md). Apply the additive `bottler_schema_v4` migration before updating `game-sync`, then deploy the frontend. It allows existing schema-3 rows and new schema-4 saves, and refuses schema downgrades after a row reaches v4. No existing save/checkpoint is rewritten by the migration. Include `src/game/bottling.ts` and all existing relative shared imports in the Edge Function bundle. The CLI `functions deploy game-sync` resolves these imports from the checkout.

The function now uses rules version 2. It accepts old rules-v1 Press-only clients, while accounts containing Bottlers require the updated client. New clients preserve pending Press request IDs while updating their rules marker. Existing CAS locks, receipts, owner RLS, snapshot retention and privileged key boundaries remain unchanged.

Task 08 deployment verification: the v4 migration and function version 5 were applied to this project. A live disposable guest save containing Water/Soda/Premium Bottlers, a partial Bottler, a refitted manual Bottler and a Gold Press produced exactly $2,603,842.50 after a simulated 20-hour absence capped at eight hours. Repeating the receipt returned identical balances; acknowledgement paid nothing; simultaneous revisions produced one success and one conflict. Second authenticated client loading and cent-accurate cloud persistence passed. Performance advisors reported no findings; the pre-existing intentional guest-read and leaked-password-protection warnings remain unchanged.

## Task 09 shared configuration

Production configuration moved to `src/config/economy.ts`, `src/config/production.ts`, and `src/config/machines/{types,moneyPress,bottler}.ts`. Include those relative dependencies when bundling `game-sync`; the standard CLI deployment resolves them from the checkout. All default prices, output, timing, quality bands and the eight-hour cap remain unchanged. No SQL migration, schema bump, rules bump or account configuration is required for this refactor. See [CONFIGURATION.md](CONFIGURATION.md) for later tuning/deployment requirements.

Task 09 deployment check: `game-sync` version 6 uses the shared config bundle. An authenticated disposable guest smoke test preserved schema 4/rules 2, paid one $25 automated collection, stopped at manual Load, and returned the same revision for a repeated request UUID. No SQL migration was applied.

## Task 10 deployment

1. Apply `supabase/migrations/20261029200206_retirement_continuum.sql` (`supabase db push` for a linked project, or the versioned SQL through the dashboard/MCP). It widens the schema check to 3/4/5, keeps old rows/checkpoints, rejects Service downgrades and acknowledges retired-factory reports. No new tables, grants, OAuth redirect or environment variables.
2. Deploy `game-sync` with all relative imports. Add `src/cloud/service.ts`, `src/config/retirement.ts`, `src/config/continuum/skills.ts`, and `src/game/service/{types,codec,stats,progression}.ts` to the existing shared bundle. The CLI resolves these from the checkout. JWT gateway verification remains disabled because the handler authenticates every bearer token with `auth.getUser` itself.
3. Publish frontend schema 5/rules 3. Old rules 1/2 can continue for accounts without Service; after retirement, old clients must reload. Retain database snapshots and receipts. Do not roll back to a client/function that cannot parse Service state.
4. Verify with a disposable guest: retire, repeat the request UUID, buy a level, reload mid-session, start a career, and load from a second client. Check another owner cannot read/write that row or invoke `ml_commit`. Never seed or reset a real player's account for QA.

Retirement is cloud-only, including for anonymous guests. Initial legacy cash import remains a one-time compatibility trust exception, but importing points, levels, recognition or history is rejected. See [RETIREMENT.md](RETIREMENT.md) for transaction, offline, resume and progression rules.

Existing advisor notices remain: owner-scoped guest reads are intentional ([anonymous policies](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins)); leaked-password protection is a pre-existing dashboard setting ([configuration](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). Retirement adds no public write policy or privileged browser key.

Task 10 live verification: the additive migration was applied and its local filename aligned to remote version `20261029200206`. Authenticated disposable accounts verified schema 5/rules 3, one success/one conflict for simultaneous retirement, receipt replay without another award, rejected Service imports/stale levels, owner-isolated reads, denied direct writes/privileged RPC calls, and a $6.50 manual payout after First Day 1 plus Recognition. Browser QA covered first retirement, six-neighbor discovery, reload/resume, skill purchase, pan/wheel/recenter/keyboard navigation, new-career reset and compact layouts. Touch/pinch math is tested; physical device input and sound still need playtesting.

Final Task 10 function: `game-sync` version 8, with the complete 23-file shared bundle. No performance-advisor findings; pre-existing security notices above are unchanged. Automated validation: 79 passing tests, production build and Deno type check. The GitHub Pages workflow reads the existing public repository variables; no new secrets or configuration are required.
