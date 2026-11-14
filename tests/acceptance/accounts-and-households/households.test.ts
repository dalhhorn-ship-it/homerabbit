// Criteria 5-7 of docs/specs/accounts-and-households.md: invites, failed joins, resets by another member.
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  Client,
  createInvite,
  createWorld,
  DAY,
  findString,
  HOUR,
  homeName,
  householdIdOf,
  is2xx,
  isRefusal,
  login,
  memberId,
  newPerson,
  signUp,
  startClock,
  strongPw,
  uniqueEmail,
  type World,
} from "./helpers";

let w: World;
beforeAll(async () => {
  w = await createWorld();
});
afterAll(async () => {
  await w?.close();
});
afterEach(() => {
  vi.useRealTimers();
});

// POST /api/invites/accept: the field name of the token is not fixed by ADR 0013, so both likely names are sent.
const accept = (c: Client, invite: string) => c.post("/api/invites/accept", { token: invite, inviteToken: invite });

test("test_c5_new_person_signs_up_with_invite_and_joins_household", async () => {
  const alice = await newPerson(w, "c5a");
  const invite = await createInvite(alice);
  const bob = new Client(w);
  const bobEmail = uniqueEmail("c5b");
  const res = await signUp(bob, bobEmail, strongPw(), { inviteToken: invite });
  expect(is2xx(res), `status ${res.status}: ${res.text}`).toBe(true);

  const meB = await bob.get("/api/me");
  expect(meB.status).toBe(200);
  expect(meB.text).toContain(homeName(alice.email));
  expect(meB.text).toContain(alice.email);
  expect(meB.text).toContain(bobEmail);
  expect(meB.text).not.toContain(homeName(bobEmail));

  const meA = await alice.client.get("/api/me");
  expect(meA.text).toContain(bobEmail);
  expect(await w.all("SELECT id FROM households WHERE name = ?", homeName(bobEmail))).toHaveLength(0);
});

test("test_c5_existing_person_with_empty_household_joins_and_old_household_is_removed", async () => {
  const alice = await newPerson(w, "c5ea");
  const carol = await newPerson(w, "c5ec");
  expect(await w.all("SELECT id FROM households WHERE name = ?", homeName(carol.email))).toHaveLength(1);
  const invite = await createInvite(alice);

  const res = await accept(carol.client, invite);
  expect(is2xx(res), `status ${res.status}: ${res.text}`).toBe(true);

  const meC = await carol.client.get("/api/me");
  expect(meC.status).toBe(200);
  expect(meC.text).toContain(homeName(alice.email));
  expect(meC.text).toContain(alice.email);
  expect(meC.text).not.toContain(homeName(carol.email));
  expect((await alice.client.get("/api/me")).text).toContain(carol.email);
  expect(await w.all("SELECT id FROM households WHERE name = ?", homeName(carol.email))).toHaveLength(0);
});

