import { expect, newEmail, newPassword, noSidewaysScroll, signUpUi, test } from "./fixtures";

test("signed-in board: header, five empty columns in order, no page-level horizontal scroll", async ({ page }) => {
  const email = newEmail("board");
  await signUpUi(page, email, newPassword());
  await expect(page.getByRole("banner")).toContainText(`${email}'s home`);
  const titles = page.locator('[data-testid="column"] h2');
  await expect(titles).toHaveText(["Backlog", "Design approach", "Preparation", "Execution", "Delivered"]);
  await expect(page.getByText("No items yet")).toHaveCount(5);
  await noSidewaysScroll(page);
});

test("health endpoint is reachable behind the Worker", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect((await res.json()).ok).toBe(true);
});

test("an anonymous visitor gets the login page, and the API answers 401", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByTestId("column")).toHaveCount(0);
  expect((await request.get("/api/me")).status()).toBe(401);
});
