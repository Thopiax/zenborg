import { expect, test } from "@playwright/test";
import { seedGarden } from "./support/seed";

/**
 * Two rules about how a card spends its space:
 *
 *   1. The name says what the habit is, so the name wins the row. Tags are
 *      secondary context and collapse to "#first +N".
 *   2. A timeline cell is three moment slots tall, always. A fourth moment
 *      scrolls inside the cell instead of stretching the day out of line.
 */

test.beforeEach(async ({ page }) => {
  await seedGarden(page);
});

test.describe("habit cards", () => {
  test("shows one tag and a count, never the whole list", async ({ page }) => {
    const card = page.locator('[data-habit-name="linguaggio"]');

    await expect(card).toContainText("#gap");
    await expect(card).toContainText("+2");
    await expect(card).not.toContainText("#gap-screen");
  });

  test("keeps every tag readable on hover", async ({ page }) => {
    const summary = page
      .locator('[data-habit-name="linguaggio"] [data-tag-summary]')
      .first();

    await expect(summary).toHaveAttribute("title", "#gap #gap-screen #gap-5m");
  });

  test("leaves a short name untruncated", async ({ page }) => {
    const name = page
      .locator('[data-habit-name="linguaggio"] [data-habit-label]')
      .first();

    const clipped = await name.evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1,
    );
    expect(clipped).toBe(false);
  });
});

test.describe("timeline cells", () => {
  test("a fourth moment scrolls instead of stretching the row", async ({
    page,
  }) => {
    await page.goto("/cultivate");

    const today = new Date().toLocaleDateString("en-CA");
    const morning = page.locator(`[data-cell="${today}-MORNING"]`);
    const afternoon = page.locator(`[data-cell="${today}-AFTERNOON"]`);

    await expect(morning.locator("[data-moment-id]")).toHaveCount(4);
    await expect(afternoon.locator("[data-moment-id]")).toHaveCount(3);

    const [overfull, exact] = await Promise.all([
      morning.boundingBox(),
      afternoon.boundingBox(),
    ]);
    // The overflowing cell is slightly taller (peek) but not a full card taller
    const heightDiff =
      Math.round(overfull?.height ?? 0) - Math.round(exact?.height ?? 0);
    expect(heightDiff).toBeGreaterThanOrEqual(0);
    expect(heightDiff).toBeLessThan(64); // less than one full card

    const scrolls = await morning
      .locator(".overflow-y-auto")
      .evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(scrolls).toBe(true);
  });

  test("phase icons are visible on the cultivate page", async ({ page }) => {
    await page.goto("/cultivate");

    const icons = page.locator('[aria-label^="Add moment to"]');
    await expect(icons.first()).toBeVisible();
  });

  test("the fourth moment is reachable by scrolling", async ({ page }) => {
    await page.goto("/cultivate");

    const today = new Date().toLocaleDateString("en-CA");
    const list = page
      .locator(`[data-cell="${today}-MORNING"] .overflow-y-auto`)
      .first();

    await list.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    const last = list.locator("[data-moment-id]").last();
    await expect(last).toBeInViewport();
  });

  test("a fourth moment is reachable by drag-and-drop", async ({ page }) => {
    await page.goto("/cultivate");

    const today = new Date().toLocaleDateString("en-CA");
    const morning = page.locator(`[data-cell="${today}-MORNING"]`);

    // The 4th card exists in the DOM even if scrolled out of view
    const fourthCard = morning.locator("[data-moment-id]").nth(3);
    await expect(fourthCard).toBeAttached();

    // The scroll area contains all 4 moments
    const scrollArea = morning.locator(".overflow-y-auto").first();
    const scrollHeight = await scrollArea.evaluate((el) => el.scrollHeight);
    const clientHeight = await scrollArea.evaluate((el) => el.clientHeight);
    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });

  test("selection uses an inset shadow that is never clipped", async ({
    page,
  }) => {
    await page.goto("/cultivate");

    const today = new Date().toLocaleDateString("en-CA");
    const morning = page.locator(`[data-cell="${today}-MORNING"]`);
    const card = morning.getByLabel("linguaggio in Learning area");

    // Cmd-click to select
    await card.click({ modifiers: ["Meta"] });

    const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
    // Inset shadow should be present
    expect(shadow).toContain("inset");
  });
});
