import { AREAS, DECISOES, mensagemMentorSchema, type AreaId, type MensagemMentor } from "@decifra/shared";
import type { Message, User } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { redigirDadosPessoais } from "../ai/privacidade";
import { SISTEMA_MENTOR, marcar } from "../ai/prompts";
import { descreverMeta } from "../ai/tarefas";
import { ErroIA, type MensagemIA } from "../ai/tipos";
import { completa, faltas, raio } from "../domain/raio";
import { ErroApp, naoEncontrado, validar } from "../lib/erros";
import { lerLista } from "../lib/json";
import { respostaErroIA } from "../lib/mensagens-ia";
import { exigirCandidato } from "../plugins/auth";
import { contarUso, evidenciasDe, inicioDoDia, limiteMentor, vagasDe } from "./servicos";

/** Orçamento de caracteres enviados ao modelo: contexto da pessoa e histórico da conversa. */
const ORCAMENTO_CONTEXTO = 9000;
const ORCAMENTO_HISTORICO = 10000;

const dto = (m: Message): MensagemMentor => ({
  id: m.id,
  papel: m.papel as "user" | "assistant",
  conteudo: m.conteudo,
  ia: m.iaDescricao,
  interrompida: m.interrompida,
  criadaEm: m.createdAt.toISOString(),
});

/**
 * Mentor DECIFRA: assistente conversacional com o contexto real da pessoa.
 * Respostas em streaming (SSE). A conversa só é gravada quando há resposta:
 * se a IA falha antes de responder, nada é salvo e a cota não é consumida.
 */
