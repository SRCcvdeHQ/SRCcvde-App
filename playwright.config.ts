import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  use: { baseURL: "http://127.0.0.1:4174", serviceWorkers: "block" },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
