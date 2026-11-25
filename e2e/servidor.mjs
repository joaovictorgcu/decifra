// Sobe a API com banco descartável servindo o build do frontend, como em produção.
// Usado pelo Playwright (playwright.config.ts > webServer).
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = path.join(raiz, "apps", "api");
for (const f of ["e2e.db", "e2e.db-journal"]) rmSync(path.join(api, "prisma", f), { force: true });

const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: "file:./e2e.db",
  HOST: "127.0.0.1",
  PORT: "3400",
  APP_ORIGIN: "http://localhost:3400",
  WEB_DIST: path.join(raiz, "apps", "web", "dist"),
  AI_PROVIDER: "mock",
  RATE_LIMIT: "off",
  LOG_LEVEL: "warn",
};
execSync("npx prisma migrate deploy", { cwd: api, env, stdio: "inherit" });
const p = spawn("npx", ["tsx", "src/server.ts"], { cwd: api, env, stdio: "inherit", shell: true });
const fim = () => p.kill();
process.on("SIGINT", fim);
process.on("SIGTERM", fim);
process.on("exit", fim);
