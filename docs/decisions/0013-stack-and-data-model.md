# 0013 — Stack, auth and data model: one Worker, React + Carbon, D1 + private R2, own login

> Status: accepted · Date: 2026-11-14
> Amendment (HR-1 fix round): the Cloudflare free plan has no R2 without a card, so there is no R2 bucket or binding; photos (HR-3) are stored in D1 (the R2 and `r2_key` wording below is superseded; HR-3 sets the exact photo schema and limits). Rate limits are one atomic SQL upsert reserved before the hash.

## Context
homerabbit (docs/GOAL.md, ADR 0012 amendment): public sign-up with email + password, one household per account,
partner joins by invite, all members equal, households strictly isolated. Sessions last 90 days; no email in M1.
Chrome on iPhone/iPad/desktop (iOS Chrome = WebKit), Carbon light theme, free workers.dev address, git deploy
(ADR 0003), €0–5/month, tests ≤ 120 s, domain coverage ≥ 80%. Free plan: 10 ms CPU per request.

## Options
**Hosting.** (1) One Worker with Static Assets + `/api/*`: one deployable, version rollback, Workers Builds previews.
(2) Pages + Functions: per-env bindings built in, but a second deploy model that Cloudflare no longer steers to.
**Frontend.** (1) Vite + React + TS + `@carbon/react`. (2) Carbon Web Components: thin docs. (3) Carbon look-alike CSS: drifts.
**Storage.** (1) D1 + R2. (2) KV: no queries, eventual consistency. (3) Photos as D1 blobs: row limits, no streaming.
**Photo upload.** (1) POST via the Worker: one auth path. (2) Presigned R2 URLs: R2 keys in the Worker, second path.
**Drag.** (1) `@dnd-kit` (touch sensor, keyboard). (2) `@hello-pangea/dnd`: list-only. (3) pragmatic-dnd: weak on iOS.
**Password hash.** (1) PBKDF2-SHA256 via WebCrypto: native, no bundle cost, but workerd caps it at 100 000 iterations
(below OWASP's 600 000). (2) Argon2id/scrypt in WASM: stronger per guess, but +~30–100 KB, memory-hard work runs in
JS/WASM and costs tens of ms CPU per hash, beyond the free 10 ms with no headroom.
**Session.** (1) Random opaque token in a cookie, SHA-256 of it stored in D1: revocable (logout, reset), one D1 read
per request. (2) Signed/HMAC cookie: no lookup, but no revocation without a denylist and a signing secret to rotate.
**Rate limiting.** (1) D1 counters: exact, any window, per email and per IP, testable in Miniflare. (2) Rate Limiting
binding: free and fast, but per-location and 10/60 s periods only, so no per-account limit over 15 minutes.
**Membership.** (1) `users.household_id` (one household per user). (2) A `memberships` join table: only needed for
multi-household users or roles, both non-goals.

## Decision
**Hosting 1**, Worker `homerabbit`, `not_found_handling: "single-page-application"`, `run_worker_first: ["/api/*"]`,
Hono router (`app.request()` in tests). The SPA shell carries no data. **Frontend 1:** React 19, `@cloudflare/vite-plugin`
(one `vite dev` runs SPA + Worker in workerd with local D1/R2); Sass at build time only, per-component Carbon styles,
theme `g10`, icons one by one, self-hosted IBM Plex Sans 400/600; budget initial JS ≤ 200 KB gzip, CSS ≤ 60 KB gzip.
Deadline: native `type="date"` in a Carbon `TextInput`. Plain `fetch` in `api.ts`, no state library.
**Phone kanban:** at 390 px one column at a time (Carbon `Tabs`) with a card "Move to" menu; at ≥ 820 px five columns
with `@dnd-kit` drag (`TouchSensor` 200 ms delay / 8 px tolerance). The menu is also the a11y and Playwright path.
**Storage 1:** D1 `homerabbit`, private R2 `homerabbit-photos` (no public/r2.dev access). `wrangler d1 migrations`,
applied before `wrangler deploy`, expand-then-contract. **Previews** run as a separate Worker env `preview` bound to
D1 `homerabbit-preview` and R2 `homerabbit-photos-preview`; production bindings never appear in a preview (S1).
**Photos:** `<input type="file" accept="image/*" multiple>`; canvas → JPEG q0.8, 1600 px + 320 px thumb, EXIF/GPS
stripped by re-encoding; one multipart POST per photo, Worker checks JPEG magic bytes and ≤ 2 MB. R2 key
`h/<householdId>/<itemId>/<photoId>[-thumb].jpg`, always read from the D1 row, never from the URL.
`GET /api/photos/:id` streams after the scoped lookup, `Cache-Control: private, max-age=31536000, immutable`.

**Auth (all in `src/worker/auth/`):**
- Passwords: option 1, `pbkdf2-sha256$100000$<salt16 b64>$<hash32 b64>`; the stored string carries the parameters
  so a later rehash-on-login is possible. Constant-time compare. Rules: 10–128 chars (approved PRD HR-1; user kept 10 on 2026-11-14), no composition rules, reject
  a bundled list of ~1 000 common passwords and the email itself. If S6 shows free-plan CPU errors, move to Workers
  Paid ($5/month, inside budget) rather than lowering iterations.
- Sessions: option 2 rejected; option 1 with 32 random bytes, cookie `__Host-hr_session` (HttpOnly, Secure,
  SameSite=Lax, Path=/, Max-Age 90 days). Row `sessions(token_hash PK, user_id, created_at, expires_at)`, fixed
  90-day expiry, new token on every login. Logout deletes the row; password change or reset deletes all the user's
  sessions. Expired rows are pruned on that user's next login.
- CSRF: SameSite=Lax plus Hono `csrf()` (Origin must equal the app origin on every non-GET); GETs have no side
  effects; JSON bodies require `Content-Type: application/json`. workers.dev is on the Public Suffix List, so other
  workers.dev apps are cross-site.
- Rate limits (option 1, table `auth_attempts(key PK, window_start, count)`, checked before hashing to save CPU):
  login 5 failures/email/15 min (approved PRD HR-1) and 50/IP (`CF-Connecting-IP`)/15 min; sign-up 5/IP/hour; invite accept and
  password change 10/IP/15 min. Over limit → 429 with `Retry-After`.
- Enumeration: login answers "email or password is wrong" and hashes against a dummy hash for unknown emails.
  Sign-up must say "email already registered" (no email to hide behind); accepted, bounded by the sign-up limit.
- Invites: a member creates one → 32 random bytes, SHA-256 stored, 7-day expiry, single use (`UPDATE … WHERE
  used_at IS NULL AND expires_at > now`, changes = 1), max 5 open per household, revocable. Link
  `/invite#<token>` (fragment, so never in logs or Referer). New person: sign-up with the token joins that household.
  Existing account: allowed only if they are the sole member of a household with no items or rooms, which is then
  deleted; otherwise 409.
- Reset without email: a member picks another member → server generates a 16-char random temporary password, sets
  `must_change_password = 1`, deletes the target's sessions and returns the password once, shown in-app. With the
  flag set, only `/api/me`, `/api/me/password` and logout work. Admin: `node scripts/reset-password.mjs <email>`
  hashes in Node with the same format and runs `wrangler d1 execute homerabbit --remote` (owner credentials).

**Data model (D1, FKs on, ids `crypto.randomUUID()`, times ISO-8601 UTC, dates `YYYY-MM-DD`):**
- `households(id PK, name, created_at)`; `users(id PK, household_id → households, email UNIQUE (trimmed, lower),
  display_name, password_hash, must_change_password DEFAULT 0, created_at, UNIQUE(household_id, id))`.
- `sessions` as above (`user_id → users ON DELETE CASCADE`); `invites(id PK, household_id, token_hash UNIQUE,
  created_by, created_at, expires_at, used_at NULL, used_by NULL)`; `auth_attempts` as above.
- `rooms(id PK, household_id, name, created_at, UNIQUE(household_id, id), UNIQUE(household_id, name COLLATE NOCASE))`.
- `items(id PK, household_id NOT NULL, room_id NULL, owner_id NULL (NULL = both), title, description, size CHECK
  S/M/L/XL, deadline NULL, urgency/impact INT CHECK 1–5, status CHECK backlog/design/preparation/execution/delivered,
  rank_override REAL NULL, delivered_at NULL, created_by, created_at, updated_at, UNIQUE(household_id, id))`;
  composite FKs `(household_id, room_id) → rooms(household_id, id)` and `(household_id, owner_id) →
  users(household_id, id)`, so the database itself refuses a cross-household room or owner. Index `(household_id, status)`.
- `photos(id PK, household_id, item_id, r2_key, thumb_key, bytes, width, height, created_by, created_at)`, FK
  `(household_id, item_id) → items(household_id, id) ON DELETE CASCADE`. Item delete removes R2 objects in `waitUntil`.
- Room delete: one D1 batch sets `room_id = NULL` on its items, then deletes the room (FK `SET NULL` would also null
  `household_id`). PATCH sends changed fields only; last write wins.

**Isolation, enforced in one place:** route handlers never see `env.DB`. Session middleware resolves
`{userId, householdId}` and puts `repo = forHousehold(env.DB, householdId)` on the context; every repo query binds
`household_id`, and a foreign id returns `null` → 404 (not 403, so existence does not leak). A unit test fails if any
file under `src/worker/routes/` mentions `env.DB`, `.prepare(` or `env.PHOTOS`.

**API:** public `POST /api/auth/signup {email, password, displayName, inviteToken?}`, `POST /api/auth/login`; with a
session `POST /api/auth/logout`, `GET /api/me` (user, household, members, mustChangePassword), `PATCH /api/household {name}` (any member renames), `POST /api/me/password`,
`GET|POST /api/invites`, `DELETE /api/invites/:id`, `POST /api/invites/accept`,
`POST /api/members/:id/reset-password`, `GET|POST /api/rooms`, `PATCH|DELETE /api/rooms/:id`, `GET|POST /api/items`,
`PATCH|DELETE /api/items/:id`, `POST /api/items/:id/photos`, `GET|DELETE /api/photos/:id`. Room filter is client-side.
**Domain (`src/domain/`, pure TS, TDD):** `score = urgency × impact × sizeBoost` (`S 1.5, M 1.2, L 1.0, XL 1.0`);
`sortKey = rank_override ?? score`, ties by deadline then `created_at`; ranked list excludes delivered (they still
count in progress); `overrideBetween` sets the neighbours' midpoint; editing urgency, impact or size clears the
override; `applyStatus` sets/clears `delivered_at`; `isOverdue`; `deliveredBySizePerMonth`; `parseItemInput`.

**Testing.** `tests/unit` (Vitest, node): domain, password format/verify, rules, token hashing, the route-file
lint. `tests/worker` (`@cloudflare/vitest-pool-workers`, Miniflare D1/R2): routes, limits, invites, reset, and the
**isolation test**: sign up households A and B through the API, give B rooms, items and photos with marker strings
and marker bytes; then iterate the exported Hono route table and call every method/path (a) without a cookie: 401
except the two public routes, (b) as A with every `:param` filled by B's ids: 404 or empty, no B marker in any body,
no B photo bytes, and B's data unchanged when re-read as B. A route with an unknown `:param` fails the test, so new
routes cannot skip it. `tests/e2e` (Playwright, outside `test`): `iphone`/`ipad` WebKit with touch, `desktop`
Chromium; setup signs up two users via the API (local D1, `CLOUDFLARE_ENV=local`); no auth bypass exists anywhere.
Coverage: `@vitest/coverage-istanbul`, include `src/domain/**`, `src/worker/auth/**`, `src/worker/repo.ts`, 80%.

**Commands (factory.json):**
- test: `npx vitest run` (projects `unit` + `worker`) · test_affected: `npx vitest run --changed main`
- coverage: `npx vitest run --coverage` · lint: `npx tsc -b --noEmit && npx biome check .` · build: `npx vite build`
- e2e (manual/merge, not in `test`): `npx playwright test`
- Workers Builds (as run on the user's account, only the deploy command executes): production `npx vite build && npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`; branch builds with `CLOUDFLARE_ENV=preview`: `npx vite build && npx wrangler d1 migrations apply DB --remote && npx wrangler versions upload` (docs/RUNNING.md).

## Consequences
- Easier: one deployable, one auth path for data and photos, isolation in one module and checked in the database.
- Harder: we own password storage, sessions, limits and isolation; ADR 0012's pre-release security audit covers them.
- Time: unit < 5 s, worker < 40 s (each PBKDF2 hash ~50 ms in tests; keep sign-ups few), e2e outside `test`.
- Cost: Workers, D1, R2 free tiers: €0; Workers Paid $5/month only if S6 fails.
- Measure: test seconds, coverage, gzip bundle size, login CPU ms (Workers observability), iPhone upload time.
- Spikes (time-boxed): S1 (2 h) Workers Builds + vite plugin: preview env as separate Worker with its own D1/R2,
  migrations with the generated config; S2 (1 h) Carbon bundle vs budget; S3 (1 h, HR-3) iOS Chrome photos:
  HEIC, 48 MP, orientation, canvas memory; S4 (30 min) dnd-kit drag vs scroll on iPad; S5 (30 min) istanbul across
  both pools; S6 (1 h, first) PBKDF2 100 000 CPU time on a deployed free-plan Worker, plus `__Host-` Secure cookie
  on `http://localhost` in Playwright WebKit (fallback: HTTPS dev server).
- Answered by user 2026-11-14: sliding 90-day session (renewed with use); min length stays 10; sign-up without
  email verification is fine for M1; account deletion / leaving a household not in M1.

## Deviations
- **Tests:** no `tests/worker` pool. Worker and isolation tests run in Node with Miniflare D1 (`miniflare` is an explicit devDependency): `tests/unit` (own flows, coverage) and the locked acceptance suite (`tests/acceptance/accounts-and-households`, including the isolation test over `app.routes`). `@cloudflare/vitest-pool-workers` is not used; coverage (istanbul) covers `src/domain`, `src/worker/auth`, `src/worker/repo.ts` from the unit project.
- **CSRF:** an own Origin check (`sameOrigin` middleware, every non-GET/HEAD needs `Origin` equal to the app origin) replaces Hono `csrf()`, which only inspects form content types. Cookie flags as decided; `__Host-` + Secure works on `http://localhost` in Chromium (S6 cookie half; WebKit unverified, TD-030). PBKDF2 CPU on a free-plan Worker (S6 first half) is unmeasured until deployed.
- **Anonymous = 401** for every `/api/*` path except health, sign-up and login, including unknown paths (PRD A5). Duplicate sign-up answers like every other sign-up failure (PRD A1), superseding "email already registered".
- **Limits:** counters live in `auth_attempts` with an added `locked_until` column (lock runs 15 minutes from the failure that reached the limit); email keys are stored as SHA-256. The sign-up limit counts every attempt (5/IP/hour); accept and password-change count failures (10/IP/15 min).
- **Sessions:** renewed (sliding) on use once more than one day of the lifetime is gone, to save a write per request. Password change or reset ends all the user's sessions; the changing device gets a fresh one.
- **Invites:** the has-data check looks for `rooms`/`items` tables by name at run time because those migrations arrive later (TD-029). Users of a household with other members also get 409.
- **Deploy:** Workers Builds runs only the deploy command on this account, so build and migration moved into it (see Commands).

