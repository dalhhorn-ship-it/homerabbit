# Backlog

> Milestones and work items; the dashboard reads this file. Seeded by `choose-path`, ticked off as part of every task's definition of done.

Format: one `## Milestone: <name>` heading per milestone (optional `(target: YYYY-MM-DD)`), then items:
`- [ ]` todo · `- [~]` in progress · `- [x]` done · `- [!]` blocked · `- [-]` dropped. Optional `(S|M|L)` size and `#tags`. Optional item ID right after the checkbox (`ABC-n`, e.g. `- [ ] OBS-1 Title`); commits then carry a `Refs: ABC-n` trailer so the Traceability tab can link them.
Optional markers: `(release: vX.Y)` on an item or milestone heading (planned release, Releases view) and `(after: ABC-n)` on an item (Gantt dependency); the dashboard strips them from titles.
Roadmap tab: item order here is the proposed sequence (numbered 1..N across both lanes); an optional `> Sequence: <why>` line under a milestone heading explains it, and a `docs/specs/<slug>.md` link on an item shows its PRD status. Tag technical work `#foundation` (or `#arch`, `#infra`, `#runway`, `#debt`, `#quality`, `#ci`, `#security`, `#process`) to put it in the technical-foundation lane; everything else counts as user value.

## Milestone: M0 — Project set up (target: )
- [x] SET-1 Goal agreed (docs/GOAL.md) #process
- [ ] SET-2 Operating model chosen (docs/OPERATING-MODEL.md) #process
- [ ] SET-3 Test command and CI green (S) #quality

## Milestone: M1 — Capture, rank, kanban, progress (target: )
> Sequence: login first (photos are private), then capture, then ranking and board, then progress. Each item needs an approved PRD before build.
- [ ] HR-1 Login for the two household members; private by default (S) #foundation
- [ ] HR-2 Create/edit item by text with fields: title, description, T-shirt size, owner, deadline, urgency, impact (M)
- [ ] HR-3 Photo capture: attach one or more photos from camera or gallery, private storage, works on iPhone/iPad (M)
- [ ] HR-4 Ranked backlog: score from urgency × impact with size boost, drag to override (M)
- [ ] HR-5 Kanban board: Backlog → Design approach → Preparation → Execution → Delivered, touch drag (M)
- [ ] HR-6 Progress view: delivered items by T-shirt size per month, overdue flags (S)
- [ ] HR-7 Mobile and iPad polish pass (responsive, touch targets, add-to-home-screen) (S)

## Unplanned
