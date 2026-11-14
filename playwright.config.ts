import { defineConfig } from "@playwright/test";

// Browser: WebKit when installed (matches iOS Chrome); otherwise set PW_CHROMIUM to a Chromium binary
// (e.g. /opt/pw-browsers/chromium-*/chrome-linux64/chrome). Chromium emulates the two device viewports only.
const executablePath = process.env.PW_CHROMIUM || undefined;
const base = { launchOptions: executablePath ? { executablePath, args: ["--no-sandbox"] } : {} };

export default defineConfig({
  testDir: "tests/e2e",
  // Build, apply the migrations to the local D1 (no Cloudflare account needed), then serve the built Worker + SPA.
  webServer: {
    command: "npx vite build && npx wrangler d1 migrations apply DB --local && npx vite preview --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  use: { baseURL: "http://localhost:4173" },
  projects: [
    { name: "iphone", use: { viewport: { width: 390, height: 844 }, hasTouch: true, ...base } },
    { name: "ipad", use: { viewport: { width: 820, height: 1180 }, hasTouch: true, ...base } },
  ],
});
