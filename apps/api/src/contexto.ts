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
  );
  return { env, db, ia };
}
