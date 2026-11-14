# PRD: Accounts and households

> Status: approved · 2026-11-14 · by user in chat · 2026-11-14 · Owner: product-manager · Backlog: M1 / HR-1

## Problem
The app will hold photos of the inside of homes and will be on the public internet with open sign-up. Nothing can be stored until we know who is using it and can guarantee that one household never sees another's data. You and your partner need to share one household without a shared login.

## Goal and success measure
Traces to GOAL.md criterion 1, "Login", "Private per household". Success: you sign up, invite your partner by link, both stay logged in on your phones for 90 days, and an automated test proves no request from household A can read household B's data.

## Users and user stories
- As a new person, I want to sign up with email and password and get my own private household, so that I can start straight away.
- As a member, I want to invite my partner with a link, so that we share one household.
- As a member, I want to stay logged in for 90 days and log out when I choose, so that I rarely type my password.
- As a member who forgot the password, I want another member to reset it, so that I am not locked out without email.
- As a member, I want to see who is in my household and rename it.

## Scope
- Public sign-up page (email + password), login page, logout.
- Sessions last 90 days per device, renewed with use (user 2026-11-14); logout ends that device's session.
- Each sign-up creates a household named "<email>'s home"; any member can rename it.
- Invite link: a member creates a link; whoever opens it and signs up or logs in joins that household. All members are equal.
- Member list (email addresses) on a household page.
- Password reset by another member (sets a temporary password; the user must choose a new one at next login).
- Admin reset command run by the owner as the fallback (for a household with one member).
- Brute-force limits on login, sign-up and invite use; generic error messages.
- Phone and iPad usable, Carbon light theme.
- Stack and data design: docs/decisions/0013-stack-and-data-model.md (not decided here).

## Non-goals
- Email verification and email password reset (no email sending in M1; spam sign-ups accepted, data stays per household).
- Roles or permissions (all members equal).
- Leaving, removing a member, or deleting a household or account: can wait, because the first users are the two of you. Add after real use.
- Changing own email or password: not in this slice (reset covers lockout). Candidate for a follow-up.
- Rooms (HR-8) and items (HR-2) themselves; this slice only provides the isolation they rely on.

## Acceptance criteria
1. Given the sign-up page, when someone submits a valid new email and a password of at least 10 characters, then an account and a household "<email>'s home" exist and they are logged in; a too-short password is refused with a clear message.
2. Given a registered user, when they log in on a device, then they stay logged in for 90 days since their last use; after logout on that device, the next visit asks for login again and other devices stay logged in.
3. Given wrong email, wrong password, or an email that already exists at sign-up, then the messages are generic ("Email or password is wrong", "Could not create account") and do not reveal whether an email is registered, including through response differences.
4. Given repeated failed logins for one email or from one source, when a limit is reached (proposed: 5 failures in 15 minutes), then further attempts are refused temporarily with a neutral "try again later" message, also for correct passwords during the lockout.
5. Given a member who opens "Invite", when they create a link and a second person opens it and signs up or logs in, then that person becomes a member of the inviter's household and sees the same member list; an invitee's own previously empty household is removed; if it already holds data, the join is refused with a clear message.
6. Given an invite link that is expired (proposed: 7 days), already used, or invalid, then joining fails with a generic message and changes nothing.
7. Given two members of one household, when one resets the other's password, then the other can log in only with the temporary password and must set a new one; all their old sessions end. Given a household with one member, the owner's admin command achieves the same.
8. Given households A and B with items, rooms and photos (test data), when any signed-in member of A, or an anonymous visitor, requests any B resource (by changing ids in addresses or request bodies), then they get "not found" and no B data or photo bytes. This is an automated test run on every build (the L3 isolation test).
9. Given a stored account, then the password is never stored or logged in readable form, and the database contains only a salted slow hash.
10. Given Chrome on a real iPhone and iPad, and viewports 390x844 and 820x1180, then sign-up, login, invite, member list and rename are usable in Carbon light with no overlap, no sideways page zoom, and the right keyboard type for email fields.

## UX / behaviour notes
- Header shows household name and a menu with Household, Logout.
- Invite page shows the link with a Copy button and share sheet on phones.
- Unauthenticated visitors to any app page are sent to login; after login they return to where they were.
- Previews must use separate preview data, never production (HR-0 rule).

## Risks and assumptions
- Riskiest: strict isolation. Mitigation: criterion 8 is a build gate and a security audit runs before daily-use release.
- Risk: public sign-up invites spam accounts and cost. Mitigation: rate limits (criterion 4); revisit if abused.
- Assumption: the invitee's empty-household removal is fine (criterion 5).
- Risk: member-set temporary passwords are shown to the resetter; they must be told to share it privately.

## Effort and sequencing
L (security-heavy). Foundation lane after HR-0; blocks HR-8, HR-2 and everything that stores data. Suggested slices: sign-up, login, logout and sessions; household and rename; invite and member list; resets; isolation test and limits.

## Open questions
1. Minimum password length: recommend 10 characters, no other composition rules.
2. Invite link expiry: recommend 7 days, single use.
3. Lockout numbers: recommend 5 failures per 15 minutes per email and per source address.
4. Should the invitee with an empty household be moved silently (recommended) or asked to confirm?
5. Admin reset: recommend a command you run (documented in docs), not a web page.
6. Leaving or deleting a household, and changing own password: recommend a follow-up item after two weeks of use.

## Answers 2026-11-14 (by user in chat: "do it", accepting these recommendations)
- Open questions 1–6 above: recommendations accepted with the approval.
- A1 Duplicate sign-up shows the same neutral "Could not create account" as other sign-up errors (criterion 3 wins
  over ADR 0013's "email already registered"); the response must not differ in status or body shape.
- A2 After a reset to a temporary password, the next login forces choosing a new password before anything else.
- A3 Lockout lasts 15 minutes; per source address, at most 50 failed logins per 15 minutes.
- A4 Renaming the household is in HR-1 (route to be added to ADR 0013).
- A5 Anonymous requests for data get 401 from the API (no hint whether the resource exists); the app shows the login page.
- A6 Acceptance suite gets a second reading (throwaway implementation from this PRD) before admission.
