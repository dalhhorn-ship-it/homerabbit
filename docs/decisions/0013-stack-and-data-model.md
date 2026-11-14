# 0013 — Stack and data model: one Worker (static assets + /api), React + Carbon, D1 + private R2

> Status: proposed · Date: 2026-11-14

## Context
homerabbit (docs/GOAL.md, ADR 0012): two users, Chrome on iPhone/iPad/desktop (iOS Chrome = WebKit), IBM Carbon
light theme, login by Cloudflare Access email one-time PIN, so the app has no auth of its own and must verify the
Access JWT on every API and photo request. Git deploy to Cloudflare (route A, ADR 0003), production branch `main`,
preview URL per branch, €0–5/month, tests ≤ 120 s, domain coverage ≥ 80%. Rigor L2 plus a privacy test.

## Options
**Hosting.** (1) One Worker with Workers Static Assets for the SPA and `/api/*` handled by the Worker: one deployable,
version rollback, preview URLs from Workers Builds, Cloudflare's current default; preview versions share the Worker's
bindings unless configured (spike S1). (2) Pages + Functions: per-environment bindings for previews out of the box,
but a second deploy model, Cloudflare steers new work to Workers, and our `ship` skill and preview pattern target Workers.
**Frontend.** (1) Vite + React + TS + `@carbon/react`: the official Carbon kit, tree-shakeable ESM. (2) Carbon Web
Components: framework-free, but thinner docs and awkward React-style state. (3) Plain CSS imitating Carbon: small, drifts.
**Storage.** (1) D1 for items, R2 for photos: both free tier, relational queries for ranking/progress. (2) KV for items:
no queries, eventual consistency between two editors. (3) Photos as D1 blobs: row size limit, no streaming.
**Photo upload.** (1) Browser resizes, POSTs to the Worker, Worker writes R2: one auth path. (2) Presigned R2 URLs:
needs R2 API keys in the Worker and a second access path that bypasses our JWT check.
**Drag and drop.** (1) `@dnd-kit/core` + `@dnd-kit/sortable`: pointer/touch sensors with press-delay, keyboard
support, works on WebKit touch. (2) `@hello-pangea/dnd`: good touch, but list-only, heavier. (3) Atlassian
pragmatic-drag-and-drop: tiny, but built on native HTML5 DnD, which is weakest on iOS touch.
**Local identity.** (1) A "skip auth" flag: rejected, one wrong var in production opens the house. (2) Real JWT
verification everywhere, with a local fake issuer (own key pair + JWKS) in dev and tests: production code has no bypass.

## Decision
**Hosting: option 1**, Worker `homerabbit`, `assets.not_found_handling: "single-page-application"`,
`run_worker_first: ["/api/*"]`. Router: Hono (small, typed, `app.request()` in tests). Access protects the whole
hostname plus workers.dev and preview URLs; the shell carries no data, data and photos only come from `/api/*`.
**Auth (every `/api/*` route, one middleware, fail closed):** read `Cf-Access-Jwt-Assertion`; verify RS256 with `jose`
against `${ACCESS_ISSUER}/cdn-cgi/access/certs` (cached per isolate), `iss` = `ACCESS_ISSUER`, `aud` in `ACCESS_AUD`
(comma list: production app + preview-URL app), `exp`/`nbf`; then lower-cased `email` must be in secret
`ALLOWED_EMAILS` (dashboard only, never in git). Missing/invalid token → 401, non-member → 403, missing config → 500,
all with `{error}` and no data. Issuer and AUD are not secret and live in `wrangler.jsonc` top-level `vars`.
**Frontend:** Vite + React 19 + TS + `@carbon/react`, `@cloudflare/vite-plugin` (one `vite dev` runs SPA with HMR and
the Worker in workerd with local D1/R2). Carbon cost control: Sass compiled at build time only (`sass-embedded`, modern
API), so no runtime cost on iOS; import per-component styles (`@carbon/react/scss/components/<x>`) and theme `g10`,
not the full `@carbon/styles` bundle; icons imported one by one; `$css--font-face: false` and self-hosted IBM Plex Sans
400/600 latin woff2 (no IBM CDN). Budget: initial JS ≤ 200 KB gzip, CSS ≤ 60 KB gzip, checked in spike S2 and by a
build-size check. Deadline uses a native `type="date"` input in Carbon `TextInput` (flatpickr DatePicker is poor on touch).
Data fetching: plain `fetch` in a small `api.ts`; no state library until a need shows.
**Phone kanban:** at 390 px one column at a time (Carbon `Tabs`), move via a card "Move to" menu; at ≥ 820 px all five
columns, drag between them. Drag: option 1 (`@dnd-kit`, `TouchSensor` delay 200 ms / tolerance 8 px so lists still scroll).
The menu is also the accessible and Playwright-stable path.
**Storage:** D1 `homerabbit` + private R2 bucket `homerabbit-photos` (no public access, no r2.dev URL). Migrations in
`migrations/` via `wrangler d1 migrations`, applied in the production deploy command before `wrangler deploy`,
expand-then-contract only. Previews bind to `homerabbit-preview` D1/R2, never production data (S1 proves how).
**Photos:** `<input type="file" accept="image/*" multiple>` (no `capture`, so iOS offers camera or library);
`createImageBitmap` + canvas → JPEG q0.8, long edge 1600 px (~300 KB) and thumb 320 px; re-encoding strips EXIF/GPS.
One POST per photo (multipart `full` + `thumb`); Worker checks JPEG magic bytes and ≤ 2 MB, writes
`items/<itemId>/<photoId>.jpg` and `-thumb.jpg`. `GET /api/photos/:id?size=thumb` streams from R2 after the auth check,
`Cache-Control: private, max-age=31536000, immutable`. Item delete removes R2 objects in `waitUntil`.

