# PRD: Walking skeleton (live app, login, empty board, CI)

> Status: draft, awaiting user approval · Owner: product-manager · Backlog: M1 / HR-0 (also covers M0 / SET-3)

## Problem
There is no app yet. Every later item (items, photos, ranking, board moves) needs a place to live: a public address, a login that keeps strangers out, a board to put things on, and an automatic check that nothing breaks. Building that thin end-to-end slice first removes the biggest unknowns (hosting, login, iPhone/iPad behaviour) before we invest in features.

## Goal and success measure
Traces to GOAL.md: "login-protected, only the two household members", "kanban columns Backlog → Design approach → Preparation → Execution → Delivered", "Chrome on iPhone, iPad", "Carbon light theme", "deploy via git".
Success: both of you open the live address on your phones, log in with an emailed code, and see an empty board with your email in the header. Every push runs the checks automatically.

## Users and user stories
- As a household member, I want to open one web address and log in with a code sent to my email, so that I need no password.
- As a household member, I want to see the five board columns and my own email in the header, so that I know I am in the right place and logged in as me.
- As the owner, I want a separate test address for each branch, so that I can try a change on my phone before it goes live.
- As the owner, I want tests and the merge check to run on every push, so that I find out about breakage early (SET-3).

## Scope
- App live at a Cloudflare address, deployed from git (push to `main` goes live; other branches get a preview address).
- Login handled by Cloudflare Access (email one-time code), allowed emails limited to the two of you.
- One page: Carbon light theme header showing the logged-in email, and an empty board with five columns in the order above.
- Works on Chrome on iPhone and iPad (and desktop Chrome).
- A test command and CI that runs the tests and the merge gate (`python3 scripts/gate.py`); test and build commands filled into factory.json.
- Stack and data choices come from `docs/decisions/0013-stack-and-data-model.md` (pending); this PRD does not choose them.

## What you must do yourself in Cloudflare
The agent cannot and should not do these (credential scoping, docs/policies/security.md):
1. Create or open your Cloudflare account and connect the git repository to a new project (dashboard Git integration, production branch `main`, preview per branch).
2. In Cloudflare Zero Trust, create an Access application covering the live address (and the preview addresses, see open question 1) with a policy "Allow" for exactly your email and your partner's, login method email one-time PIN.
3. Keep the two emails only in the Cloudflare dashboard. They must not appear in git, docs, tests or CI logs.
4. Tell the agent the live address once it exists, so it can be recorded in docs (the address is not secret; the emails are).

## Non-goals
- Creating, editing or listing items (HR-2); photos (HR-3); ranking (HR-4); moving cards (HR-5); progress (HR-6).
- The app itself checking who the visitor is and refusing others (HR-1). Here the app only displays the email Access hands it.
- Polish pass, add-to-home-screen, dark mode (HR-7, later).
- Custom domain, a security audit, monitoring.

## Acceptance criteria
1. Given a visitor who is not logged in, when they open the live address, then they see the Cloudflare login page and no app content.
2. Given an allowed email, when the visitor requests and enters the one-time code, then they land on the board.
3. Given an email that is not on the allow-list, when they try to log in, then they never receive a code or get past the login page.
4. Given a logged-in user, when the board loads, then the header shows that user's email and the board shows exactly five empty columns, in order: Backlog, Design approach, Preparation, Execution, Delivered.
5. Given the page is open, then it uses the IBM Carbon light theme (Carbon components and tokens, no custom colour scheme).
6. Given Chrome on a real iPhone and a real iPad, when logged in, then the board is readable without sideways page zoom, nothing overlaps, and login works end to end (also checked at viewports 390x844 and 820x1180 in automated browser tests).
7. Given a push to any branch, when CI runs, then it executes the tests and the merge gate and shows pass or fail; a deliberately failing test turns it red.
8. Given a push to a non-main branch, when the build finishes, then a preview address for that branch exists and shows the same board behind the same login.
9. Given the repository, then `python3 scripts/metrics.py test` runs the tests and passes, and no email address from the allow-list appears anywhere in git.
10. Given a merge to `main`, then the live address serves the new version within the push-to-live budget (180 s), and the previous version can be restored from the Cloudflare dashboard.

## UX / behaviour notes
- Header: app name "homerabbit" on the left, logged-in email on the right. If the email cannot be read, show "Unknown user" rather than a blank or an error.
- Empty columns show their title and a short "No items yet" line; no add button (it arrives with HR-2).
- Phone: the five columns scroll sideways inside the board, not the whole page.
- Logout is not required for this slice.

## Risks and assumptions
- Riskiest: Cloudflare Access one-time PIN works smoothly in Chrome on iOS (it opens the email, returns to the browser). Test on a real device first, as soon as the first deploy exists.
- Assumption: free tiers cover everything (GOAL.md assumes about EUR 0 to 5 a month; unconfirmed).
- Risk: the raw app address may be reachable without going through Access (e.g. a default Cloudflare subdomain or preview addresses). Mitigation: Access covers all addresses (criterion 1, 8); the app's own check follows in HR-1.
- Risk: CI needs secrets or tokens; they stay in the platform's secret store, never in git.

## Effort and sequencing
M (HR-0 plus SET-3, one slice). Foundation lane. Depends on ADR 0013 (architect, pending) and on your Cloudflare steps above. Blocks HR-1 through HR-7. Suggested order inside the slice: ADR, test command and CI on a stub page, first deploy plus Access, then the board page.

## Open questions
1. Should preview addresses also sit behind Access (safer, but each one needs the login)? Recommended: yes.
2. Do you already have a Cloudflare account and a domain, or is the free default address fine for now? Recommended: default address.
3. Answered: the repository is on GitHub (dalhhorn-ship-it/homerabbit); CI runs as GitHub Actions.
4. Should the board's column titles be fixed in code (recommended) or editable later?
