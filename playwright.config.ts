import { defineConfig } from "@playwright/test";

// Browser: WebKit when installed (matches iOS Chrome); otherwise set PW_CHROMIUM to a Chromium binary
// (e.g. /opt/pw-browsers/chromium-*/chrome-linux64/chrome). Chromium emulates the two device viewports only.
const executablePath = process.env.PW_CHROMIUM || undefined;
const base = { launchOptions: executablePath ? { executablePath, args: ["--no-sandbox"] } : {} };

export default defineConfig({
  testDir: "tests/e2e",
  webServer: { command: "npx vite preview --port 4173", url: "http://localhost:4173", reuseExistingServer: true },
  use: { baseURL: "http://localhost:4173" },
  projects: [
    { name: "iphone", use: { viewport: { width: 390, height: 844 }, hasTouch: true, ...base } },
    { name: "ipad", use: { viewport: { width: 820, height: 1180 }, hasTouch: true, ...base } },
  ],
});
