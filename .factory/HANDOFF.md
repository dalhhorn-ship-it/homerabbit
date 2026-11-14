# Handoff — 2026-11-14 — homerabbit: HR-0 live, HR-1 built (review fix-first), D1 ids in, fix round running

## Task
User (PM, plain words, one recommendation) builds homerabbit: mobile/iPad web app to log home chores (text + photos),
rooms, rank, kanban, progress by T-shirt size, owner, deadline. Chrome (iOS = WebKit), IBM Carbon light (g10). Own
email+password auth, public sign-up, a household per account, invite partner. FREE Cloudflare plan only.

## State
- main = 4aa7b21 (HR-1 + TD-027 squash, gate PASS 171 s, review ship); branch merged main back (0a07389), same tree.
- Live: https://homerabbit.dalhhorn.workers.dev (HR-0 so far). Session env "homerabbit" allows that host.
- STANDING PERMISSION: fast-forward main after gate PASS on that exact sha + reviewer `ship` (OPERATING-MODEL.md).
- Dashboard artifact: https://claude.ai/artifact/HMgesW1YdK7H9qGbGdyfnN; republish dashboard/index.html after slices.
- D1: prod homerabbit 41174761-…, preview 7120b60c-…. No R2 (free plan); HR-3 photos into D1.
- Asked user to set Cloudflare deploy commands (prod + branch, with migrations) and retry the main build.

## Next steps
1. After user's build: smoke live (sign-up/login on prod), `python3 scripts/metrics.py deploy --env prod`, tick HR-1
   and HR-0 (HR-0 after user's device check), republish dashboard; first branch build proves preview D1 (TD-026).
2. product-manager: re-propose sequence; PRDs HR-8 rooms (TD-029: 409 guard needs rooms/items), HR-2 items.
3. Security audit (`security-audit-run`) before daily use (L3 item).

## Watch out
- Subagents may leave HEAD detached: check `git branch --show-current` before committing.
- Trailers must be in the LAST paragraph of commit messages (gate reads only that).
- Acceptance: `python3 -m unittest tests/acceptance/accounts-and-households/test_vitest_suite.py`.
- After `acceptance.py map/admit`: `npx biome format --write tests/acceptance/manifest.json`.
- docs/INDEX.md near 3000-token budget; never change budgets. Restore metrics/*.jsonl after test runs.
