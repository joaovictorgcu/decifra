// Roda a suíte da API contra um PostgreSQL REAL (embutido, sem Docker nem instalação).
// 1) sobe um PostgreSQL temporário; 2) gera o cliente Prisma de PostgreSQL;
// 3) aplica as migrações de prisma/postgres; 4) roda os testes; 5) desliga tudo e
// volta o cliente gerado para SQLite (o banco do desenvolvimento).
// Uso: npm run test:postgres -w @decifra/api
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(raiz, ".pg-teste");
const porta = 54329;
const url = `postgresql://postgres:decifra@localhost:${porta}/decifra_teste`;
const rodar = (cmd, env = {}) => execSync(cmd, { cwd: raiz, stdio: "inherit", env: { ...process.env, ...env } });

rmSync(dir, { recursive: true, force: true });
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "decifra", port: porta, persistent: false, onLog: () => {} });
let codigo = 0;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("decifra_teste");
  console.log(`PostgreSQL de teste em ${url.replace(/:[^:@]+@/, ":***@")}`);
  rodar("npx prisma generate", { DATABASE_URL: url });
  rodar("npx prisma migrate deploy", { DATABASE_URL: url });
  rodar("npx vitest run --config vitest.postgres.config.ts", { TEST_DATABASE_URL: url, DATABASE_URL: url });
} catch (e) {
  codigo = 1;
  console.error(e instanceof Error ? e.message : e);
} finally {
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
  // Volta o cliente gerado para o banco do desenvolvimento (SQLite).
  rodar("npx prisma generate", { DATABASE_URL: "file:./prisma/dev.db" });
  process.exit(codigo);
}
