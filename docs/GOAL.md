# Goal

> The agreed goal for this project. Agreed with the user on 2026-11-14 (brainstorm). Keep under ~80 lines.

## Outcome
A web app ("homerabbit") where a household (first: the owner and their partner) logs the chores and fixes their house still needs
(hang lights, skirting boards, open sockets, larger jobs), rank them, and work through them on a
kanban board, with a visible sense of progress. Works like a field inspector's clipboard: walk the
house, snap a photo, log it, then pick the next job from a ranked list.

## Users
- First users: the owner and their partner, sharing one household.
- Anyone can sign up (public sign-up page, email + password). Each new account gets its own private
  household; a member invites others (e.g. the partner) into their household. Households never see each other's data.
- Used on phone and iPad (camera capture while walking the house), sometimes desktop.
- Today: no dedicated tool; things are remembered or on ad-hoc lists.

## Artifact type
Software product: a mobile- and iPad-first web app (responsive, touch-friendly, camera upload).

## Constraints
- Browser: Chrome, on iPhone, iPad and desktop; touch-first, phone-sized screens. Note: Chrome on
  iOS/iPadOS runs on Apple's WebKit engine, so iOS web limits (camera input, home-screen install,
  storage) apply as in Safari; test on real iOS Chrome, not only desktop Chrome.
- Visual design: IBM Carbon Design System, light theme (Carbon "White" or "Gray 10"); dark mode not required for M1.
- Login: email + password, our own accounts (decision changed 2026-11-14 from Cloudflare Access). Devices stay
  logged in 90 days; manual logout. Forgotten password: reset without email in M1 (by another household
  member or an admin command); email reset later.
- Private per household: only members of a household can see its items, rooms and photos.
- Assumed (unconfirmed): low running cost, about €0–5 a month for hosting and photo storage.
- Assumed (unconfirmed): no hard deadline; aim for a usable M1 quickly.
- Maintained by the owner with agent help; deploy via git (danfactory defaults).

## Risk profile
- Personal data: photos of the inside of homes, email addresses, passwords (hashed). Not regulated, no money.
- Public internet with public sign-up: secure password storage, brute-force limits, and strict household
  isolation (no cross-household reads) are musts; private photo storage.
- Lifetime: years (the house keeps generating chores), so moderate rigor is worth it.

## Acceptance criteria
1. A person can sign up with email + password, gets their own household, and can invite their partner into it.
   Members of one household never see another household's data.
2. Members can set up rooms (e.g. Kitchen, Bathroom) and link each chore to a room; the board and list filter by room.
3. Members can create an item by text, optionally with one or more photos taken with
   the iPhone/iPad camera or picked from the gallery.
4. Items carry T-shirt size (S/M/L/XL), owner (either user or both), target deadline, urgency and impact.
5. The backlog is ranked by a simple score (urgency × impact, smaller sizes boosted); users can drag
   to override the order.
6. Kanban board with columns Backlog → Design approach → Preparation → Execution → Delivered;
   items move between columns on touch devices.
7. A progress view counts delivered items by T-shirt size over time (e.g. per month) and flags overdue items.
8. M1 success: both users have used it for two weeks and logged at least 20 real items.

## Non-goals (for M1)
- AI-generated plan of approach.
- Budget, time reservation/calendar booking, materials list.
- Batching of similar chores (synergy grouping).
- Sharing items between households; roles/permissions inside a household (all members are equal).
- Email sending (verification, password-reset links) in M1.
- Native iOS/Android apps (web only).

## First milestone
M1: capture (text + photo) → item fields → ranked backlog → kanban → progress counts, for households behind email + password login, with rooms.

## Later milestones (ideas, not committed)
- M2: AI plan of approach from photo + description (steps, prep work, materials, rough budget and duration).
- M3: Budget and time reservation (planned date/duration; maybe calendar export), materials shopping list.
- M4: Batching: suggest groups of similar chores (same room, tool, material or trade) to do together.

## Open questions
- Confirm the running cost ceiling (€0–5 a month assumed) and whether there is a target date for M1.
- Time reservation later: real calendar (Google/Apple) or just a planned date inside the app?
- Exact ranking formula weights: tune after real use (urgency and impact on a 1–5 scale).
- Without email verification, anyone can sign up with an address they don't own; acceptable for M1? (data is
  per household, so the risk is spam accounts, not data exposure).
