# PRD: Walking skeleton (live app, empty board, CI)

> Status: approved · 2026-11-14 · by user in chat · Revised 2026-11-14 (Access dropped) · Owner: product-manager · Backlog: M1 / HR-0 (also covers M0 / SET-3)

## Problem
There is no app yet. Every later item (accounts, items, photos, ranking, board moves) needs a place to live: a public address, a page with the right look, and an automatic check that nothing breaks. Building that thin end-to-end slice first removes the biggest unknowns (hosting, deploy flow, iPhone/iPad behaviour) before we invest in features.

## Goal and success measure
Traces to GOAL.md: "kanban columns Backlog → Design approach → Preparation → Execution → Delivered", "Chrome on iPhone, iPad", "Carbon light theme", "deploy via git".
Success: you open the live address on your phone and iPad and see the empty board under a "homerabbit" header. Every push runs the checks automatically and every branch gets a preview address.

## Users and user stories
- As the owner, I want to open one web address on phone and iPad and see the board layout, so that I know hosting and device behaviour work.
- As the owner, I want a separate test address for each branch, so that I can try a change on my phone before it goes live.
- As the owner, I want tests and the merge check to run on every push, so that I find out about breakage early (SET-3).
- As the owner, I want to restore the previous version quickly, so that a bad release is not a long outage.

## Scope
- App live at a free Cloudflare workers.dev address, deployed from git (push to `main` goes live; other branches get a preview address).
- One public page: Carbon light header with the app name "homerabbit", and an empty board with five columns in the order above. Column titles are fixed in code.
- No login, no accounts, no data of any kind (accounts arrive with HR-1).
- Works on Chrome on iPhone and iPad (and desktop Chrome).
- A test command and CI as GitHub Actions that runs the tests and the merge gate (`python3 scripts/gate.py`); test and build commands filled into factory.json.
- Preview deployments use separate preview data, never production data (relevant once HR-1 adds a database; the skeleton has none).
- Stack and data choices come from `docs/decisions/0013-stack-and-data-model.md`; this PRD does not choose them.

## What you must do yourself in Cloudflare
The agent cannot and should not do these (credential scoping, docs/policies/security.md):
1. Create or open your free Cloudflare account and connect the GitHub repository (Workers Builds, production branch `main`, preview builds for other branches).
2. Tell the agent the live workers.dev address once it exists, so it can be recorded in docs (the address is not secret).

## Important: no real data until HR-1
The live and preview addresses are public, with no login. Until HR-1 ships, do not enter any real data, photos or personal details anywhere. The skeleton shows none by design.

## Non-goals
- Login, sign-up, households (HR-1); creating, editing or listing items (HR-2); photos (HR-3); ranking (HR-4); moving cards (HR-5); progress (HR-6); rooms (HR-8).
- Polish pass, add-to-home-screen, dark mode (HR-7, later).
- Custom domain, a security audit, monitoring.

## Acceptance criteria
1. Given anyone with the live address, when they open it, then they see the "homerabbit" header and exactly five empty columns in order: Backlog, Design approach, Preparation, Execution, Delivered.
2. Given the page is open, then it uses the IBM Carbon light theme (Carbon components and tokens, no custom colour scheme).
3. Given the page, then it contains no personal data, no data from any database, and no sign-in controls.
4. Given Chrome on a real iPhone and a real iPad, when the page is open, then the board is readable without sideways page zoom and nothing overlaps (also checked at viewports 390x844 and 820x1180 in automated browser tests).
5. Given a push to any branch, when CI runs, then it executes the tests and the merge gate and shows pass or fail; a deliberately failing test turns it red.
6. Given a push to a non-main branch, when the build finishes, then a preview address for that branch exists and shows the same page.
7. Given the repository, then `python3 scripts/metrics.py test` runs the tests and passes, and no secrets or tokens appear in git.
8. Given a merge to `main`, then the live address serves the new version within the push-to-live budget (180 s), and the previous version can be restored from the Cloudflare dashboard.

## UX / behaviour notes
- Header: app name "homerabbit" on the left; nothing on the right yet.
- Empty columns show their title and a short "No items yet" line; no add button (it arrives with HR-2).
- Phone: the five columns scroll sideways inside the board, not the whole page.

## Risks and assumptions
- Riskiest: Workers Builds plus the chosen stack deploys within the 180 s budget and previews behave as expected. Test with the first deploy.
- Risk: public previews could expose real data once a database exists. Mitigation: previews use separate preview data (a rule HR-1 must honour); the skeleton holds none.
- Assumption: free tiers cover everything (GOAL.md assumes about EUR 0 to 5 a month; unconfirmed).
- Risk: CI needs secrets or tokens; they stay in the platform's secret store, never in git.

## Effort and sequencing
M (HR-0 plus SET-3, one slice; smaller now that login is out). Foundation lane. Depends on ADR 0013 and on your two Cloudflare steps. Blocks HR-1 through HR-8. Suggested order: ADR, test command and CI on a stub page, first deploy, then the board page.

## Open questions
All resolved 2026-11-14:
1. Previews: no Access any more; public URLs with separate preview data, and no personal data until HR-1.
2. Free workers.dev address, no custom domain.
3. Repository on GitHub (dalhhorn-ship-it/homerabbit); CI as GitHub Actions.
4. Column titles fixed in code.
