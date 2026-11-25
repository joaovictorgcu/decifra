import { candidaturaSchema, candidaturaUpdateSchema, type Candidatura, type EtapaCandidatura } from "@decifra/shared";
import type { FastifyInstance } from "fastify";
import { conflito, naoEncontrado, validar } from "../lib/erros";
import { exigirCandidato } from "../plugins/auth";

/** Quadro de candidaturas por etapa, cada uma ligada ao Raio-X da vaga. */
export async function rotasCandidaturas(app: FastifyInstance) {
  const { db } = app.ctx;

  const dto = (c: { id: string; jobId: string; etapa: string; updatedAt: Date; job: { titulo: string } }): Candidatura => ({
    id: c.id,
    vagaId: c.jobId,
    vagaTitulo: c.job.titulo,
    etapa: c.etapa as EtapaCandidatura,
    atualizadaEm: c.updatedAt.toISOString(),
  });

  app.get("/candidaturas", async (req) => {
    const u = exigirCandidato(req);
    const cs = await db.application.findMany({ where: { userId: u.id }, include: { job: { select: { titulo: true } } }, orderBy: { updatedAt: "desc" } });
    return { itens: cs.map(dto) };
  });

  app.post("/candidaturas", async (req, reply) => {
    const u = exigirCandidato(req);
    const d = validar(candidaturaSchema, req.body);
    const job = await db.job.findFirst({ where: { id: d.vagaId, userId: u.id }, include: { candidatura: true } });
    if (!job) throw naoEncontrado("Vaga");
    if (job.candidatura) throw conflito("A candidatura para esta vaga já está registrada.");
    const c = await db.application.create({ data: { userId: u.id, jobId: job.id }, include: { job: { select: { titulo: true } } } });
    return reply.status(201).send(dto(c));
  });

  app.patch<{ Params: { id: string } }>("/candidaturas/:id", async (req) => {
    const u = exigirCandidato(req);
    const d = validar(candidaturaUpdateSchema, req.body);
    const c = await db.application.findFirst({ where: { id: req.params.id, userId: u.id } });
    if (!c) throw naoEncontrado("Candidatura");
    const nova = await db.application.update({ where: { id: c.id }, data: { etapa: d.etapa }, include: { job: { select: { titulo: true } } } });
    return dto(nova);
  });

  app.delete<{ Params: { id: string } }>("/candidaturas/:id", async (req) => {
    const u = exigirCandidato(req);
    const r = await db.application.deleteMany({ where: { id: req.params.id, userId: u.id } });
    if (!r.count) throw naoEncontrado("Candidatura");
    return { ok: true };
  });
}
