import type { FastifyInstance } from "fastify";
import { lerTextoEnviado } from "../lib/arquivo";
import { exigirLogin } from "../plugins/auth";

/** Extrai texto de um PDF ou TXT (ex.: descrição de vaga salva em arquivo). Nada é armazenado. */
export async function rotasArquivos(app: FastifyInstance) {
  app.post("/arquivos/texto", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req) => {
    exigirLogin(req);
    return lerTextoEnviado(req);
  });
}
