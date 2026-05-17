import { test, expect } from "@playwright/test";

/**
 * Smoke test: verifies the web client loads without console errors
 * and the lobby UI is functional.
 */
test("lobby loads without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  // Lobby form should be visible
  await expect(page.locator(".lobby-title")).toBeVisible();
  await expect(page.locator(".lobby-input").first()).toBeVisible();
  await expect(page.locator(".lobby-btn").first()).toBeVisible();

  // No console errors
  const realErrors = errors.filter(
    (e) => !e.includes("WebSocket") && !e.includes("ws://"), // Ignore expected WS errors when server isn't running
  );
  expect(realErrors).toHaveLength(0);
});

test("name validation shows error for empty name", async ({ page }) => {
  await page.goto("/");

  // Submit without entering a name
  await page.locator(".lobby-btn").first().click();

  // Error should appear
  await expect(page.locator(".lobby-error")).toBeVisible();
});

test("name validation shows error for special characters", async ({ page }) => {
  await page.goto("/");

  await page.locator(".lobby-input").first().fill("@admin!");
  await page.locator(".lobby-btn").first().click();

  await expect(page.locator(".lobby-error")).toBeVisible();
});
