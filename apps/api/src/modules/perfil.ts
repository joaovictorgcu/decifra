import { diagnosticoSchema, perfilPublicoSchema } from "@decifra/shared";
import type { FastifyInstance } from "fastify";
import { classificarEtapa } from "../domain/regras";
import { ErroApp, validar } from "../lib/erros";
import { gravarLista } from "../lib/json";
import { novoSlug } from "../lib/tokens";
import { exigirCandidato } from "../plugins/auth";
import { montarSessao } from "./servicos";

/** Diagnóstico de 6 perguntas (define a etapa da transição) e visibilidade do Perfil de Evidências. */
export async function rotasPerfil(app: FastifyInstance) {
  const { db } = app.ctx;

  app.put("/perfil/diagnostico", async (req) => {
    const u = exigirCandidato(req);
    const d = validar(diagnosticoSchema, req.body);
    const etapa = classificarEtapa(d);
    const dados = {
      destino: d.destino,
      origem: d.origem,
      situacao: d.situacao,
      tempo: d.tempo,
      candidatou: d.candidatou,
      atrapalha: gravarLista(d.atrapalha),
      etapa,
    };
    await db.candidateProfile.upsert({
      where: { userId: u.id },
      create: { userId: u.id, ...dados, slug: novoSlug(u.nome) },
      update: dados,
    });
    return montarSessao(app.ctx, u);
  });

  app.patch("/perfil/publico", async (req) => {
    const u = exigirCandidato(req);
    const d = validar(perfilPublicoSchema, req.body);
    const p = await db.candidateProfile.findUnique({ where: { userId: u.id } });
    if (!p) throw new ErroApp(409, "sem_diagnostico", "Responda ao diagnóstico antes de publicar seu perfil.");
    await db.candidateProfile.update({ where: { userId: u.id }, data: { publico: d.publico } });
    return montarSessao(app.ctx, u);
  });
}
