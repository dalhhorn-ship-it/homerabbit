# Interface assumed by the accounts-and-households acceptance tests

Build from the PRD (docs/specs/accounts-and-households.md) plus this file and ADR 0013. Tests: `*.test.ts` here,
run by Vitest (node) with Miniflare D1 and R2; `test_vitest_suite.py` wraps them per criterion.

## Harness

- Code under test: `<root>/src/worker/app.ts` exports `app` (a Hono app; `app.routes` lists every route, all under `/api`).
  Called as `app.request(path, init, {DB, PHOTOS}, ctx)`; `ctx.waitUntil` exists. Hono `csrf()`: every request sends `Origin: http://localhost`.
- Schema: `<root>/migrations/*.sql`, applied in filename order to an empty D1, one statement per `;`
  (no triggers or `BEGIN..END` bodies). Tables and columns as in ADR 0013 (`users.email/household_id/id`, `households.name`,
  `invites.household_id`, rooms/items/photos only when they exist).
- `<root>` is the project, or `$ACCEPTANCE_REFERENCE` for the second reading (needs a `node_modules` symlink).
- Time: only JS `Date` is faked (`vi.setSystemTime`). Compute every expiry and window from `Date.now()`/`new Date()` in
  the Worker, never from SQL `datetime('now')`.
- Source address: header `CF-Connecting-IP` (each test client has its own unique one).
- Cookie: `__Host-hr_session`, set on sign-up and login, removed (empty or Max-Age 0) on logout; the client replays it.
- Bodies and replies are JSON, `Content-Type: application/json`.

## Routes (status codes: 2xx success; refusals 4xx; limit 429 with `Retry-After`)

- `POST /api/auth/signup {email, password, displayName, inviteToken?}`: password 10..128 chars. Any failure (short password
  excepted: it gets a clear message) incl. duplicate email, bad/used/expired invite: same 4xx status and the same body
  containing "Could not create account"; no account, no cookie.
- `POST /api/auth/login {email, password}`: wrong password and unknown email: same 4xx status and same body containing
  "Email or password is wrong", no cookie. 5 failures per email per 15 min then 429 (also for the right password), body
  contains "try again later", `Retry-After` set; lock lasts 15 min from the failure window (still 429 at 14 min, ok at 15 min+5 s).
  50 failed logins per source per 15 min then 429 from that source only.
- `POST /api/auth/logout`: 2xx, deletes this session only; the old cookie then gets 401.
- `GET /api/me`: 200 with the user, household (name `"<email>'s home"`, email lower-case) and members (objects with `id`,
  `email`); `mustChangePassword: true` (top-level JSON key) while a temporary password is in use. Session is sliding 90 days:
  every authenticated request renews it; unused for 91 days gives 401.
- `PATCH /api/household {name}`: any member renames; 2xx; shown in `GET /api/me`.
- `POST /api/invites {}`: 2xx; reply has the token in a field named like `token`, `link` or `url` (a link `/invite#<token>`
  is fine). `GET /api/invites` lists (blocked while must-change-password). Valid 7 days (ok at 6d23h, refused at 7d+1h), single use.
- `POST /api/invites/accept {token, inviteToken}` (both keys sent, same value) as a logged-in user: joins; the user's
  empty household row is deleted; 409 if that household holds rooms/items; bad/used/expired: same 4xx status and body as each other, nothing changed.
- `POST /api/members/:id/reset-password {}`: another member of the same household; 2xx reply has the temporary password in
  a field whose name contains `password`; all target sessions end; old password stops working. A member of another household: 404.
- `POST /api/me/password {currentPassword, newPassword}`: 2xx; clears must-change; until then every route except
  `/api/me`, `/api/me/password` and logout answers non-2xx (403). The temporary password stops working afterwards.
- `GET /api/health` is public. Every other route without a session: 401 (including paths with ids of other households).
- With a session, any route given another household's id in the path answers 404 (GET/DELETE) or 404/400/422 (POST/PATCH),
  never data, and changes nothing.

## Storage

- Passwords: only a salted slow hash; two accounts with the same password store different values (a text column of 32+
  chars on `users`); the plaintext (or its base64, hex, URL-encoded form) appears in no table; never passed to `console.*`.
