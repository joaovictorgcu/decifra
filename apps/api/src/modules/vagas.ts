import { LIMITE_RAIO_GRATIS, requisitoNovoSchema, requisitoPesoSchema, vagaCandidatoSchema, type Fonte, type VagaDetalhe, type VagaResumo } from "@decifra/shared";
import type { User } from "../../generated/prisma/client";
import type { FastifyInstance } from "fastify";
import { descreverMeta, extrairRequisitosIA } from "../ai/tarefas";
import { extrairRequisitos } from "../domain/extrair";
import { raio, radar } from "../domain/raio";
import { dataMais } from "../domain/texto";
import type { RequisitoDom } from "../domain/tipos";
import { ErroApp, naoEncontrado, validar } from "../lib/erros";
import { vagaDom } from "../lib/mapear";
import { exigirCandidato, exigirPlus } from "../plugins/auth";
import { contarUso, evidenciasDe, inicioDoMes, vagasDe } from "./servicos";

/** Raio-X da Vaga: requisitos cruzados com evidências, decisão fundamentada e próximos passos. */
export async function rotasVagas(app: FastifyInstance) {
  const { db, ia } = app.ctx;

  async function checarLimite(u: User) {
    if (u.plano === "plus") return;
    const usados = await contarUso(db, u.id, "raio_x", inicioDoMes());
    if (usados >= LIMITE_RAIO_GRATIS) {
      throw new ErroApp(402, "plano", `Você usou os ${LIMITE_RAIO_GRATIS} Raio-X do mês no plano grátis. O Raio-X ilimitado faz parte do Candidato Plus.`);
    }
  }

  async function detalhe(userId: string, id: string): Promise<VagaDetalhe> {
    const job = await db.job.findFirst({
      where: { id, userId },
      include: { requisitos: true, candidatura: true, _count: { select: { tarefas: true } } },
    });
    if (!job) throw naoEncontrado("Vaga");
    const [evs, fb] = await Promise.all([
      evidenciasDe(db, userId),
      db.feedback.findUnique({ where: { userId_alvo_refId: { userId, alvo: "raio", refId: id } }, select: { util: true } }),
    ]);
    const r = raio(vagaDom(job), evs);
    return {
      id: job.id,
      titulo: job.titulo,
      empresa: job.empresa,
      texto: job.texto,
      fonte: job.fonte as Fonte,
      ia: job.iaDescricao,
      vagaEmpresaId: job.companyJobId,
      criadaEm: job.createdAt.toISOString(),
      decisao: r.decisao,
      raio: r,
      noPlano: job._count.tarefas > 0,
      candidaturaId: job.candidatura?.id ?? null,
      ajustada: job.ajustada,
      feedback: fb?.util ?? null,
    };
  }

  async function salvarVaga(
    u: User,
    dados: { titulo: string; empresa: string; texto: string; fonte: Fonte; iaDescricao?: string | null; companyJobId: string | null },
    reqs: RequisitoDom[],
  ) {
    const job = await db.$transaction(async (tx) => {
      const j = await tx.job.create({
        data: {
          userId: u.id,
          titulo: dados.titulo,
          empresa: dados.empresa,
          texto: dados.texto,
          fonte: dados.fonte,
          iaDescricao: dados.iaDescricao ?? null,
          companyJobId: dados.companyJobId,
          requisitos: {
            create: reqs.map((r, i) => ({ ordem: i, requisito: r.requisito, curto: r.curto, tipo: r.tipo, kind: r.kind, obrig: r.obrig, evId: r.evId, aceita: r.aceita })),
          },
        },
      });
      await tx.usageEvent.create({ data: { userId: u.id, tipo: "raio_x" } });
      return j;
    });
    req_log(app, u.id, job.id, dados.fonte, reqs.length);
    return job;
  }

  app.get("/vagas", async (req) => {
    const u = exigirCandidato(req);
    const [vagas, evs] = await Promise.all([vagasDe(db, u.id), evidenciasDe(db, u.id)]);
    const itens: VagaResumo[] = vagas.map((v) => ({
      id: v.id,
      titulo: v.titulo,
      empresa: v.empresa,
      fonte: v.fonte as Fonte,
      ia: v.iaDescricao,
      vagaEmpresaId: v.companyJobId,
      criadaEm: v.criadaEm.toISOString(),
      decisao: raio(v, evs).decisao,
    }));
    return { itens };
  });

  app.post("/vagas", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const u = exigirCandidato(req);
    const d = validar(vagaCandidatoSchema, req.body);
    await checarLimite(u);
    const evs = await evidenciasDe(db, u.id);
    const reqsIA = await extrairRequisitosIA(ia, u.id, d.texto, evs);
    const reqs = reqsIA?.valor ?? extrairRequisitos(d.texto);
    if (!reqs.length) {
      throw new ErroApp(422, "sem_requisitos", "Não encontrei requisitos. Cole a parte da vaga que lista conhecimentos, ferramentas e tempo de experiência.", "texto");
    }
    const titulo = d.titulo || d.texto.split("\n")[0]?.replace(/^vaga:\s*/i, "").slice(0, 80).trim() || "Vaga sem nome";
    const job = await salvarVaga(u, { titulo, empresa: "", texto: d.texto, fonte: reqsIA ? "ia" : "regras", iaDescricao: reqsIA ? descreverMeta(reqsIA.meta) : null, companyJobId: null }, reqs);
    return reply.status(201).send(await detalhe(u.id, job.id));
  });

  app.get<{ Params: { id: string } }>("/vagas/:id", async (req) => {
    const u = exigirCandidato(req);
    return detalhe(u.id, req.params.id);
  });

  app.delete<{ Params: { id: string } }>("/vagas/:id", async (req) => {
    const u = exigirCandidato(req);
    const r = await db.job.deleteMany({ where: { id: req.params.id, userId: u.id } });
    if (!r.count) throw naoEncontrado("Vaga");
    return { ok: true };
  });

  /* ---------- Correção manual e reanálise ---------- */

  /** Vaga da pessoa que pode ter requisitos alterados (as publicadas pela empresa seguem a decisão dela). */
  async function vagaEditavel(userId: string, id: string) {
    const job = await db.job.findFirst({ where: { id, userId }, include: { requisitos: true } });
    if (!job) throw naoEncontrado("Vaga");
    if (job.fonte === "empresa") {
      throw new ErroApp(409, "vaga_empresa", "Os requisitos desta vaga foram definidos pela própria empresa e não podem ser alterados.");
    }
    return job;
  }

  app.patch<{ Params: { id: string; reqId: string } }>("/vagas/:id/requisitos/:reqId", async (req) => {
    const u = exigirCandidato(req);
    const d = validar(requisitoPesoSchema, req.body);
    const job = await vagaEditavel(u.id, req.params.id);
    if (!job.requisitos.some((r) => r.id === req.params.reqId)) throw naoEncontrado("Requisito");
    await db.$transaction([
      db.jobRequirement.update({ where: { id: req.params.reqId }, data: { obrig: d.obrig } }),
      db.job.update({ where: { id: job.id }, data: { ajustada: true } }),
    ]);
    return detalhe(u.id, job.id);
  });

  app.delete<{ Params: { id: string; reqId: string } }>("/vagas/:id/requisitos/:reqId", async (req) => {
    const u = exigirCandidato(req);
    const job = await vagaEditavel(u.id, req.params.id);
    if (!job.requisitos.some((r) => r.id === req.params.reqId)) throw naoEncontrado("Requisito");
    if (job.requisitos.length <= 1) throw new ErroApp(409, "ultimo_requisito", "A vaga precisa de pelo menos um requisito. Adicione outro antes de remover este.");
    await db.$transaction([
      db.jobRequirement.delete({ where: { id: req.params.reqId } }),
      db.job.update({ where: { id: job.id }, data: { ajustada: true } }),
    ]);
    return detalhe(u.id, job.id);
  });

  app.post<{ Params: { id: string } }>("/vagas/:id/requisitos", async (req, reply) => {
    const u = exigirCandidato(req);
    const d = validar(requisitoNovoSchema, req.body);
    const job = await vagaEditavel(u.id, req.params.id);
    if (job.requisitos.length >= 40) throw new ErroApp(409, "limite_requisitos", "A vaga já tem 40 requisitos.");
    const repetido = job.requisitos.some((r) => r.curto.toLowerCase() === d.nome.toLowerCase());
    if (repetido) throw new ErroApp(409, "duplicado", "Este requisito já está na vaga.", "nome");
    const ordem = Math.max(-1, ...job.requisitos.map((r) => r.ordem)) + 1;
    await db.$transaction([
      db.jobRequirement.create({
        data: { jobId: job.id, ordem, requisito: d.nome, curto: d.nome, tipo: d.tipo, kind: d.tipo === "formal" ? d.kind : null, obrig: d.obrig },
      }),
      db.job.update({ where: { id: job.id }, data: { ajustada: true } }),
    ]);
    return reply.status(201).send(await detalhe(u.id, job.id));
  });

  /**
   * Refaz a leitura da vaga com IA (ex.: quando o Raio-X saiu pelo motor de regras
   * porque a IA estava fora). Substitui os requisitos, inclusive ajustes manuais.
   * Não consome Raio-X do mês (é a mesma vaga), mas conta na cota diária de IA.
   */
  app.post<{ Params: { id: string } }>("/vagas/:id/reanalisar", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req) => {
    const u = exigirCandidato(req);
    const job = await vagaEditavel(u.id, req.params.id);
    if (!ia.disponivelPara("extrair_requisitos")) throw new ErroApp(503, "ia_desativada", "A IA não está configurada neste ambiente.");
    const evs = await evidenciasDe(db, u.id);
    const r = await extrairRequisitosIA(ia, u.id, job.texto, evs);
    if (!r) throw new ErroApp(503, "ia_indisponivel", "A IA não conseguiu analisar a vaga agora. Seus requisitos atuais foram mantidos. Tente de novo em instantes.");
    await db.$transaction([
      db.jobRequirement.deleteMany({ where: { jobId: job.id } }),
      db.jobRequirement.createMany({
        data: r.valor.map((q, i) => ({ jobId: job.id, ordem: i, requisito: q.requisito, curto: q.curto, tipo: q.tipo, kind: q.kind, obrig: q.obrig, evId: q.evId, aceita: q.aceita })),
      }),
      db.job.update({ where: { id: job.id }, data: { fonte: "ia", iaDescricao: descreverMeta(r.meta), ajustada: false } }),
    ]);
    req.log.info({ userId: u.id, jobId: job.id }, "raio-x reanalisado com IA");
    return detalhe(u.id, job.id);
  });

  /** Leva as ações do Raio-X para o Plano de Evidências, sem duplicar tarefas. */
  app.post<{ Params: { id: string } }>("/vagas/:id/plano", async (req) => {
    const u = exigirCandidato(req);
    const d = await detalhe(u.id, req.params.id);
    const existentes = new Set((await db.task.findMany({ where: { userId: u.id }, select: { titulo: true } })).map((t) => t.titulo));
    const novas = d.raio.acoes.filter((a) => !existentes.has(a.texto));
    await db.task.createMany({
      data: novas.map((a, i) => ({
        userId: u.id,
        jobId: d.id,
        titulo: a.texto,
        prazo: dataMais(7 + i * 3),
        tipo: a.tipo,
        comp: a.comp,
        evId: a.evId || null,
      })),
    });
    return { adicionadas: novas.length };
  });

  /* ---------- Vagas publicadas por empresas na DECIFRA ---------- */

  app.get("/vagas-abertas", async (req) => {
    const u = exigirCandidato(req);
    const [abertas, minhas] = await Promise.all([
      db.companyJob.findMany({
        where: { publicada: true },
        include: { company: { select: { nome: true } }, _count: { select: { requisitos: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.job.findMany({ where: { userId: u.id, companyJobId: { not: null } }, select: { id: true, companyJobId: true } }),
    ]);
    const analisadas = new Map(minhas.map((m) => [m.companyJobId, m.id]));
    return {
      itens: abertas.map((v) => ({
        id: v.id,
        titulo: v.titulo,
        empresa: v.company.nome,
        selo: v.selo,
        requisitos: v._count.requisitos,
        criadaEm: v.createdAt.toISOString(),
        minhaVagaId: analisadas.get(v.id) ?? null,
      })),
    };
  });

  /** Raio-X de uma vaga publicada: usa os requisitos e pesos revisados pela própria empresa. */
  app.post<{ Params: { id: string } }>("/vagas-abertas/:id/raio", async (req, reply) => {
    const u = exigirCandidato(req);
    const cv = await db.companyJob.findFirst({ where: { id: req.params.id, publicada: true }, include: { requisitos: true, company: { select: { nome: true } } } });
    if (!cv) throw naoEncontrado("Vaga");
    const ja = await db.job.findFirst({ where: { userId: u.id, companyJobId: cv.id } });
    if (ja) return detalhe(u.id, ja.id);
    await checarLimite(u);
    const reqs: RequisitoDom[] = [...cv.requisitos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((r) => ({ id: r.id, requisito: r.requisito, curto: r.curto, tipo: r.tipo as RequisitoDom["tipo"], kind: (r.kind as RequisitoDom["kind"]) ?? null, obrig: r.obrig, evId: null, aceita: (r.aceita as RequisitoDom["aceita"]) || "" }));
    const job = await salvarVaga(u, { titulo: cv.titulo, empresa: cv.company.nome, texto: cv.texto, fonte: "empresa", companyJobId: cv.id }, reqs);
    return reply.status(201).send(await detalhe(u.id, job.id));
  });

  /* ---------- Radar de Vagas (Plus) ---------- */

  app.get("/radar", async (req) => {
    const u = exigirCandidato(req);
    exigirPlus(u, "O Radar de Vagas");
    const [vagas, evs] = await Promise.all([vagasDe(db, u.id), evidenciasDe(db, u.id)]);
    const itens = radar(vagas, evs);
    const prioridade = [...itens].filter((i) => i.situacao !== "comprova").sort((a, b) => b.ganho - a.ganho || b.obrig - a.obrig)[0] ?? null;
    return { itens, prioridade, totalVagas: vagas.length };
  });
}

function req_log(app: FastifyInstance, userId: string, jobId: string, fonte: string, n: number) {
  app.log.info({ userId, jobId, fonte, requisitos: n }, "raio-x gerado");
}
