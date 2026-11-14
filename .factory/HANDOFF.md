# Handoff — 2026-11-14 — homerabbit: HR-0 live, HR-1 built (review fix-first), D1 ids in, fix round running

## Task
User (PM, plain words, one recommendation) builds homerabbit: mobile/iPad web app to log home chores (text + photos),
rooms, rank, kanban, progress by T-shirt size, owner, deadline. Chrome (iOS = WebKit), IBM Carbon light (g10). Own
email+password auth, public sign-up, a household per account, invite partner. FREE Cloudflare plan only.

## State
- Live: https://homerabbit.dalhhorn.workers.dev (HR-0). main = 7a3d2bc. Session env "homerabbit" allows that host.
- STANDING PERMISSION: fast-forward main after gate PASS on that exact sha + reviewer `ship` (OPERATING-MODEL.md).
- Dashboard artifact: https://claude.ai/artifact/HMgesW1YdK7H9qGbGdyfnN; republish dashboard/index.html after slices.
- HR-1 built (809b198..9f44929); C1–C9 admitted + passing; validator APPROVED with caveats; reviewer FIX-FIRST.
  D1 ids on branch (beb7c16): prod 41174761-…, preview 7120b60c-….
- Free plan: R2 needs a card → drop R2 bindings; HR-3 photos go into D1 (resized 200–400 KB).
- Gate FAILS protected-path: 12a52df, 2e86c88, bf998f8 have Acceptance-Change not in the LAST paragraph. Plan (told
  user): squash HR-1 into ONE commit on top of main with trailers in the last paragraph (Refs: HR-1,
  Acceptance-Change: accounts-and-households, Review: ship), gate it with base main, push main, merge main back.

## Next steps
1. Fix-round developer (running): review 1 (explicit `--env preview`), 2 (atomic lockout), 3 (no-store), 5 (reset
   script), 7 (must-change before /invite); drop R2; acceptance command documented/wired; TD-028 medium.
2. Re-review → squash to main → user sets deploy commands:
   prod `npx vite build && npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`;
   branch `npx vite build && npx wrangler d1 migrations apply DB --remote --env preview && npx wrangler versions upload --env preview`.
   Smoke live, `python3 scripts/metrics.py deploy --env prod`, republish dashboard, tick HR-0 after device check.
3. PRDs HR-8 rooms (TD-029: 409 guard needs rooms/items), HR-2 items. Security audit before daily use.

## Watch out
- Subagents may leave HEAD detached: check `git branch --show-current` before committing.
- Trailers must be in the LAST paragraph of commit messages (gate reads only that).
- Acceptance: `python3 -m unittest tests/acceptance/accounts-and-households/test_vitest_suite.py`.
- After `acceptance.py map/admit`: `npx biome format --write tests/acceptance/manifest.json`.
- docs/INDEX.md near 3000-token budget; never change budgets. Restore metrics/*.jsonl after test runs.