export async function rotasMentor(app: FastifyInstance) {
  const { db, ia } = app.ctx;

  /** Resumo do que a DECIFRA sabe sobre a pessoa, enviado como dado ao modelo. */
  async function contexto(u: User) {
    const [perfil, evs, vagas, tarefas, cands] = await Promise.all([
      db.candidateProfile.findUnique({ where: { userId: u.id } }),
      evidenciasDe(db, u.id),
      vagasDe(db, u.id),
      db.task.findMany({ where: { userId: u.id, status: { not: "feito" } }, orderBy: { prazo: "asc" }, take: 10 }),
      db.application.findMany({ where: { userId: u.id }, include: { job: { select: { titulo: true } } }, orderBy: { updatedAt: "desc" }, take: 15 }),
    ]);
    const hoje = new Date().toISOString().slice(0, 10);
    const l: string[] = [`Data de hoje: ${hoje}`, `Nome: ${u.nome}`, `Plano: ${u.plano === "plus" ? "Candidato Plus" : "Candidato grátis"}`];
    if (perfil) {
      l.push(
        `Área de destino: ${AREAS[perfil.destino as AreaId]?.nome ?? perfil.destino}`,
        `Vem de: ${perfil.origem}`,
        `Etapa da transição: ${perfil.etapa}`,
        `Já se candidatou na nova área: ${perfil.candidatou === "sim" ? "sim" : "não"}`,
        `O que mais atrapalha: ${lerLista(perfil.atrapalha).join("; ")}`,
      );
    } else l.push("Diagnóstico ainda não respondido.");

    l.push(`\nEvidências (${evs.length}):`);
    for (const e of evs.slice(0, 25)) {
      const f = faltas(e);
      l.push(`- ${e.titulo} [${e.tipo}] comprova: ${e.competencias.join(", ") || "nada indicado"}; ${completa(e) ? "bem documentada" : `falta: ${f.join(", ")}`}`);
    }
    l.push(`\nVagas analisadas no Raio-X (${vagas.length}):`);
    const lacunas = new Map<string, number>();
    for (const v of vagas.slice(0, 10)) {
      const r = raio(v, evs);
      const nao = r.reqs.filter((q) => q.obrig && q.situacao === "nao_tem").map((q) => q.curto);
      const mostrar = r.reqs.filter((q) => q.obrig && q.situacao === "tem_precisa_mostrar").map((q) => q.curto);
      nao.forEach((c) => lacunas.set(c, (lacunas.get(c) ?? 0) + 1));
      l.push(`- ${v.titulo}${v.empresa ? ` (${v.empresa})` : ""}: decisão "${DECISOES[r.decisao].rotulo}". Não tem: ${nao.join(", ") || "nada"}. Precisa mostrar: ${mostrar.join(", ") || "nada"}.`);
    }
    if (lacunas.size) {
      const top = [...lacunas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => `${c} (${n} vaga${n > 1 ? "s" : ""})`);
      l.push(`Lacunas que mais se repetem: ${top.join(", ")}`);
    }
    l.push(`\nTarefas abertas no Plano (${tarefas.length}):`);
    for (const t of tarefas) l.push(`- ${t.titulo} (prazo ${t.prazo}${t.prazo < hoje ? ", vencido" : ""}, ${t.status})`);
    l.push(`\nCandidaturas (${cands.length}):`);
    for (const c of cands) l.push(`- ${c.job.titulo}: ${c.etapa}`);
    return { texto: redigirDadosPessoais(l.join("\n")).slice(0, ORCAMENTO_CONTEXTO), evidencias: evs.length, vagas: vagas.length, etapa: perfil?.etapa ?? null, lacunas: [...lacunas.keys()] };
  }

  app.get("/mentor/conversas", async (req) => {
    const u = exigirCandidato(req);
    const cs = await db.conversation.findMany({ where: { userId: u.id }, orderBy: { updatedAt: "desc" }, take: 50, include: { _count: { select: { mensagens: true } } } });
    return { itens: cs.map((c) => ({ id: c.id, titulo: c.titulo, atualizadaEm: c.updatedAt.toISOString(), mensagens: c._count.mensagens })) };
  });

  app.get<{ Params: { id: string } }>("/mentor/conversas/:id", async (req) => {
    const u = exigirCandidato(req);
    const c = await db.conversation.findFirst({ where: { id: req.params.id, userId: u.id }, include: { mensagens: { orderBy: { createdAt: "asc" } } } });
    if (!c) throw naoEncontrado("Conversa");
    return { id: c.id, titulo: c.titulo, mensagens: c.mensagens.map(dto) };
  });

  app.delete<{ Params: { id: string } }>("/mentor/conversas/:id", async (req) => {
    const u = exigirCandidato(req);
    const r = await db.conversation.deleteMany({ where: { id: req.params.id, userId: u.id } });
    if (!r.count) throw naoEncontrado("Conversa");
    return { ok: true };
  });

  /** Perguntas iniciais escolhidas pela etapa e pelos dados da pessoa (sem IA). */
  app.get("/mentor/sugestoes", async (req) => {
    const u = exigirCandidato(req);
    const [perfil, nEvs, vagas, nTarefas] = await Promise.all([
      db.candidateProfile.findUnique({ where: { userId: u.id } }),
      db.evidence.count({ where: { userId: u.id } }),
      db.job.findMany({ where: { userId: u.id }, select: { titulo: true }, orderBy: { createdAt: "desc" }, take: 1 }),
      db.task.count({ where: { userId: u.id, status: { not: "feito" } } }),
    ]);
    const s: string[] = [];
    const etapa = perfil?.etapa;
    if (etapa === "Definindo o caminho") s.push("Que tipo de vaga de entrada combina com a minha experiência anterior?");
    if (etapa === "Construindo a base") s.push("Como transformo o que estou estudando em evidência que um recrutador valorize?");
    if (etapa === "Buscando a vaga") s.push("Por que posso estar sem retorno das empresas e o que mudo primeiro?");
    if (vagas[0]) s.push(`O que eu faço primeiro para me preparar para a vaga “${vagas[0].titulo}”?`);
    else s.push("Como escolho uma vaga para fazer o meu primeiro Raio-X?");
    s.push(nEvs ? "Qual das minhas evidências eu devo documentar melhor primeiro?" : "Que evidência eu consigo registrar ainda esta semana?");
    if (nTarefas) s.push("Como organizo as tarefas do meu Plano nas próximas duas semanas?");
    s.push("Como conto minha experiência anterior numa entrevista?");
    s.push("O que significa “exigência formal” no Raio-X?");
    return { itens: [...new Set(s)].slice(0, 4) };
  });

  app.post("/mentor/mensagens", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const u = exigirCandidato(req);
    const d = validar(mensagemMentorSchema, req.body);
    if (!ia.disponivelPara("mentor")) {
      const r = respostaErroIA(new ErroIA(ia.ativa ? "privacidade" : "desativada", ""));
      throw new ErroApp(r.status, r.codigo, r.erro);
    }
    const limite = limiteMentor(app.ctx, u);
    if ((await contarUso(db, u.id, "mentor", inicioDoDia())) >= limite) {
      throw new ErroApp(429, "limite_mentor", `Você usou as ${limite} mensagens do Mentor de hoje. Elas renovam amanhã.`);
    }
    const conversa = d.conversaId ? await db.conversation.findFirst({ where: { id: d.conversaId, userId: u.id } }) : null;
    if (d.conversaId && !conversa) throw naoEncontrado("Conversa");

    // Histórico dentro do orçamento, das mensagens mais novas para as mais antigas.
    const anteriores = conversa ? await db.message.findMany({ where: { conversationId: conversa.id }, orderBy: { createdAt: "desc" }, take: 40 }) : [];
    const historico: MensagemIA[] = [];
    let usados = d.mensagem.length;
    for (const m of anteriores) {
      if (usados + m.conteudo.length > ORCAMENTO_HISTORICO) break;
      usados += m.conteudo.length;
      historico.unshift({ papel: m.papel as "user" | "assistant", conteudo: m.conteudo });
    }
    while (historico.length && historico[0]!.papel !== "user") historico.shift();
    historico.push({ papel: "user", conteudo: redigirDadosPessoais(d.mensagem) });
    const ctx = await contexto(u);
    const sistema = `${SISTEMA_MENTOR}\n\n${marcar("contexto", ctx.texto)}`;

    // A partir daqui a resposta é um stream SSE.
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff",
    });
    let aberto = true;
    const enviar = (evento: string, dados: unknown) => {
      if (aberto) res.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);
    };
    const cancelar = new AbortController();
    res.on("close", () => {
      aberto = false;
      cancelar.abort();
    });

    /** Grava a troca (pergunta e resposta, completa ou parcial) e consome a cota. */
    const gravar = async (texto: string, iaDescricao: string | null, interrompida: boolean) => {
      const c = conversa ?? (await db.conversation.create({ data: { userId: u.id, titulo: d.mensagem.replace(/\s+/g, " ").slice(0, 60) } }));
      const [, resposta] = await db.$transaction([
        db.message.create({ data: { conversationId: c.id, papel: "user", conteudo: d.mensagem } }),
        db.message.create({ data: { conversationId: c.id, papel: "assistant", conteudo: texto, iaDescricao, interrompida } }),
        db.usageEvent.create({ data: { userId: u.id, tipo: "mentor" } }),
        db.conversation.update({ where: { id: c.id }, data: { updatedAt: new Date() } }),
      ]);
      return { conversaId: c.id, titulo: c.titulo, mensagem: dto(resposta) };
    };

    enviar("inicio", {});
    let parcial = "";
    let descricao: string | null = null;
    try {
      const r = await ia.conversar(
        "mentor",
        u.id,
        { sistema, mensagens: historico },
        {
          aoIniciar: (meta) => {
            descricao = descreverMeta(meta);
            enviar("meta", { ia: descricao });
          },
          aoReceber: (t) => {
            parcial += t;
            enviar("trecho", { t });
          },
        },
        { mensagem: d.mensagem, turnos: anteriores.length, evidencias: ctx.evidencias, vagas: ctx.vagas },
        cancelar.signal,
      );
      const salvo = await gravar(r.dados, descreverMeta(r.meta), false);
      enviar("fim", salvo);
    } catch (e) {
      const erro = e instanceof ErroIA ? e : new ErroIA("falha", e instanceof Error ? e.message : "falha");
      req.log.warn({ motivo: erro.motivo, parcial: erro.parcial }, "mentor sem resposta completa");
      // Resposta parcial (cancelada ou interrompida no meio) fica guardada e marcada.
      if (parcial.trim()) {
        const salvo = await gravar(parcial, descricao, true).catch(() => null);
        if (salvo && erro.motivo !== "cancelado") enviar("fim", salvo);
      }
      if (erro.motivo !== "cancelado") {
        const r = respostaErroIA(erro);
        enviar("erro", { erro: parcial.trim() ? `A resposta foi interrompida. ${r.erro}` : r.erro, codigo: r.codigo });
      }
    } finally {
      if (aberto) res.end();
    }
  });
}
