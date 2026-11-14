# Handoff — 2026-11-14 — homerabbit: HR-0 on main, HR-1 tests admitted, HR-1 build running

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
- main = 7a3d2bc (HR-0, gate PASS). User gave STANDING PERMISSION (b): fast-forward main after gate PASS on that sha +
  review ship (in OPERATING-MODEL.md). First Cloudflare build failed (main had no app; build command likely empty) —
  asked user to set build `npm ci && npx vite build`, retry, send workers.dev URL.
- HR-1 acceptance C1–C9 ADMITTED (bf998f8) via second reading in scratchpad/hr1-ref; wrappers pass HR_APP_ROOT.
  C10 manual (no manual marker in acceptance.py). Run `npx biome format --write tests/acceptance/manifest.json` after
  map/admit. C8 seeding is best-effort: check it really seeds once rooms/items exist (HR-8/HR-2).
  Gate on branch head failed protected-path: 12a52df lacks an Acceptance-Change trailer.
- HR-1 `[~]`, developer running.

## Next steps
1. When HR-1 developer reports: gate, reviewer, ui tester; fast-forward main on PASS; deploy-watcher once URL known.
2. User creates D1/R2 in Cloudflare for HR-1 (developer documents IDs/steps). Then PRDs for HR-8 rooms, HR-2 items.

## Watch out
- docs/INDEX.md near 3000-token budget; don't change budgets (test_size pins defaults) — trim curated rows instead.
- After test runs: `git checkout HEAD -- metrics/history.jsonl metrics/tokens.jsonl`; check `git remote -v`.
  Never touch /tmp/code-sign.
