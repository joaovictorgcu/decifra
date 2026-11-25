import { AREAS, evidenciaSchema, importarEvidenciasSchema, type AreaId } from "@decifra/shared";
import type { FastifyInstance } from "fastify";
import { importarCurriculoIA } from "../ai/tarefas";
import { lerTextoEnviado } from "../lib/arquivo";
import { ErroApp, naoEncontrado, validar } from "../lib/erros";
import { gravarLista } from "../lib/json";
import { evidenciaDto } from "../lib/mapear";
import { exigirCandidato } from "../plugins/auth";

/** Banco de Evidências: o que a pessoa consegue demonstrar. Base de todos os Raio-X. */
export async function rotasEvidencias(app: FastifyInstance) {
  const { db, ia } = app.ctx;

  async function minha(userId: string, id: string) {
    const e = await db.evidence.findFirst({ where: { id, userId } });
    if (!e) throw naoEncontrado("Evidência");
    return e;
  }

  app.get("/evidencias", async (req) => {
    const u = exigirCandidato(req);
    const evs = await db.evidence.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } });
    return { itens: evs.map(evidenciaDto) };
  });

  app.get<{ Params: { id: string } }>("/evidencias/:id", async (req) => {
    const u = exigirCandidato(req);
    return evidenciaDto(await minha(u.id, req.params.id));
  });

  app.post("/evidencias", async (req, reply) => {
    const u = exigirCandidato(req);
    const d = validar(evidenciaSchema, req.body);
    const total = await db.evidence.count({ where: { userId: u.id } });
    if (total >= 300) throw new ErroApp(409, "limite_evidencias", "Você atingiu o limite de 300 evidências.");
    const e = await db.evidence.create({ data: { ...d, competencias: gravarLista(d.competencias), userId: u.id } });
    return reply.status(201).send(evidenciaDto(e));
  });

  app.put<{ Params: { id: string } }>("/evidencias/:id", async (req) => {
    const u = exigirCandidato(req);
    await minha(u.id, req.params.id);
    const d = validar(evidenciaSchema, req.body);
    const e = await db.evidence.update({ where: { id: req.params.id }, data: { ...d, competencias: gravarLista(d.competencias) } });
    return evidenciaDto(e);
  });

  app.delete<{ Params: { id: string } }>("/evidencias/:id", async (req) => {
    const u = exigirCandidato(req);
    await minha(u.id, req.params.id);
    await db.$transaction([
      db.evidence.delete({ where: { id: req.params.id } }),
      // Referências à evidência apagada deixam de valer.
      db.jobRequirement.updateMany({ where: { evId: req.params.id, job: { userId: u.id } }, data: { evId: null } }),
      db.task.updateMany({ where: { evId: req.params.id, userId: u.id }, data: { evId: null } }),
    ]);
    return { ok: true };
  });

  /* ---------- Importação assistida por IA (currículo, LinkedIn em PDF, portfólio) ---------- */

  app.post("/evidencias/importar/analisar", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req) => {
    const u = exigirCandidato(req);
    if (!ia.ativa) throw new ErroApp(503, "ia_desativada", "A importação de currículo usa IA, que não está configurada neste ambiente.");
    const { nome, texto } = await lerTextoEnviado(req);
    const perfil = await db.candidateProfile.findUnique({ where: { userId: u.id } });
    const area = perfil ? (AREAS[perfil.destino as AreaId]?.nome ?? "tecnologia") : "tecnologia";
    const rascunhos = await importarCurriculoIA(ia, u.id, texto, area);
    return { arquivo: nome, rascunhos };
  });

  app.post("/evidencias/importar", async (req, reply) => {
    const u = exigirCandidato(req);
    const d = validar(importarEvidenciasSchema, req.body);
    const total = await db.evidence.count({ where: { userId: u.id } });
    if (total + d.evidencias.length > 300) throw new ErroApp(409, "limite_evidencias", "Você atingiria o limite de 300 evidências.");
    const criadas = await db.$transaction(
      d.evidencias.map((e) => db.evidence.create({ data: { ...e, competencias: gravarLista(e.competencias), userId: u.id, origem: "importacao" } })),
    );
    return reply.status(201).send({ itens: criadas.map(evidenciaDto) });
  });
}
