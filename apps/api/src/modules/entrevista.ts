import { historiaSchema, treinoSchema, type Feedback, type Fonte, type Historia } from "@decifra/shared";
import type { InterviewStory } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { descreverMeta, feedbackIA, historiaIA } from "../ai/tarefas";
import { completa } from "../domain/raio";
import { feedbackPorRegras, historiaPorRegras } from "../domain/regras";
import { naoEncontrado, validar } from "../lib/erros";
import { evidenciaDom } from "../lib/mapear";
import { exigirCandidato, exigirPlus } from "../plugins/auth";

/** Preparação para Entrevista (Plus): histórias STAR a partir de evidências e treino com feedback. */
export async function rotasEntrevista(app: FastifyInstance) {
  const { db, ia } = app.ctx;
  const limiteIA = { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } };

  const dto = (h: InterviewStory): Historia => ({
    id: h.id,
    pergunta: h.pergunta,
    evidencia: h.evidencia,
    situacao: h.situacao,
    tarefa: h.tarefa,
    acao: h.acao,
    resultado: h.resultado,
    fonte: h.fonte as Fonte,
    ia: h.iaDescricao,
  });

  app.get("/historias", async (req) => {
    const u = exigirCandidato(req);
    exigirPlus(u, "A Preparação para Entrevista");
    const hs = await db.interviewStory.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } });
    return { itens: hs.map(dto) };
  });

  app.post("/historias", limiteIA, async (req, reply) => {
    const u = exigirCandidato(req);
    exigirPlus(u, "A Preparação para Entrevista");
    const d = validar(historiaSchema, req.body);
    const row = await db.evidence.findFirst({ where: { id: d.evidenciaId, userId: u.id } });
    if (!row) throw naoEncontrado("Evidência");
    const ev = evidenciaDom(row);
    // Só chama a IA quando a evidência está completa; senão, o modelo teria de inventar.
    const viaIA = completa(ev) ? await historiaIA(ia, u.id, d.pergunta, ev) : null;
    const h = viaIA?.valor ?? historiaPorRegras(ev);
    const salvo = await db.interviewStory.create({
      data: { userId: u.id, pergunta: d.pergunta, evidenceId: ev.id, evidencia: ev.titulo, ...h, fonte: viaIA ? "ia" : "regras", iaDescricao: viaIA ? descreverMeta(viaIA.meta) : null },
    });
    return reply.status(201).send(dto(salvo));
  });

  app.delete<{ Params: { id: string } }>("/historias/:id", async (req) => {
    const u = exigirCandidato(req);
    const r = await db.interviewStory.deleteMany({ where: { id: req.params.id, userId: u.id } });
    if (!r.count) throw naoEncontrado("História");
    return { ok: true };
  });

  app.post("/entrevista/feedback", limiteIA, async (req): Promise<Feedback> => {
    const u = exigirCandidato(req);
    exigirPlus(u, "A Preparação para Entrevista");
    const d = validar(treinoSchema, req.body);
    const viaIA = await feedbackIA(ia, u.id, d.pergunta, d.resposta);
    return viaIA ? { ...viaIA.valor, fonte: "ia", ia: descreverMeta(viaIA.meta) } : { ...feedbackPorRegras(d.resposta), fonte: "regras", ia: null };
  });
}
