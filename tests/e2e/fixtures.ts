// E2E fixtures. Each test gets its own source address (header CF-Connecting-IP, which Cloudflare overwrites in
// production), so the per-address sign-up and login limits never couple tests. No auth bypass exists: every test signs up.
import { test as base, expect, type Page } from "@playwright/test";

let n = 0;
const rand = () => Math.random().toString(36).slice(2, 10);
const fakeIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${(++n % 250) + 1}`;

export const test = base.extend({
  extraHTTPHeaders: async ({}, use) => {
    await use({ "CF-Connecting-IP": fakeIp() });
  },
});
export { expect };

export const newEmail = (tag: string) => `${tag}-${rand()}@example.test`;
export const newPassword = () => `Zq${rand()}-${rand()}`;

export async function signUpUi(page: Page, email: string, password: string, name = "Pat") {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByTestId("column").first()).toBeVisible();
}

export async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

/** Every visible button, link-button and text field is at least 44 px tall (touch targets). */
export async function touchTargetsOk(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button, input:not([type=hidden])")]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({
        tag: el.tagName,
        text: (el.textContent || (el as HTMLInputElement).id || "").slice(0, 30),
        h: el.getBoundingClientRect().height,
      }))
      .filter((x) => x.h > 0 && x.h < 44),
  );
  expect(small).toEqual([]);
}
