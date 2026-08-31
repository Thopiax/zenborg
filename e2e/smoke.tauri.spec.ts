import { test, expect } from "./support/tauri";

test.describe("tauri smoke", () => {
  test("app loads and shows the plant view", async ({ tauriPage }) => {
    const title = await tauriPage.title();
    expect(title).toBe("Zenborg");
  });

  test("can take a native screenshot", async ({ tauriPage }) => {
    const buf = await tauriPage.screenshot();
    expect(buf.length).toBeGreaterThan(0);
  });

  test("can read page content", async ({ tauriPage }) => {
    const html = await tauriPage.content();
    expect(html).toContain("<html");
  });
});
