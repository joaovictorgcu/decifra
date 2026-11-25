import { miniProjetoSchema, tarefaUpdateSchema } from "@decifra/shared";
import type { FastifyInstance } from "fastify";
import { miniDe, radar } from "../domain/raio";
import { dataMais } from "../domain/texto";
import { ErroApp, naoEncontrado, validar } from "../lib/erros";
import { gravarLista } from "../lib/json";
import { tarefaDto } from "../lib/mapear";
import { exigirCandidato } from "../plugins/auth";
import { evidenciasDe, vagasDe } from "./servicos";

/** Plano de Evidências: ações dos Raio-X viram tarefas com prazo; mini-projetos concluídos viram evidências. */
export async function rotasPlano(app: FastifyInstance) {
  const { db } = app.ctx;

  app.get("/tarefas", async (req) => {
    const u = exigirCandidato(req);
    const ts = await db.task.findMany({ where: { userId: u.id }, include: { job: { select: { titulo: true } } }, orderBy: [{ createdAt: "asc" }] });
    return { itens: ts.map(tarefaDto) };
  });

  app.patch<{ Params: { id: string } }>("/tarefas/:id", async (req) => {
    const u = exigirCandidato(req);
    const d = validar(tarefaUpdateSchema, req.body);
    const t = await db.task.findFirst({ where: { id: req.params.id, userId: u.id } });
    if (!t) throw naoEncontrado("Tarefa");

    let evidenciaCriadaId: string | null = null;
    const atualizada = await db.$transaction(async (tx) => {
      const virar = d.status === "feito" && t.tipo === "mini" && !t.virou;
      if (virar) {
        const ev = await tx.evidence.create({
          data: {
            userId: u.id,
            titulo: `Mini-projeto: ${t.comp}`,
            tipo: "Projeto",
            competencias: gravarLista(t.comp ? [t.comp] : []),
            fez: t.titulo,
            origem: "mini",
          },
        });
        evidenciaCriadaId = ev.id;
      }
      return tx.task.update({
        where: { id: t.id },
        data: { status: d.status ?? undefined, prazo: d.prazo ?? undefined, virou: virar ? true : undefined, evId: evidenciaCriadaId ?? undefined },
        include: { job: { select: { titulo: true } } },
      });
    });
    return { tarefa: tarefaDto(atualizada), evidenciaCriadaId };
  });

  app.delete<{ Params: { id: string } }>("/tarefas/:id", async (req) => {
    const u = exigirCandidato(req);
    const r = await db.task.deleteMany({ where: { id: req.params.id, userId: u.id } });
    if (!r.count) throw naoEncontrado("Tarefa");
    return { ok: true };
  });

  app.post("/tarefas/mini", async (req, reply) => {
    const u = exigirCandidato(req);
    const d = validar(miniProjetoSchema, req.body);
    const ja = await db.task.findFirst({ where: { userId: u.id, comp: d.competencia, tipo: "mini" } });
    if (ja) throw new ErroApp(409, "duplicada", "Este mini-projeto já está no seu Plano.");
    const t = await db.task.create({
      data: { userId: u.id, titulo: `${miniDe(d.competencia)}.`, prazo: dataMais(7), tipo: "mini", comp: d.competencia },
      include: { job: { select: { titulo: true } } },
    });
    return reply.status(201).send(tarefaDto(t));
  });

  /** Lacunas técnicas das vagas salvas que ainda não têm mini-projeto no Plano. */
  app.get("/plano/sugestoes", async (req) => {
    const u = exigirCandidato(req);
    const [vagas, evs, ts] = await Promise.all([vagasDe(db, u.id), evidenciasDe(db, u.id), db.task.findMany({ where: { userId: u.id }, select: { comp: true } })]);
    const comTarefa = new Set(ts.map((t) => t.comp).filter(Boolean));
    const itens = radar(vagas, evs)
      .filter((i) => i.situacao === "nao_tem" && i.tipo === "tecnica" && !comTarefa.has(i.curto))
      .map((i) => ({ competencia: i.curto, texto: `${miniDe(i.curto)}.`, vagas: i.vagas }));
    return { itens };
  });
}
