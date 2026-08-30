import { expect, test } from "@playwright/test";
import { seedGarden } from "./support/seed";

test.beforeEach(async ({ page }) => {
  await seedGarden(page);
  // Close the settings drawer left open by seedGarden
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
});

test.describe("plant toolbar", () => {
  test("defaults to Habits with area columns visible", async ({ page }) => {
    // Area columns visible (from fixture: Learning, Movement, Making)
    await expect(page.getByText("Learning").first()).toBeVisible();
    await expect(page.getByText("Movement").first()).toBeVisible();
    await expect(page.getByText("Making").first()).toBeVisible();
  });

  test("switches to People view and shows categories", async ({ page }) => {
    await page.locator("button", { hasText: "People" }).first().click();

    await expect(page.getByText("family").first()).toBeVisible();
    await expect(page.getByText("friends").first()).toBeVisible();
    await expect(page.getByText("Alice").first()).toBeVisible();
    await expect(page.getByText("Bob").first()).toBeVisible();
    await expect(page.getByText("Carol").first()).toBeVisible();
  });

  test("groups habits by attitude, unset lands in No attitude column", async ({
    page,
  }) => {
    await page.locator("button", { hasText: "Attitude" }).first().click();

    await expect(page.getByText("BEGINNING").first()).toBeVisible();
    await expect(page.getByText("BUILDING").first()).toBeVisible();
    await expect(page.getByText("KEEPING").first()).toBeVisible();
    await expect(page.getByText("No attitude").first()).toBeVisible();
  });

  test("filters habits by name", async ({ page }) => {
    // Switch to a grouped view first so filter input drives GroupedHabitView
    await page.locator("button", { hasText: "Attitude" }).first().click();
    await page.locator("input[placeholder='Filter...']").fill("knots");

    await expect(page.getByText("knots").first()).toBeVisible();
    await expect(page.getByText("linguaggio")).not.toBeVisible();
  });

  test("filters people by name", async ({ page }) => {
    await page.locator("button", { hasText: "People" }).first().click();
    await page.locator("input[placeholder='Filter...']").fill("Alice");

    await expect(page.getByText("Alice").first()).toBeVisible();
    await expect(page.getByText("Bob")).not.toBeVisible();
  });

  test("switching entity resets filter", async ({ page }) => {
    await page.locator("button", { hasText: "Attitude" }).first().click();
    await page.locator("input[placeholder='Filter...']").fill("knots");

    // Switch to people — filter should clear
    await page.locator("button", { hasText: "People" }).first().click();
    await expect(page.locator("input[placeholder='Filter...']")).toHaveValue(
      "",
    );
  });

  test("people show base place", async ({ page }) => {
    await page.locator("button", { hasText: "People" }).first().click();

    // Alice's base place is "london" → should show London with emoji
    await expect(page.getByText("London").first()).toBeVisible();
  });

  test("paused people show status", async ({ page }) => {
    await page.locator("button", { hasText: "People" }).first().click();

    await expect(page.getByText("paused").first()).toBeVisible();
  });
});
