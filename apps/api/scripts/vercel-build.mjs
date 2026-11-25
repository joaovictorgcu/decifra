// Build da API na Vercel: gera o cliente Prisma (PostgreSQL), aplica as migrações
// SÓ em produção (previews nunca alteram o banco) e empacota a função.
import { execSync } from "node:child_process";

const rodar = (cmd) => execSync(cmd, { stdio: "inherit" });
if (!/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL ?? "")) {
  console.error("DATABASE_URL precisa ser uma URL de PostgreSQL (Supabase). Configure nas variáveis de ambiente da Vercel.");
  process.exit(1);
}
rodar("npx prisma generate");
if (process.env.VERCEL_ENV === "production") rodar("npx prisma migrate deploy");
else console.log(`Ambiente ${process.env.VERCEL_ENV ?? "local"}: migrações não aplicadas (só em produção).`);
rodar("npx tsup");
