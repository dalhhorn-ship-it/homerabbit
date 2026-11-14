# Handoff — 2026-11-14 — homerabbit: HR-0 built (review ship), HR-1 acceptance suite being finalised

## Task
User (PM, plain words, one recommendation) builds homerabbit: mobile/iPad web app to log home chores (text + photos),
rooms, rank, kanban (Backlog → Design approach → Preparation → Execution → Delivered), progress by T-shirt size, owner,
deadline. Chrome (iOS = WebKit), IBM Carbon light (g10). Own email+password auth, public sign-up, a household per
account, invite partner. Later: AI plan, budget, materials, batching.

## State
- Branch claude/festive-lamport-hl0zt0 (main on origin has only the template). L2 + two L3 items.
- ADR 0013 (accepted design, status proposed) = stack + auth + data model. ADR 0012 amendment = own auth.
- HR-0 `[~]`: built b8647f2, dfbea03, 5e6afa2; review `ship`; follow-up 7a3d2bc. Stays `[~]` until live on Cloudflare.
  factory.json commands go through scripts/app.sh (TD-027 medium: skip heuristic; a `CI` override breaks the template
  bootstrap test in CI — don't add one). e2e not in CI yet (TD-025): add with HR-1.
- HR-1 PRD approved + answers A1–A6 (768de28). Acceptance tests TS in tests/acceptance/accounts-and-households (12a52df).
  test-writer (resumed) is adding Python wrappers per criterion (acceptance.py only maps test*.py), aligning tests to
  the answers, writing INTERFACE.md.
- WAITING ON USER: Cloudflare repo connect steps (in docs/RUNNING.md) + workers.dev URL; choice (a) PR they merge
  (recommended) or (b) standing permission to update main.

## Next steps
1. When test-writer reports: second reading = fresh `developer` builds a throwaway HR-1 from PRD + INTERFACE.md in a
   scratch dir; then `python3 scripts/acceptance.py admit accounts-and-households --reference-dir DIR`; set
   factory.json acceptance.command; commit.
2. Mark HR-1 `[~]`; launch `developer` for HR-1 (also: add rename route to ADR 0013, e2e in CI, miniflare devDep).
3. Then PRD for HR-8 rooms, HR-2 items.

## Watch out
- docs/INDEX.md near 3000-token budget; don't change budgets (test_size pins defaults) — trim curated rows instead.
- After test runs: `git checkout HEAD -- metrics/history.jsonl metrics/tokens.jsonl`; check `git remote -v`.
  Never touch /tmp/code-sign.
