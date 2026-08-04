import { defineConfig } from "@playwright/test";

const port = Number(process.env.ARS_PLAYWRIGHT_PORT ?? 4175);
const baseURL = `http://127.0.0.1:${port}`;
const reuseExistingServer = process.env.ARS_PLAYWRIGHT_REUSE_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: { baseURL, headless: true },
  webServer: [
    {
      command: "npm run dev:api",
      url: "http://127.0.0.1:4174/api/health",
      reuseExistingServer,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
      url: baseURL,
      reuseExistingServer,
      timeout: 30_000,
    },
  ],
});