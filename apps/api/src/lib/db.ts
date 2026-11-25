import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

export type Db = PrismaClient;

export function ehPostgres(url: string): boolean {
  return /^postgres(ql)?:\/\//i.test(url);
}

/**
 * Cria o cliente do Prisma 7 com o adaptador do banco da DATABASE_URL:
 * PostgreSQL (produção/Docker) ou SQLite (desenvolvimento). O cliente gerado
 * precisa ser do mesmo banco (prisma generate usa o schema escolhido em prisma.config.ts).
 */
export function criarDb(url = process.env.DATABASE_URL ?? "file:./prisma/dev.db"): PrismaClient {
  const adapter = ehPostgres(url)
    ? new PrismaPg({ connectionString: url })
    : // Datas em milissegundos Unix: o mesmo formato que o Prisma 6 gravava no SQLite.
      new PrismaBetterSqlite3({ url }, { timestampFormat: "unixepoch-ms" });
  return new PrismaClient({ adapter });
}
