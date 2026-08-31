import { test as base, expect as baseExpect } from "@playwright/test";

const SOCKET = "/tmp/tauri-playwright.sock";

async function loadLib() {
  return await import("@srsholmes/tauri-playwright");
}

export const test = base.extend<{ tauriPage: any }>({
  tauriPage: async ({}, use: (page: any) => Promise<void>) => {
    const { PluginClient, TauriPage } = await loadLib();
    const client = new PluginClient(SOCKET);
    await client.connect();
    const page = new TauriPage(client);
    await use(page);
    client.disconnect();
  },
});

export { baseExpect as expect };
