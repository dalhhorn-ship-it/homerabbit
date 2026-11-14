import { expect, newEmail, newPassword, noSidewaysScroll, signUpUi, test, touchTargetsOk } from "./fixtures";

test("login and sign-up screens: right keyboard type, 44 px targets, no sideways scroll", async ({ page }) => {
  await page.goto("/");
  const email = page.getByLabel("Email");
  await expect(email).toHaveAttribute("type", "email");
  await expect(email).toHaveAttribute("inputmode", "email");
  await touchTargetsOk(page);
  await noSidewaysScroll(page);
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await touchTargetsOk(page);
  await noSidewaysScroll(page);
});

test("wrong password gives the generic message, and logout returns to login", async ({ page }) => {
  const email = newEmail("login");
  const password = newPassword();
  await signUpUi(page, email, password);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password-1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is wrong")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByTestId("column").first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("column").first()).toBeVisible();
});

test("sign-up: a short password is refused with a message", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Pat");
  await page.getByLabel("Email").fill(newEmail("short"));
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/at least 10 characters/).last()).toBeVisible();
});

test("sign up, rename, invite a partner who joins, reset their password", async ({ page, browser }, info) => {
  const aliceEmail = newEmail("alice");
  const alicePw = newPassword();
  await signUpUi(page, aliceEmail, alicePw, "Alice");

  await page.getByRole("button", { name: "Household" }).click();
  await expect(page.getByRole("heading", { name: "Household" })).toBeVisible();
  await page.getByLabel("Household name").fill("Our flat");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("banner")).toContainText("Our flat");
  await touchTargetsOk(page);
  await noSidewaysScroll(page);

  await page.getByRole("button", { name: "Create invite link" }).click();
  const link = await page.getByLabel("Invite link").inputValue();
  expect(link).toContain("/invite#");

  // Second person, own browser context and source address.
  const ctx = await browser.newContext({
    ...info.project.use,
    extraHTTPHeaders: { "CF-Connecting-IP": `10.200.${Math.floor(Math.random() * 250)}.7` },
  });
  const bob = await ctx.newPage();
  const bobEmail = newEmail("bob");
  const bobPw = newPassword();
  await bob.goto(link);
  await expect(bob.getByRole("heading", { name: "Join with a new account" })).toBeVisible();
  await bob.getByLabel("Your name").fill("Bob");
  await bob.getByLabel("Email").fill(bobEmail);
  await bob.getByLabel("Password", { exact: true }).fill(bobPw);
  await bob.getByRole("button", { name: "Create account" }).click();
  await expect(bob.getByTestId("column").first()).toBeVisible();
  await expect(bob.getByRole("banner")).toContainText("Our flat");
  await bob.getByRole("button", { name: "Household" }).click();
  const members = bob.getByRole("list", { name: "Members" });
  await expect(members).toContainText(aliceEmail);
  await expect(members).toContainText(bobEmail);
  await expect(bob).toHaveURL(/\/household$/);

  // The link is single use: a third visitor is refused with the generic message.
  const third = await browser.newContext({
    ...info.project.use,
    extraHTTPHeaders: { "CF-Connecting-IP": `10.201.${Math.floor(Math.random() * 250)}.8` },
  });
  const carol = await third.newPage();
  await carol.goto(link);
  await carol.getByLabel("Your name").fill("Carol");
  await carol.getByLabel("Email").fill(newEmail("carol"));
  await carol.getByLabel("Password", { exact: true }).fill(newPassword());
  await carol.getByRole("button", { name: "Create account" }).click();
  await expect(carol.getByText("Could not create account")).toBeVisible();
  await third.close();

  // Alice resets Bob's password; Bob is signed out, logs in with it and must choose a new one.
  await page.reload();
  await page.getByRole("button", { name: "Reset password" }).click();
  const temp = await page.getByLabel("Temporary password", { exact: true }).inputValue();
  expect(temp).toHaveLength(16);
  await bob.reload();
  await expect(bob.getByRole("heading", { name: "Log in" })).toBeVisible();
  await bob.getByLabel("Email").fill(bobEmail);
  await bob.getByLabel("Password", { exact: true }).fill(temp);
  await bob.getByRole("button", { name: "Log in" }).click();
  await expect(bob.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await expect(bob.getByTestId("column")).toHaveCount(0);
  await bob.getByLabel("Temporary password", { exact: true }).fill(temp);
  await bob.getByLabel("New password", { exact: true }).fill(newPassword());
  await bob.getByRole("button", { name: "Save new password" }).click();
  await expect(bob.getByTestId("column").first()).toBeVisible();
  await ctx.close();
});

test("an existing person with an empty household joins from the invite page after logging in", async ({
  page,
  browser,
}, info) => {
  const aliceEmail = newEmail("host");
  await signUpUi(page, aliceEmail, newPassword(), "Host");
  await page.getByRole("button", { name: "Household" }).click();
  await page.getByRole("button", { name: "Create invite link" }).click();
  const link = await page.getByLabel("Invite link").inputValue();

  const ctx = await browser.newContext({
    ...info.project.use,
    extraHTTPHeaders: { "CF-Connecting-IP": `10.202.${Math.floor(Math.random() * 250)}.9` },
  });
  const dana = await ctx.newPage();
  const danaEmail = newEmail("dana");
  const danaPw = newPassword();
  await signUpUi(dana, danaEmail, danaPw, "Dana");
  await dana.goto(link);
  await dana.getByRole("button", { name: "Join this household" }).click();
  await expect(dana.getByTestId("column").first()).toBeVisible();
  await expect(dana.getByRole("banner")).toContainText(aliceEmail);
  await ctx.close();
});
