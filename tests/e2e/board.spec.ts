import { expect, test } from "@playwright/test";

test("header, five empty columns in order, no page-level horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toContainText("homerabbit");
  const titles = page.locator('[data-testid="column"] h2');
  await expect(titles).toHaveText(["Backlog", "Design approach", "Preparation", "Execution", "Delivered"]);
  await expect(page.getByText("No items yet")).toHaveCount(5);
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /sign/i })).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("health endpoint is reachable behind the Worker", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect((await res.json()).ok).toBe(true);
});