test("test_c5_join_is_refused_when_the_invitee_household_already_holds_data", async () => {
  // Rooms arrive with HR-8; until the table exists there is no data a household can hold (see manifest questions).
  const alice = await newPerson(w, "c5da");
  const dave = await newPerson(w, "c5dd");
  if (!(await w.tableExists("rooms"))) return;
  const daveHousehold = await householdIdOf(w, dave.email);
  await w.db
    .prepare("INSERT INTO rooms (id, household_id, name, created_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), daveHousehold, "Kitchen", new Date().toISOString())
    .run();
  const invite = await createInvite(alice);

  const res = await accept(dave.client, invite);
  expect(res.status).toBe(409);
  expect(res.text.trim().length).toBeGreaterThan(0);
  const meD = await dave.client.get("/api/me");
  expect(meD.text).toContain(homeName(dave.email));
  expect(meD.text).not.toContain(alice.email);
  expect((await alice.client.get("/api/me")).text).not.toContain(dave.email);
});

test("test_c6_invalid_used_and_expired_invites_fail_alike_and_change_nothing", async () => {
  const clock = startClock();
  const alice = await newPerson(w, "c6a");
  const expired = await createInvite(alice);
  const used = await createInvite(alice);
  const first = await signUp(new Client(w), uniqueEmail("c6first"), strongPw(), { inviteToken: used });
  expect(is2xx(first), `first use must work: ${first.status} ${first.text}`).toBe(true);
  const invalid = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  clock.advance(7 * DAY + HOUR);

  const memberCount = async () =>
    (await w.all("SELECT id FROM users WHERE household_id = ?", await householdIdOf(w, alice.email))).length;
  const before = await memberCount();

  // Sign-up path: no account is created.
  const replies = [];
  for (const [kind, invite] of [
    ["invalid", invalid],
    ["used", used],
    ["expired", expired],
  ] as const) {
    const email = uniqueEmail(`c6${kind}`);
    const c = new Client(w);
    const res = await signUp(c, email, strongPw(), { inviteToken: invite });
    expect(isRefusal(res), `${kind} invite via sign-up: status ${res.status}`).toBe(true);
    expect(c.hasSession(), kind).toBe(false);
    expect(await w.all("SELECT id FROM users WHERE email = ?", email), `${kind}: no account created`).toHaveLength(0);
    replies.push(res);
  }
  expect(replies[1].status).toBe(replies[0].status);
  expect(replies[2].status).toBe(replies[0].status);
  expect(replies[1].text).toBe(replies[0].text);
  expect(replies[2].text).toBe(replies[0].text);

  // Accept path for an existing account: same generic failure, the account is unchanged.
  const eve = await newPerson(w, "c6eve");
  const accepts = [];
  for (const invite of [invalid, used, expired]) accepts.push(await accept(eve.client, invite));
  for (const r of accepts) {
    expect(isRefusal(r), `accept status ${r.status}`).toBe(true);
    expect(r.status).toBe(accepts[0].status);
    expect(r.text).toBe(accepts[0].text);
  }
  const meE = await eve.client.get("/api/me");
  expect(meE.text).toContain(homeName(eve.email));
  expect(meE.text).not.toContain(alice.email);
  expect(await memberCount()).toBe(before);
});

test("test_c6_invite_is_single_use_for_a_second_person", async () => {
  const alice = await newPerson(w, "c6su");
  const invite = await createInvite(alice);
  expect(is2xx(await signUp(new Client(w), uniqueEmail("c6one"), strongPw(), { inviteToken: invite }))).toBe(true);
  const late = new Client(w);
  const lateEmail = uniqueEmail("c6two");
  const res = await signUp(late, lateEmail, strongPw(), { inviteToken: invite });
  expect(isRefusal(res), `status ${res.status}`).toBe(true);
  expect((await alice.client.get("/api/me")).text).not.toContain(lateEmail);
});

test("test_c6_invite_still_works_just_before_seven_days", async () => {
  const clock = startClock();
  const alice = await newPerson(w, "c6ok");
  const invite = await createInvite(alice);
  clock.advance(6 * DAY + 23 * HOUR);
  const email = uniqueEmail("c6late");
  const res = await signUp(new Client(w), email, strongPw(), { inviteToken: invite });
  expect(is2xx(res), `status ${res.status}: ${res.text}`).toBe(true);
  expect((await alice.client.get("/api/me")).text).toContain(email);
});

async function twoMembers() {
  const alice = await newPerson(w, "c7a");
  const invite = await createInvite(alice);
  const bobClient = new Client(w);
  const bobEmail = uniqueEmail("c7b");
  const bobPw = strongPw();
  const res = await signUp(bobClient, bobEmail, bobPw, { inviteToken: invite });
  expect(is2xx(res), `invite sign-up status ${res.status}`).toBe(true);
  return { alice, bob: { client: bobClient, email: bobEmail, pw: bobPw } };
}

test("test_c7_member_reset_gives_temporary_password_and_ends_all_old_sessions", async () => {
  const { alice, bob } = await twoMembers();
  const bobPhone = new Client(w);
  const bobIpad = new Client(w);
  expect(is2xx(await login(bobPhone, bob.email, bob.pw))).toBe(true);
  expect(is2xx(await login(bobIpad, bob.email, bob.pw))).toBe(true);

  const me = await alice.client.get("/api/me");
  const id = memberId(me.json, bob.email);
  const reset = await alice.client.post(`/api/members/${id}/reset-password`, {});
  expect(is2xx(reset), `reset status ${reset.status}: ${reset.text}`).toBe(true);
  const temp = findString(reset.json, /password/i);
  expect(temp, `a temporary password must be in the reply: ${reset.text}`).toBeTruthy();
  expect(temp).not.toBe(bob.pw);

  for (const [name, c] of [
    ["sign-up device", bob.client],
    ["phone", bobPhone],
    ["ipad", bobIpad],
  ] as const) {
    expect((await c.get("/api/me")).status, `old session on ${name} must end`).toBe(401);
  }
  expect(is2xx(await login(new Client(w), bob.email, bob.pw)), "old password must stop working").toBe(false);

  const fresh = new Client(w);
  const lg = await login(fresh, bob.email, temp as string);
  expect(is2xx(lg), `temporary password must log in: ${lg.status} ${lg.text}`).toBe(true);
  // A2: the next login forces a new password before anything else.
  const meTemp = await fresh.get("/api/me");
  expect(meTemp.status).toBe(200);
  expect(meTemp.json?.mustChangePassword, "GET /api/me reports mustChangePassword: true").toBe(true);
  expect(is2xx(await fresh.get("/api/invites")), "other routes refuse until a new password is set").toBe(false);
  const newPw = strongPw();
  const change = await fresh.post("/api/me/password", { currentPassword: temp, newPassword: newPw });
  expect(is2xx(change), `password change: ${change.status} ${change.text}`).toBe(true);
  expect(is2xx(await fresh.get("/api/invites")), "usable after choosing a new password").toBe(true);
  expect(is2xx(await login(new Client(w), bob.email, newPw))).toBe(true);
  expect(is2xx(await login(new Client(w), bob.email, temp as string)), "temporary password stops working").toBe(false);

  expect((await alice.client.get("/api/me")).status, "the resetting member is untouched").toBe(200);
});

test("test_c7_reset_by_someone_outside_the_household_is_refused", async () => {
  const { bob } = await twoMembers();
  const stranger = await newPerson(w, "c7s");
  const targetId = memberId((await bob.client.get("/api/me")).json, bob.email);
  const res = await stranger.client.post(`/api/members/${targetId}/reset-password`, {});
  expect(res.status).toBe(404);
  expect(is2xx(await login(new Client(w), bob.email, bob.pw)), "bob's password is unchanged").toBe(true);
});
