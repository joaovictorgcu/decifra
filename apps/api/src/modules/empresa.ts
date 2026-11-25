import {
  AREAS,
  desafioSchema,
  triagemSchema,
  vagaEmpresaAnaliseSchema,
  vagaEmpresaPublicarSchema,
  type AreaId,
  type CandidatoBusca,
  type Desafio,
  type Triagem,
} from "@decifra/shared";
import type { FastifyInstance } from "fastify";
import { descreverMeta, extrairRequisitosIA } from "../ai/tarefas";
import { extrairRequisitos } from "../domain/extrair";
import { grau } from "../domain/raio";
import { norm } from "../domain/texto";
import { ErroApp, naoEncontrado, validar } from "../lib/erros";
import { evidenciaDom, vagaEmpresaDto } from "../lib/mapear";
import { exigirEmpresa } from "../plugins/auth";

/** Área da empresa: Vagas Decifradas, Desafios práticos e busca por competências comprovadas. */
export async function rotasEmpresa(app: FastifyInstance) {
  const { db, ia } = app.ctx;

  /* ---------- Vagas Decifradas ---------- */

  app.post("/empresa/vagas/analisar", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const u = exigirEmpresa(req);
    const d = validar(vagaEmpresaAnaliseSchema, req.body);
    const viaIA = await extrairRequisitosIA(ia, u.id, d.texto, []);
    const reqs = viaIA?.valor ?? extrairRequisitos(d.texto);
    if (!reqs.length) throw new ErroApp(422, "sem_requisitos", "Não encontrei requisitos nesta descrição.", "texto");
    return { titulo: d.titulo, texto: d.texto, fonte: viaIA ? "ia" : "regras", ia: viaIA ? descreverMeta(viaIA.meta) : null, requisitos: reqs };
  });

  app.post("/empresa/vagas", async (req, reply) => {
    const u = exigirEmpresa(req);
    const d = validar(vagaEmpresaPublicarSchema, req.body);
    // Selo "Aberta a transição de carreira": nenhuma exigência formal obrigatória ficou fechada ou sem decisão.
    const selo = !d.requisitos.some((r) => r.tipo === "formal" && r.obrig && r.aceita !== "sim");
    const v = await db.companyJob.create({
      data: {
        companyId: u.id,
        titulo: d.titulo,
        texto: d.texto,
        selo,
        requisitos: {
          create: d.requisitos.map((r, i) => ({
            ordem: i,
            requisito: r.requisito,
            curto: r.curto,
            tipo: r.tipo,
            kind: r.tipo === "formal" ? (r.kind ?? "tempo") : null,
            obrig: r.obrig,
            aceita: r.tipo === "formal" ? r.aceita : "",
          })),
        },
      },
      include: { requisitos: true, company: { select: { nome: true } } },
    });
    return reply.status(201).send(vagaEmpresaDto(v));
  });

  app.get("/empresa/vagas", async (req) => {
    const u = exigirEmpresa(req);
    const vs = await db.companyJob.findMany({
      where: { companyId: u.id },
      include: { requisitos: true, company: { select: { nome: true } }, _count: { select: { vagasCand: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { itens: vs.map((v) => ({ ...vagaEmpresaDto(v), publicada: v.publicada, analises: v._count.vagasCand })) };
  });

  app.patch<{ Params: { id: string } }>("/empresa/vagas/:id", async (req) => {
    const u = exigirEmpresa(req);
    const publicada = (req.body as { publicada?: unknown } | undefined)?.publicada;
    if (typeof publicada !== "boolean") throw new ErroApp(400, "validacao", "Informe se a vaga fica publicada.");
    const r = await db.companyJob.updateMany({ where: { id: req.params.id, companyId: u.id }, data: { publicada } });
    if (!r.count) throw naoEncontrado("Vaga");
    return { ok: true, publicada };
  });

  app.delete<{ Params: { id: string } }>("/empresa/vagas/:id", async (req) => {
    const u = exigirEmpresa(req);
    const r = await db.companyJob.deleteMany({ where: { id: req.params.id, companyId: u.id } });
    if (!r.count) throw naoEncontrado("Vaga");
    return { ok: true };
  });

  /* ---------- Desafios práticos ---------- */

  app.get("/empresa/desafios", async (req) => {
    const u = exigirEmpresa(req);
    const ds = await db.challenge.findMany({
      where: { companyId: u.id },
      include: { entregas: { include: { candidate: { select: { nome: true, perfil: { select: { slug: true, publico: true } } } } }, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    const itens: Desafio[] = ds.map((d) => ({
      id: d.id,
      empresa: u.nome,
      titulo: d.titulo,
      vaga: d.vaga,
      competencia: d.competencia,
      descricao: d.descricao,
      prazo: d.prazo,
      entregas: d.entregas.map((x) => ({
        id: x.id,
        candidatoNome: x.candidate.nome,
        candidatoSlug: x.candidate.perfil?.publico ? x.candidate.perfil.slug : null,
        link: x.link,
        triagem: x.triagem as Triagem,
        criadaEm: x.createdAt.toISOString(),
      })),
    }));
    return { itens };
  });

  app.post("/empresa/desafios", async (req, reply) => {
    const u = exigirEmpresa(req);
    const d = validar(desafioSchema, req.body);
    if (d.prazo < new Date().toISOString().slice(0, 10)) throw new ErroApp(400, "validacao", "O prazo precisa ser hoje ou uma data futura.", "prazo");
    const c = await db.challenge.create({
      data: { companyId: u.id, titulo: d.titulo, vaga: d.vaga || "Vaga não indicada", competencia: d.competencia, descricao: d.descricao, prazo: d.prazo },
    });
    return reply.status(201).send({ id: c.id });
  });

  app.delete<{ Params: { id: string } }>("/empresa/desafios/:id", async (req) => {
    const u = exigirEmpresa(req);
    const r = await db.challenge.deleteMany({ where: { id: req.params.id, companyId: u.id } });
    if (!r.count) throw naoEncontrado("Desafio");
    return { ok: true };
  });

  app.patch<{ Params: { id: string } }>("/empresa/entregas/:id", async (req) => {
    const u = exigirEmpresa(req);
    const d = validar(triagemSchema, req.body);
    const e = await db.submission.findFirst({ where: { id: req.params.id, challenge: { companyId: u.id } } });
    if (!e) throw naoEncontrado("Entrega");
    await db.submission.update({ where: { id: e.id }, data: { triagem: d.triagem } });
    return { ok: true };
  });

  /* ---------- Busca por competências comprovadas ---------- */

  app.get<{ Querystring: { q?: string } }>("/empresa/candidatos", async (req) => {
    exigirEmpresa(req);
    const q = norm(String(req.query.q ?? "").slice(0, 80)).trim();
    // Só perfis que a própria pessoa tornou públicos.
    const perfis = await db.candidateProfile.findMany({
      where: { publico: true },
      include: { user: { select: { nome: true, evidencias: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const itens: CandidatoBusca[] = [];
    for (const p of perfis) {
      const comp = new Map<string, number>();
      for (const row of p.user.evidencias) {
        const e = evidenciaDom(row);
        if (grau(e) < 3) continue;
        for (const c of e.competencias) comp.set(c, (comp.get(c) ?? 0) + 1);
      }
      if (!comp.size) continue;
      if (q && ![...comp.keys()].some((c) => norm(c).includes(q))) continue;
      itens.push({
        slug: p.slug,
        nome: p.user.nome,
        area: AREAS[p.destino as AreaId]?.nome ?? null,
        competencias: [...comp.entries()].map(([nome, evidencias]) => ({ nome, evidencias })),
      });
    }
    return { itens: itens.slice(0, 50) };
  });
}
