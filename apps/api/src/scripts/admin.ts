/**
 * Tarefas administrativas pela linha de comando.
 *   npm run admin -- plano <email> <gratis|plus>   altera o plano de um candidato
 *   npm run admin -- uso-ia [dias]                  resumo de uso da IA (padrão: 7 dias)
 *   npm run admin -- limpar-sessoes                 remove sessões expiradas
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const [cmd, ...args] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case "plano": {
      const [email, plano] = args;
      if (!email || (plano !== "gratis" && plano !== "plus")) throw new Error("Uso: plano <email> <gratis|plus>");
      const u = await db.user.update({ where: { email: email.toLowerCase() }, data: { plano } });
      console.log(`Plano de ${u.email} alterado para ${u.plano}.`);
      break;
    }
    case "uso-ia": {
      const dias = Number(args[0] ?? 7);
      const desde = new Date(Date.now() - dias * 864e5);
      const linhas = await db.aiInteraction.groupBy({
        by: ["tarefa", "modelo", "status"],
        where: { createdAt: { gte: desde } },
        _count: { _all: true },
        _sum: { tokensEntrada: true, tokensSaida: true },
        _avg: { latenciaMs: true },
      });
      console.table(
        linhas.map((l) => ({
          tarefa: l.tarefa,
          modelo: l.modelo,
          status: l.status,
          chamadas: l._count._all,
          tokensEntrada: l._sum.tokensEntrada ?? 0,
          tokensSaida: l._sum.tokensSaida ?? 0,
          latenciaMediaMs: Math.round(l._avg.latenciaMs ?? 0),
        })),
      );
      break;
    }
    case "limpar-sessoes": {
      const r = await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      console.log(`${r.count} sessões expiradas removidas.`);
      break;
    }
    default:
      console.log("Comandos: plano <email> <gratis|plus> | uso-ia [dias] | limpar-sessoes");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
