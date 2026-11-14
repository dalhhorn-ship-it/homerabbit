# Operating model

> How this project is built: chosen path(s), rigor, agents, practices, gates, budgets. Written by the `choose-path` skill on 2026-11-14; revised by `retro`. Decision: docs/decisions/0012-operating-model.md.

## Path and rigor
- Primary path: **software-product** (docs/operating-model/paths/software-product.md). No secondary path.
- Rigor: **L2 standard, plus two L3 items**. The tree says L3 (home photos on the public internet), but the
  app has 2 users, no money and no regulated data, so full L3 ceremony is not worth it. Kept from L3:
  1. `security-audit-run` before the first real release (M1 live for daily use);
  2. an automated privacy test: requests without a valid Cloudflare Access identity of an allowed member
     get no item data and no photo bytes.

## Agents and skills
Roster (factory.json `agents.roster`): product-manager, software-architect, test-writer, developer, code-writer,
test-runner, reviewer, task-completion-validator, ui-comprehensive-tester, karen, deploy-watcher, doc-keeper,
bulk-reader. Ladder: L2 in docs/operating-model/AGENT-ROUTING.md.

| When | Use |
|---|---|
| PRD for every backlog item (user approves in chat) | `product-manager` |
| Stack and data model, once before M1 build; risky features later | `software-architect` (ADR) |
| Build an approved item | `developer` in the background; main agent coordinates |
| Ranking score logic | TDD (tests first) by the developer |
| UI touched (every M1 slice) | `ui-comprehensive-tester` at iPhone (390×844) and iPad (820×1180) viewports, Playwright |
| M/L item claimed done | `task-completion-validator` |
| Before merge | `python3 scripts/gate.py`, then `reviewer` |
| After push | `deploy-watcher` in the background |
| Milestone end | `karen`, `jenny` (GOAL.md has 6 criteria), then `retro` |
| Files > 350 lines, logs | `bulk-reader`, `test-runner` |

Autonomy mode: **off** (`autonomy.enabled` false; the pack files came with the template and stay dormant). Revisit after M1.

## Practices and habits
- PRD gate (docs/policies/prd-approval.md): no code without an approved PRD in docs/specs/.
- Walking skeleton first: Access-protected app, empty board, live URL, CI green.
- One vertical slice per backlog item; each gets a preview URL the user can open on the phone.
- TDD for domain logic (ranking score, progress counts, overdue rule); thin component tests; a few Playwright flows.
- UI follows IBM Carbon (light theme, `@carbon/react`); touch targets ≥ 44 px; test on Chrome for iOS.
- Docs-sync at the end of each task; decisions as ADRs.
- After every completed slice, before the dashboard refresh: `product-manager` re-proposes the build sequence (reorders open items in docs/BACKLOG.md, updates the milestone's `> Sequence:` line), then `python3 scripts/dashboard.py` and republish the dashboard to the same URL. Default on; remove this line to opt out.

## Policies
All of docs/policies/* apply, with emphasis on prd-approval, security (credential scoping, no secrets in git),
async-delivery and testing-and-metrics. Runner/issue-ledger policies are dormant (autonomy off).

## Commands
Set in factory.json once the architect has fixed the stack (left blank until then, not guessed):
test, test_affected, coverage, lint, build. Deploy is git-only (no deploy command).

## Quality gates
- [ ] merge gate `python3 scripts/gate.py` passes (tests, lint, protected paths, security scan; no new skips)
- [ ] coverage ≥ 80% on domain code, no drop > 2 pts
- [ ] privacy test green (no data or photos without an allowed Access identity)
- [ ] preview URL smoke-tested (incl. phone viewport) before merge
- [ ] reviewer verdict `ship`; docs-sync done
- [ ] before first daily-use release: `security-audit-run` with no open High/Critical

## Deploy
Cloudflare via git (`ship` skill), route A (dashboard Git integration), production branch `main`, preview URL per
branch. Login by **Cloudflare Access, email one-time PIN**, allow-list of the two household emails (kept in the
Cloudflare dashboard, not in git). Storage expected: D1 (items), R2 (photos, private). Target cost €0 (free tiers).
Rollback: redeploy the previous version from the Cloudflare dashboard, or revert the commit on main.

## Budgets
factory.json defaults kept: full tests ≤ 120 s, affected ≤ 30 s, push-to-live ≤ 180 s, coverage ≥ 80%.

## Deviations from path defaults
- Rigor L2 + two L3 items instead of full L3 (reason above).
- No in-app authentication: Cloudflare Access does login; the app trusts and verifies the Access JWT. Fewer moving
  parts and nothing for us to keep secure on passwords.
