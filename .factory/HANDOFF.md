# Handoff — 2026-11-14 — homerabbit: HR-0 + HR-1 PRDs approved, waiting on ADR 0013 revision, then tests + build

## Task
User (PM, plain words, one recommendation) builds homerabbit: mobile/iPad web app to log home chores (text + photos),
rooms, rank, kanban (Backlog → Design approach → Preparation → Execution → Delivered), progress by T-shirt size, owner,
deadline. Chrome (iOS = WebKit), IBM Carbon light (g10). Later: AI plan, budget, materials, batching.

## State
- Branch claude/festive-lamport-hl0zt0. phase=build, software-product, L2 + two L3 items (security audit before
  daily-use release; automated cross-household isolation test). Autonomy pack installed, off.
- Login decision CHANGED (ADR 0012 amendment): own email + password, PUBLIC sign-up, each account own household,
  partner joins by invite link, 90-day sessions, reset without email (member or admin command). Rooms = HR-8.
- Accepted defaults: urgency/impact 1–5; editing them or size clears rank override; Delivered leaves ranked list;
  workers.dev, no custom domain; column titles fixed.
- PRDs APPROVED 2026-11-14 by user in chat: docs/specs/walking-skeleton.md (HR-0, `[~]`),
  docs/specs/accounts-and-households.md (HR-1, after HR-0). HR-1 open-question recommendations accepted with approval:
  password ≥10 chars, invite 7 days single use, lockout 5/15 min, invitee empty household removed silently, admin
  reset = documented command.
- software-architect running in background: revising docs/decisions/0013-stack-and-data-model.md (drop Access, own
  auth, households, rooms; one Worker + static assets + Hono /api, Vite+React+TS+@carbon/react, D1, R2, Vitest,
  Playwright 390×844 / 820×1180). Proposed commands: test `npx vitest run`, coverage `npx vitest run --coverage`,
  lint `npx tsc -b --noEmit && npx biome check .`, build `npx vite build`.

## Next steps
1. When architect reports: commit ADR 0013, set factory.json commands; tell the user any open questions.
2. L2 policy: acceptance tests per approved PRD before build (test-writer → second reading → acceptance.py admit).
3. Launch `developer` for HR-0; user connects repo in Cloudflare (Workers Builds, production branch main), sends URL.
4. Then HR-1 `[~]` → developer. Then PRD for HR-8 rooms, HR-2…

## Watch out
- docs/INDEX.md is near its 3000-token budget (test_docs_first.DocBudget); budget must NOT be changed
  (test_size pins defaults) — trim curated rows / long status lines instead.
- After test runs: `git checkout HEAD -- metrics/history.jsonl`; check `git remote -v`. Never touch /tmp/code-sign.
