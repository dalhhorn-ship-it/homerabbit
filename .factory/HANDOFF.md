# Handoff — 2026-11-14 — homerabbit: goal + operating model done, stack ADR and HR-0 PRD in progress

## Task
User (PM, plain words, one recommendation) is building homerabbit: private mobile/iPad web app for them + partner to log
home chores (text + optional photos), rank them, kanban (Backlog → Design approach → Preparation → Execution → Delivered),
progress counts by T-shirt size, owner, deadline. Chrome (iOS = WebKit), IBM Carbon light. AI plan/budget/materials/
batching are later milestones.

## State
- Branch claude/festive-lamport-hl0zt0, last commit 24c1594. phase=build. GOAL.md agreed; OPERATING-MODEL.md + ADR 0012:
  software-product, L2 + two L3 items (security audit before daily-use release; automated privacy test), login =
  Cloudflare Access email one-time PIN (emails in Cloudflare dashboard, never git). Autonomy pack installed but off.
- BACKLOG M1: HR-0 walking skeleton … HR-7 polish. SET-3 (test cmd + CI) open, folded into HR-0.
- Running in background: software-architect → docs/decisions/0013-stack-and-data-model.md (incl. factory.json commands);
  product-manager → docs/specs/walking-skeleton.md (HR-0 PRD, draft).
- Unanswered: cost ceiling (€0–5 assumed), M1 deadline (none assumed).

## Next steps
1. When both agents report: review ADR 0013, set factory.json commands; present HR-0 PRD in chat and WAIT for approval.
2. After approval: mark HR-0 `[~]`, launch `developer`; user does Cloudflare dashboard steps (repo connect, Access app).

## Watch out
- Template history removed from BACKLOG; old template ADRs 0001–0011 remain (template's own).
- After test runs: `git checkout HEAD -- metrics/history.jsonl`; check `git remote -v`. Never touch /tmp/code-sign.
