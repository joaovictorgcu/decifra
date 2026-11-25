import { entregaSchema, type Desafio, type Triagem } from "@decifra/shared";
import type { FastifyInstance } from "fastify";
import { hojeISO } from "../domain/texto";
import { conflito, ErroApp, naoEncontrado, validar } from "../lib/erros";
import { gravarLista } from "../lib/json";
import { exigirCandidato } from "../plugins/auth";

/** Desafios práticos do lado do candidato: a entrega vira evidência e vai para a triagem da empresa. */
export async function rotasDesafios(app: FastifyInstance) {
  const { db } = app.ctx;

  app.get("/desafios", async (req) => {
    const u = exigirCandidato(req);
    const ds = await db.challenge.findMany({
      where: { OR: [{ prazo: { gte: hojeISO() } }, { entregas: { some: { candidateId: u.id } } }] },
      include: { company: { select: { nome: true } }, entregas: { where: { candidateId: u.id } } },
      orderBy: { prazo: "asc" },
      take: 50,
    });
    const itens: Desafio[] = ds.map((d) => ({
      id: d.id,
      empresa: d.company.nome,
      titulo: d.titulo,
      vaga: d.vaga,
      competencia: d.competencia,
      descricao: d.descricao,
      prazo: d.prazo,
      minhaEntrega: d.entregas[0] ? { link: d.entregas[0].link, triagem: d.entregas[0].triagem as Triagem } : null,
    }));
    return { itens };
  });

  app.post<{ Params: { id: string } }>("/desafios/:id/entregas", async (req, reply) => {
    const u = exigirCandidato(req);
    const d = validar(entregaSchema, req.body);
    const desafio = await db.challenge.findUnique({ where: { id: req.params.id } });
    if (!desafio) throw naoEncontrado("Desafio");
    if (desafio.prazo < hojeISO()) throw new ErroApp(409, "prazo", "O prazo deste desafio já terminou.");
    const ja = await db.submission.findUnique({ where: { challengeId_candidateId: { challengeId: desafio.id, candidateId: u.id } } });
    if (ja) throw conflito("Você já enviou uma entrega para este desafio.");
    const ev = await db.$transaction(async (tx) => {
      await tx.submission.create({ data: { challengeId: desafio.id, candidateId: u.id, link: d.link } });
      return tx.evidence.create({
        data: {
          userId: u.id,
          titulo: `Desafio: ${desafio.titulo}`,
          tipo: "Projeto",
          link: d.link,
          competencias: gravarLista(desafio.competencia ? [desafio.competencia] : []),
          problema: desafio.descricao.slice(0, 2000),
          origem: "desafio",
        },
      });
    });
    return reply.status(201).send({ evidenciaId: ev.id });
  });
}
