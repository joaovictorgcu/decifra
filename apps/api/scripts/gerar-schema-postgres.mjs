// Gera prisma/postgres/schema.prisma a partir de prisma/schema.prisma (fonte única).
// Uso: npm run schema:postgres -w @decifra/api   |   --verificar: falha se estiver desatualizado (CI).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origem = readFileSync(path.join(raiz, "prisma", "schema.prisma"), "utf8");
const destino = path.join(raiz, "prisma", "postgres", "schema.prisma");

let s = origem.replace(/provider = "sqlite"/, 'provider = "postgresql"').replace('output       = "../generated/prisma"', 'output       = "../../generated/prisma"');
if (s === origem) throw new Error("Não encontrei o provider/output esperados em prisma/schema.prisma.");
s = `// ARQUIVO GERADO por scripts/gerar-schema-postgres.mjs. Não edite: altere prisma/schema.prisma.\n${s}`;

if (process.argv.includes("--verificar")) {
  let atual = "";
  try {
    atual = readFileSync(destino, "utf8");
  } catch {
    // Arquivo ainda não existe: conta como desatualizado.
  }
  if (atual.replace(/\r\n/g, "\n") !== s.replace(/\r\n/g, "\n")) {
    console.error("prisma/postgres/schema.prisma está desatualizado. Rode: npm run schema:postgres -w @decifra/api");
    process.exit(1);
  }
  console.log("Schema PostgreSQL em dia.");
} else {
  writeFileSync(destino, s);
  console.log("prisma/postgres/schema.prisma gerado.");
}
