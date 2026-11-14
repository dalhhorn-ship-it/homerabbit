# Running and deploying homerabbit

> Run locally; Cloudflare setup.

## Run locally
Needs Node 22+.
```bash
npm ci
npx wrangler d1 migrations apply DB --local   # once, and after each new file in migrations/ (local D1 in .wrangler/)
npx vite dev            # SPA + Worker in workerd at http://localhost:5173 (sign-up, login and the board work locally)
npx vitest run          # unit tests (tests/unit); also: python3 scripts/metrics.py test
npx vite build          # build into dist/ (client assets + Worker)
npm run lint            # tsc + biome
npx playwright test     # e2e at 390x844 and 820x1180; builds, migrates a local D1 and serves `vite preview` itself
```
Browsers for e2e: with WebKit installed (`npx playwright install webkit`) the config uses it. If you only have a Chromium, set `PW_CHROMIUM=/path/to/chrome` (the viewports are emulated, not iOS WebKit).

Layout: `src/worker` (Hono API + Worker entry), `src/domain` (pure TypeScript), `src/app` (React + Carbon), `tests/unit`, `tests/e2e`.

## Cloudflare setup (user steps)
The agent has no Cloudflare credentials and creates no resources. Do these once (route A, Workers Builds):
1. Cloudflare dashboard, Workers & Pages, Create, Import a repository, pick `dalhhorn-ship-it/homerabbit`. Worker name must be `homerabbit` (matches `wrangler.jsonc`).
2. Production branch: `main`.
3. Workers Builds runs only the deploy command for production (the build-command field did not run on this account), so the deploy command does the build and the migration. Set it to exactly:
   `npx vite build && npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`
   Leave the build command empty (or `npm ci`). The `vite build` step writes `dist/homerabbit/wrangler.json` (the Cloudflare plugin's generated config, found through `.wrangler/deploy/config.json`); `wrangler d1` and `wrangler deploy` both read that file, so the migration runs against the `DB` binding of the production Worker (D1 `homerabbit`), never the preview database.
4. Enable branch builds (non-production branches). Set the build variable `CLOUDFLARE_ENV=preview` for non-production builds and the non-production deploy command to `npx vite build && npx wrangler d1 migrations apply DB --remote && npx wrangler versions upload`. With `CLOUDFLARE_ENV=preview` the generated config is the preview Worker (`homerabbit-preview`) bound to D1 `homerabbit-preview` and R2 `homerabbit-photos-preview` (checked locally: `dist/homerabbit/wrangler.json` then names those resources), so previews never touch production data. Verify on the first branch build (ADR 0013 spike S1, TD-026).
5. Tell the agent the live `*.workers.dev` address so it can be recorded in docs (not secret).
6. Rollback: Worker, Deployments, pick the previous version, Rollback.

## Data setup (user steps, once, before HR-1 goes live)
Accounts live in Cloudflare D1; photos (HR-3) will live in R2. No money or card is needed on the free plan for D1; R2 may ask for a payment method but the free tier is enough. Do this in the Cloudflare dashboard:
1. Storage & databases, D1 SQL database, Create: name `homerabbit`. Copy its **Database ID** (a UUID).
2. Create a second D1 database named `homerabbit-preview`. Copy its Database ID.
3. Storage & databases, R2 object storage, Create bucket: `homerabbit-photos`, then `homerabbit-photos-preview`. Leave "Public access" off (no r2.dev URL, no custom domain). Nothing is stored there until HR-3.
4. Paste the ids into `wrangler.jsonc` (ids are not secrets), replacing `REPLACE_ME_PROD_D1_ID` (D1 `homerabbit`) and `REPLACE_ME_PREVIEW_D1_ID` (D1 `homerabbit-preview`), commit and push to `main` (or send them to the agent to do it).
5. In Workers Builds, set the deploy commands from steps 3 and 4 above. The first production build then creates the tables (`migrations/`) and goes live; tables are created by migrations, never by hand.
No secrets are needed: sessions are random tokens stored hashed in D1, so there is no signing key to configure.

## Admin: reset a password
Members reset each other in the app (Household, Reset password). If the only member of a household is locked out, run from a checkout with `npx wrangler login` done as the account owner:
```bash
node scripts/reset-password.mjs someone@example.com                      # production D1 `homerabbit`
node scripts/reset-password.mjs someone@example.com --database homerabbit-preview
node scripts/reset-password.mjs someone@example.com --local              # local dev database
```
It prints a 16-character temporary password once, ends their sessions and forces a new password at the next login. Share it privately.

## Accounts quick reference
Sessions last 90 days since last use (cookie `__Host-hr_session`); 5 failed logins per email or 50 per source address in 15 minutes lock that email or address for 15 minutes; invites are single-use and expire after 7 days. Details: docs/specs/accounts-and-households.md, ADR 0013.
