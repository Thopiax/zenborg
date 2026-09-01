import { expect, test } from "@playwright/test";
import { seedGarden } from "./support/seed";

/**
 * Habit provenance in the moment edit form:
 *
 *   1. A moment linked to a habit shows ↻ in the form header area.
 *   2. When the moment name differs from the habit name, the habit name appears.
 *   3. When names match, only ↻ appears (no redundant name).
 *   4. A standalone moment (no habitId) shows a "link habit" affordance.
 *   5. The X button unlinks the habit.
 */

test.beforeEach(async ({ page }) => {
  await seedGarden(page);
  await page.goto("/cultivate");
});

test.describe("habit provenance in edit form", () => {
  test("shows ↻ with habit name when names differ", async ({ page }) => {
    // "hill sprints" is linked to the "long walk" habit — names differ
    const card = page.locator('[data-moment-id="e2e-renamed-moment-001"]');
    await expect(card).toBeVisible();
    await card.click();

    // The dialog should open
    await expect(page.getByText("Edit moment")).toBeVisible();

    // The provenance line should show ↻ and the habit name
    const provenance = page.locator("text=↻").first();
    await expect(provenance).toBeVisible();

    // "long walk" should appear near ↻ (habit name differs from moment name)
    const provenanceContainer = provenance.locator("..");
    await expect(provenanceContainer).toContainText("long walk");
  });

  test("shows ↻ without habit name when names match", async ({ page }) => {
    // "linguaggio" moment linked to "linguaggio" habit — same name
    const card = page.locator(
      '[data-moment-id="ef4ceabb-2c09-544a-b77c-e186680e180d"]',
    );
    await expect(card).toBeVisible();
    await card.click();

    await expect(page.getByText("Edit moment")).toBeVisible();

    const provenance = page.locator("text=↻").first();
    await expect(provenance).toBeVisible();

    // The container should NOT contain the habit name (it matches the moment name)
    const provenanceContainer = provenance.locator("..");
    const childTexts = await provenanceContainer.allInnerTexts();
    const combined = childTexts.join(" ");
    expect(combined).not.toContain("linguaggio");
  });

  test("shows link-habit button for standalone moments", async ({ page }) => {
    // "free sketch" has no habitId
    const card = page.locator('[data-moment-id="e2e-standalone-moment-001"]');
    await expect(card).toBeVisible();
    await card.click();

    await expect(page.getByText("Edit moment")).toBeVisible();

    // Should show "link habit" affordance instead of ↻ provenance
    await expect(page.locator("text=link habit")).toBeVisible();
  });

  test("X button unlinks the habit", async ({ page }) => {
    const card = page.locator('[data-moment-id="e2e-renamed-moment-001"]');
    await expect(card).toBeVisible();
    await card.click();

    await expect(page.getByText("Edit moment")).toBeVisible();

    const provenance = page.locator("text=↻").first();
    await expect(provenance).toBeVisible();

    // The X button is opacity-0 until hover — force-click it
    const container = provenance.locator("..");
    const unlinkButton = container.locator("button");
    await unlinkButton.click({ force: true });

    // After unlinking, "link habit" should appear
    await expect(page.locator("text=link habit")).toBeVisible();
  });
});