**Data model (D1, FKs on, ids `crypto.randomUUID()`, times ISO-8601 UTC, dates `YYYY-MM-DD`):**
- `members(id PK, email UNIQUE, display_name, created_at)`: both rows upserted from `ALLOWED_EMAILS` on `GET /api/me`.
- `items(id PK, title NOT NULL, description DEFAULT '', size CHECK IN ('S','M','L','XL'), owner_id NULL → members
  (NULL = both), deadline NULL, urgency INT CHECK 1–5, impact INT CHECK 1–5, status CHECK IN ('backlog','design',
  'preparation','execution','delivered') DEFAULT 'backlog', rank_override REAL NULL, delivered_at NULL,
  created_by → members, created_at, updated_at)`; index `(status)`.
- `photos(id PK, item_id → items ON DELETE CASCADE, r2_key, thumb_key, bytes, width, height, created_by → members,
  created_at)`; index `(item_id)`.
- Concurrency: PATCH sends changed fields only; last write wins (two users, rare clashes).

**API:** `GET /api/me`, `GET /api/items` (all items with photo ids; hundreds, not thousands), `POST /api/items`,
`PATCH /api/items/:id`, `DELETE /api/items/:id`, `POST /api/items/:id/photos`, `GET|DELETE /api/photos/:id`.
**Domain (`src/domain/`, pure TS, shared by web and Worker, TDD):**
- `score(i) = urgency × impact × sizeBoost[size]`, `sizeBoost = {S: 1.5, M: 1.2, L: 1.0, XL: 1.0}` (one constants
  object, tuned after use); `sortKey(i) = rank_override ?? score(i)`; ties: earlier deadline, then older `created_at`.
- `overrideBetween(above?, below?)`: drag sets `rank_override` to the midpoint of the neighbours' sort keys (top:
  key + 1, bottom: key − 1), so overrides live on the score scale. Changing urgency, impact or size clears the override.
- `applyStatus(item, status, now)` sets/clears `delivered_at`; `isOverdue(item, today)` = deadline < today and not
  delivered; `deliveredBySizePerMonth(items, timeZone)`; `parseItemInput(json)` validates bodies (no schema library).

**Testing and local identity: option 2.** `tests/unit` (Vitest, node: domain + JWT verifier with a generated key pair);
`tests/worker` (`@cloudflare/vitest-pool-workers`, Miniflare D1/R2, `fetchMock` serves the test JWKS for the issuer
host) covering routes and the **privacy test**: it iterates the exported route table, so every route, current and
future, is hit with no token, a bad signature, wrong AUD, expired token and a non-member email, and must return
401/403 with no item fields and no photo bytes. `tests/e2e` (Playwright, not in `test`): projects `iphone`
(WebKit, 390×844, touch, mobile) and `ipad` (WebKit, 820×1180, touch) plus `desktop` (Chromium); WebKit is the closest
local stand-in for iOS Chrome, real-device checks stay in the slice checklist. Global setup generates a key pair,
serves its JWKS on `127.0.0.1:8790`, and Playwright sends signed tokens via `extraHTTPHeaders`; the app runs with
`CLOUDFLARE_ENV=local`, a never-deployed `env.local` in `wrangler.jsonc` (issuer `http://127.0.0.1:8790`, AUD `test-aud`,
fake `@example.test` members). A unit test asserts the top-level (production) config has an `https://*.cloudflareaccess.com`
issuer and no `example.test` values. Previews use real Access, so nothing is faked outside local machines.
Coverage: `@vitest/coverage-istanbul` (works in both pools), `json-summary` → `coverage/coverage-summary.json`,
include `src/domain/**` and `src/worker/auth.ts`, threshold 80%.

**Commands (factory.json):**
- test: `npx vitest run` (projects `unit` + `worker` only; tests/e2e and tests/acceptance are outside their globs)
- test_affected: `npx vitest run --changed main`
- coverage: `npx vitest run --coverage`
- lint: `npx tsc -b --noEmit && npx biome check .`
- build: `npx vite build`
- e2e (manual/merge, not in `test`): `npx playwright test`
- Workers Builds: build `npm ci && npx vite build`; production deploy `npx wrangler d1 migrations apply DB --remote &&
  npx wrangler deploy`; branch deploy uploads a version with preview bindings (exact command from S1).

## Consequences
- Easier: one deployable, one auth path for data and photos, no passwords, ranking/progress logic testable without I/O.
- Harder: preview isolation and migrations-before-deploy are config we own; Carbon needs import discipline to stay small.
- Expected time: unit < 5 s, worker < 30 s, e2e 30–60 s (outside `test`); full `test` well under 120 s.
- Cost: Workers, D1, R2 (≈ 0.5 GB after years at 300 KB/photo) and Access (≤ 50 users) all on free tiers: €0.
- Measure: test seconds, domain coverage, gzip bundle size per build, photo upload time on a real iPhone.
- Spikes before or inside HR-0 (time-boxed): S1 (2 h) Workers Builds + vite plugin + Access on workers.dev and
  preview URLs: header present, AUD values, preview versions on separate D1/R2, migrations command with the plugin's
  generated config; S2 (1 h) Carbon bundle and Sass build time against the budget; S3 (1 h, HR-3) iOS Chrome photo
  path: HEIC and 48 MP input, orientation, canvas memory limits, resize time; S4 (30 min, HR-5) dnd-kit drag vs
  scroll on iPad Chrome; S5 (30 min) istanbul coverage merged across both Vitest pools.
