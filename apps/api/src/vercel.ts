import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { criarApp } from "./app";
import { criarContexto } from "./contexto";

/**
 * Entrada da API como função serverless da Vercel (api/index.mjs reexporta
 * este handler). O app Fastify é criado uma vez por instância e reaproveitado
 * entre requisições; as rotas continuam em /api/*.
 */
let pronto: Promise<FastifyInstance> | null = null;

function obterApp(): Promise<FastifyInstance> {
  pronto ??= (async () => {
    const app = await criarApp(criarContexto());
    await app.ready();
    return app;
  })().catch((e) => {
    pronto = null; // permite nova tentativa na próxima requisição
    throw e;
  });
  return pronto;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await obterApp();
    app.server.emit("request", req, res);
  } catch (e) {
    console.error("Falha ao iniciar a API", e instanceof Error ? e.message : e);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ erro: "O servidor não conseguiu iniciar. Verifique as variáveis de ambiente.", codigo: "inicializacao" }));
  }
}
