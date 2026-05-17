import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
  },
  webServer: [
    {
      command: "npm start",
      port: 2567,
      cwd: "../server",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run build && npm run preview -- --port 4173",
      port: 4173,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
