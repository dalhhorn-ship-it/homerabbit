# PRD: Template self-test that works inside a real project

> Status: approved · 2026-11-14 · by user in chat · 2026-11-14 · Owner: product-manager · Backlog: M1 / TD-027

## Problem
The factory template tests itself by copying the whole repo as if it were the template, creating a fresh demo project from it, and checking that `check.sh` and the gate pass. In homerabbit that copy also carries project-owned things: the app commands in factory.json, the locked accounts-and-households acceptance tests, and soon the HR-1 acceptance baseline. The copy has no Node dependencies, so these cannot run and the self-test fails. Today a workaround makes `scripts/app.sh` silently skip app commands (exit 0) in such copies. Review rated this medium risk: a copy can report tests, lint and build green without running any. Recording the HR-1 baseline would break the self-test and block shipping HR-1.

## Goal and success measure
Keep the quality gate honest (GOAL: trustworthy, verified delivery) and unblock HR-1. Success: the self-test passes with the HR-1 baseline recorded, and nothing can report green without running.

## Users and user stories
- As the product owner, I want a green check to always mean the tests really ran, so I can trust what ships.
- As the builder, I want to record the HR-1 baseline without breaking the template self-test.

## Scope
- The self-test builds a template-shaped copy: it blanks project-owned factory.json fields (`commands`, `acceptance.command`, project name/phase as bootstrap expects) and leaves out project-owned paths (project acceptance suites, `metrics/acceptance-baseline.json`, app source if needed). It then tests the template machinery, not the project.
- `scripts/app.sh` drops its skip heuristic and simply runs the command. A missing `node_modules` fails loudly.
- Note the same fix as [upstream] in docs/operating-model/LEARNINGS.md for the danfactory template.

## Non-goals
- No change to gate.py or acceptance.py semantics.
- No change to locked acceptance tests, baselines or budgets (making locked tests skip was refused: it weakens them).
- No upstream PR in this slice, only the note.

## Acceptance criteria
1. Given the HR-1 acceptance baseline is recorded, when the template self-test runs in homerabbit, then it passes.
2. Given any copy of the repo, when `scripts/app.sh` is called, then it never exits 0 without running the configured command.
3. Given a copy without `node_modules`, when `python3 scripts/metrics.py test` runs, then it fails loudly with a clear message.
4. Given this change, when the diff is reviewed, then no locked acceptance test, baseline or budget has changed.
5. Given the change is done, when `bash scripts/check.sh` and the gate run, then both PASS.
6. Given the above, then TD-027 is marked resolved in docs/TECH-DEBT.md and the [upstream] note exists in LEARNINGS.md.

## UX / behaviour notes
Failure message for a missing `node_modules` should tell the reader to install dependencies.

## Risks and assumptions
- Riskiest: the template-shaped copy hides a real template bug that only shows with project fields. Mitigation: the real project is still checked by its own `check.sh`/gate runs, which now cannot skip.
- Assumes bootstrap works with blanked `commands` (verify first in the spike).

## Effort and sequencing
S, technical foundation. Do right after HR-1 code is complete, before recording its baseline.

## Open questions
- Is there any other place that relies on the skip (e.g. CI without a git origin)?
