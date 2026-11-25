import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de interface ponta a ponta. A API sobe com banco descartável e serve
 * o build do frontend (rode `npm run build -w @decifra/web` antes).
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3400",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node e2e/servidor.mjs",
    url: "http://localhost:3400/api/saude",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
