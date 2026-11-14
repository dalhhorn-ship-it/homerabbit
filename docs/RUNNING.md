# Running and deploying homerabbit

> Run locally; Cloudflare setup.

## Run locally
Needs Node 22+.
```bash
npm ci
npx vite dev            # SPA + Worker in workerd at http://localhost:5173 (GET /api/health works)
npx vitest run          # unit tests (tests/unit); also: python3 scripts/metrics.py test
npx vite build          # build into dist/ (client assets + Worker)
npm run lint            # tsc + biome
npx playwright test     # e2e at 390x844 and 820x1180 (needs a prior build; serves `vite preview`)
```
Browsers for e2e: with WebKit installed (`npx playwright install webkit`) the config uses it. If you only have a Chromium, set `PW_CHROMIUM=/path/to/chrome` (the viewports are emulated, not iOS WebKit).

Layout: `src/worker` (Hono API + Worker entry), `src/domain` (pure TypeScript), `src/app` (React + Carbon), `tests/unit`, `tests/e2e`.

## Cloudflare setup (user steps)
The agent has no Cloudflare credentials and creates no resources. Do these once (route A, Workers Builds):
1. Cloudflare dashboard, Workers & Pages, Create, Import a repository, pick `dalhhorn-ship-it/homerabbit`. Worker name must be `homerabbit` (matches `wrangler.jsonc`).
2. Production branch: `main`.
3. Build command: `npm ci && npx vite build`. Deploy command: `npx wrangler deploy` (HR-1 changes it to `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`).
4. Enable branch builds (non-production branches). Set the build variable `CLOUDFLARE_ENV=preview` for non-production builds and use the non-production deploy command `npx wrangler versions upload` (the exact preview command is spike S1 in ADR 0013; verify it on the first branch build). Preview Worker env is `preview` (`homerabbit-preview`).
5. Tell the agent the live `*.workers.dev` address so it can be recorded in docs (not secret).
6. Rollback: Worker, Deployments, pick the previous version, Rollback.

Placeholders to fill when HR-1 adds data bindings (nothing exists yet; do not enter real data until then): `REPLACE_ME_PROD_D1_ID` (D1 `homerabbit`) and `REPLACE_ME_PREVIEW_D1_ID` (D1 `homerabbit-preview`) in `wrangler.jsonc`; R2 buckets `homerabbit-photos` and `homerabbit-photos-preview` (names only, no ids).
