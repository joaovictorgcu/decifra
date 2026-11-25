import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Configuração do Prisma 7. O banco é escolhido pela DATABASE_URL:
 * - file:... (SQLite) usa prisma/schema.prisma e prisma/migrations;
 * - postgres://... usa o schema gerado em prisma/postgres e suas migrações.
 * Caminhos relativos de SQLite são relativos a esta pasta (apps/api).
 */
const aqui = path.dirname(fileURLToPath(import.meta.url));
// O Prisma 7 não lê .env sozinho; variáveis já definidas no ambiente têm prioridade.
config({ path: path.resolve(aqui, "../../.env"), quiet: true });

// O CLI (migrate) usa DIRECT_URL quando existe: no Supabase, migrações não podem passar pelo pooler de transação (porta 6543).
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const postgres = /^postgres(ql)?:\/\//i.test(url);

export default defineConfig({
  schema: postgres ? "prisma/postgres/schema.prisma" : "prisma/schema.prisma",
  migrations: { path: postgres ? "prisma/postgres/migrations" : "prisma/migrations" },
  datasource: { url },
});
