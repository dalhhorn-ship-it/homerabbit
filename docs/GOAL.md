# Goal

> The agreed goal for this project. Agreed with the user on 2026-11-14 (brainstorm). Keep under ~80 lines.

## Outcome
A private web app ("homerabbit") where two people log the chores and fixes their house still needs
(hang lights, skirting boards, open sockets, larger jobs), rank them, and work through them on a
kanban board, with a visible sense of progress. Works like a field inspector's clipboard: walk the
house, snap a photo, log it, then pick the next job from a ranked list.

## Users
- The owner and their partner: one household, 2 users. Not a multi-tenant product.
- Used on phone and iPad (camera capture while walking the house), sometimes desktop.
- Today: no dedicated tool; things are remembered or on ad-hoc lists.

## Artifact type
Software product: a mobile- and iPad-first web app (responsive, touch-friendly, camera upload).

## Constraints
- Browser: Chrome, on iPhone, iPad and desktop; touch-first, phone-sized screens. Note: Chrome on
  iOS/iPadOS runs on Apple's WebKit engine, so iOS web limits (camera input, home-screen install,
  storage) apply as in Safari; test on real iOS Chrome, not only desktop Chrome.
- Private: login-protected, only the two household members can see items and photos.
- Assumed (unconfirmed): low running cost, about €0–5 a month for hosting and photo storage.
- Assumed (unconfirmed): no hard deadline; aim for a usable M1 quickly.
- Maintained by the owner with agent help; deploy via git (danfactory defaults).

## Risk profile
- Personal data: photos of the inside of the home, the two users' accounts. Not regulated, no money handled.
- Public internet, so auth and private photo storage are a must.
- Lifetime: years (the house keeps generating chores), so moderate rigor is worth it.

## Acceptance criteria
1. Both users can log in and create an item by text, optionally with one or more photos taken with
   the iPhone/iPad camera or picked from the gallery.
2. Items carry T-shirt size (S/M/L/XL), owner (either user or both), target deadline, urgency and impact.
3. The backlog is ranked by a simple score (urgency × impact, smaller sizes boosted); users can drag
   to override the order.
4. Kanban board with columns Backlog → Design approach → Preparation → Execution → Delivered;
   items move between columns on touch devices.
5. A progress view counts delivered items by T-shirt size over time (e.g. per month) and flags overdue items.
6. M1 success: both users have used it for two weeks and logged at least 20 real items.

## Non-goals (for M1)
- AI-generated plan of approach.
- Budget, time reservation/calendar booking, materials list.
- Batching of similar chores (synergy grouping).
- Multiple households, sharing outside the household, public sign-up.
- Native iOS/Android apps (web only).

## First milestone
M1: capture (text + photo) → item fields → ranked backlog → kanban → progress counts, for 2 users behind a login.

## Later milestones (ideas, not committed)
- M2: AI plan of approach from photo + description (steps, prep work, materials, rough budget and duration).
- M3: Budget and time reservation (planned date/duration; maybe calendar export), materials shopping list.
- M4: Batching: suggest groups of similar chores (same room, tool, material or trade) to do together.

## Open questions
- Confirm the running cost ceiling (€0–5 a month assumed) and whether there is a target date for M1.
- Time reservation later: real calendar (Google/Apple) or just a planned date inside the app?
- Exact ranking formula weights: tune after real use.
