import { AREAS, traducaoParaEvidenciaSchema, traducaoSchema, type AreaId, type Fonte } from "@decifra/shared";
import type { FastifyInstance } from "fastify";
import { traduzirIA } from "../ai/tarefas";
import { traduzirPorRegras } from "../domain/regras";
import { ErroApp, validar } from "../lib/erros";
import { gravarLista } from "../lib/json";
import { evidenciaDto } from "../lib/mapear";
import { exigirCandidato } from "../plugins/auth";

/** Tradutor de Experiência: funções da carreira anterior viram competências da nova área. */
export async function rotasTradutor(app: FastifyInstance) {
  const { db, ia } = app.ctx;

  app.post("/tradutor", { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } }, async (req) => {
    const u = exigirCandidato(req);
    const d = validar(traducaoSchema, req.body);
    const perfil = await db.candidateProfile.findUnique({ where: { userId: u.id } });
    if (!perfil) throw new ErroApp(409, "sem_diagnostico", "Responda ao diagnóstico para indicar sua área de destino.");
    const area = AREAS[perfil.destino as AreaId]?.nome ?? "tecnologia";
    const viaIA = await traduzirIA(ia, u.id, d.entrada, area);
    const fonte: Fonte = viaIA ? "ia" : "regras";
    return { itens: viaIA ?? traduzirPorRegras(d.entrada), fonte };
  });

  /** Salva uma tradução como evidência "Caso da carreira anterior", para a pessoa completar. */
  app.post("/tradutor/evidencia", async (req, reply) => {
    const u = exigirCandidato(req);
    const d = validar(traducaoParaEvidenciaSchema, req.body);
    const e = await db.evidence.create({
      data: {
        userId: u.id,
        titulo: d.entrada.slice(0, 140),
        tipo: "Caso da carreira anterior",
        competencias: gravarLista(d.competencias),
        fez: d.entrada,
        origem: "tradutor",
      },
    });
    return reply.status(201).send(evidenciaDto(e));
  });
}
