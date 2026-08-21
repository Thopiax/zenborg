import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

const FIXTURE = path.join(__dirname, "..", "fixtures", "garden.json");

/**
 * The fixture's moments are pinned to a single day so the file stays readable.
 * The garden always renders "today", so the day is rewritten at seed time.
 */
function fixtureForToday(): string {
  const garden = JSON.parse(readFileSync(FIXTURE, "utf8"));
  const today = new Date().toLocaleDateString("en-CA"); // ISO, local calendar

  for (const moment of Object.values<Record<string, unknown>>(
    garden.data.moments,
  )) {
    if (moment.day) moment.day = today;
  }

  return JSON.stringify(garden);
}

/**
 * Seeds a synthetic garden through the app's own import path — the same route
 * a person takes through Settings, so the test exercises real validation
 * rather than a hand-written IndexedDB payload.
 *
 * The data is invented. No real garden ever reaches a test fixture.
 */
export async function seedGarden(page: Page): Promise<void> {
  await page.goto("/plant");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.locator('button:has-text("Data Management")').click();

  const chooser = page.waitForEvent("filechooser");
  await page.locator('button:has-text("Import (Merge)")').click();
  await (await chooser).setFiles({
    name: "garden.json",
    mimeType: "application/json",
    buffer: Buffer.from(fixtureForToday()),
  });

  // The drawer reloads the page once the import lands.
  await page.waitForURL("**/plant");
  await page.getByText("Learning").first().waitFor();
}
