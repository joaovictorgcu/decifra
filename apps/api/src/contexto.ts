import type { Contexto } from "./app";
import { carregarConfigIA } from "./ai/config";
import { ServicoIA, criarProvedores } from "./ai/servico";
import { carregarEnv } from "./config/env";
import { criarDb } from "./lib/db";
import { definirFuso, inicioDoDia } from "./lib/datas";

/** Monta as dependências da aplicação a partir do ambiente. */
export function criarContexto(fonte: NodeJS.ProcessEnv = process.env): Contexto {
  const env = carregarEnv(fonte);
  definirFuso(env.APP_TZ);
  const cfgIA = carregarConfigIA(fonte, env.isProd, env.APP_ORIGIN);
  const db = criarDb();
  const ia = new ServicoIA(cfgIA, criarProvedores(cfgIA), {
    registrar: async (r) => {
      await db.aiInteraction.create({ data: r });
    },
    usoHoje: async (userId) => {
      const base = { userId, createdAt: { gte: inicioDoDia() }, status: { not: "cancelado" } };
      const [total, complexas] = await Promise.all([
        db.aiInteraction.count({ where: base }),
        db.aiInteraction.count({ where: { ...base, nivel: "complexa", status: "ok" } }),
      ]);
      return { total, complexas };
    },
  });
  return { env, db, ia };
}
