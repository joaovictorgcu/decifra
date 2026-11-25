import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

export type Db = PrismaClient;

export function ehPostgres(url: string): boolean {
  return /^postgres(ql)?:\/\//i.test(url);
}

/**
 * Opções do pool do node-postgres a partir da URL e do ambiente.
 * - Remove da URL parâmetros que são do Prisma/Supabase e não do `pg`
 *   (`pgbouncer`, `sslmode`, `connection_limit`): o SSL é configurado aqui.
 * - SSL (PG_SSL): "require" (padrão fora do localhost) criptografa sem validar a
 *   cadeia, como o `sslmode=require` do Postgres; "verify" valida (com PG_SSL_CA,
 *   se a CA não for pública); "off" desliga.
 * - Pool (PG_POOL_MAX): 1 conexão por instância em serverless (Vercel), 10 nos demais.
 */
export function opcoesPostgres(urlOriginal: string, env: NodeJS.ProcessEnv = process.env) {
  const u = new URL(urlOriginal);
  const sslDaUrl = u.searchParams.get("sslmode");
  for (const p of ["pgbouncer", "sslmode", "connection_limit", "sslaccept", "workaround"]) u.searchParams.delete(p);
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  const modo = (env.PG_SSL ?? (sslDaUrl === "disable" ? "off" : local ? "off" : "require")).toLowerCase();
  const ssl =
    modo === "off" ? false : modo === "verify" ? { rejectUnauthorized: true, ...(env.PG_SSL_CA ? { ca: env.PG_SSL_CA.replace(/\\n/g, "\n") } : {}) } : { rejectUnauthorized: false };
  const max = Number(env.PG_POOL_MAX ?? (env.VERCEL === "1" ? 1 : 10));
  return {
    connectionString: u.toString(),
    ssl,
    max: Number.isFinite(max) && max > 0 ? max : 1,
    // Valores do Prisma 6 (o padrão do v7 é esperar para sempre por uma conexão).
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 60_000,
  };
}

/**
 * Cria o cliente do Prisma 7 com o adaptador do banco da DATABASE_URL:
 * PostgreSQL (produção: Supabase, Docker) ou SQLite (desenvolvimento). O cliente
 * gerado precisa ser do mesmo banco (prisma generate usa o schema escolhido em prisma.config.ts).
 */
export function criarDb(url = process.env.DATABASE_URL ?? "file:./prisma/dev.db"): PrismaClient {
  const adapter = ehPostgres(url)
    ? new PrismaPg(opcoesPostgres(url))
    : // Datas em milissegundos Unix: o mesmo formato que o Prisma 6 gravava no SQLite.
      new PrismaBetterSqlite3({ url }, { timestampFormat: "unixepoch-ms" });
  return new PrismaClient({ adapter });
}
