import type { Contexto } from "./app";
import { ServicoIA, criarProvedor, modelosPorTarefaDoAmbiente } from "./ai/servico";
import { carregarEnv } from "./config/env";
import { criarDb } from "./lib/db";

/** Monta as dependências da aplicação a partir do ambiente. */
export function criarContexto(): Contexto {
  const env = carregarEnv();
  const db = criarDb();
  const ia = new ServicoIA(
    criarProvedor(env),
    env,
    async (r) => {
      await db.aiInteraction.create({ data: r });
    },
    modelosPorTarefaDoAmbiente(),
    async (userId) => {
      const desde = new Date();
      desde.setHours(0, 0, 0, 0);
      const usados = await db.aiInteraction.count({ where: { userId, createdAt: { gte: desde } } });
      return usados < env.AI_LIMITE_DIARIO;
    },
  );
  return { env, db, ia };
}
