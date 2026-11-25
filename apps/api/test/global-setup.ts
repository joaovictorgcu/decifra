import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Cria um banco SQLite descartável e aplica as migrações antes da suíte. */
export default function setup() {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const arquivo = path.join(raiz, "prisma", "test-suite.db");
  for (const f of [arquivo, `${arquivo}-journal`]) rmSync(f, { force: true });
  process.env.DATABASE_URL = "file:./prisma/test-suite.db";
  execSync("npx prisma migrate deploy", { cwd: raiz, env: { ...process.env }, stdio: "pipe" });
}
