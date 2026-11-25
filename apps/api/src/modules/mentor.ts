import { AREAS, DECISOES, mensagemMentorSchema, type AreaId } from "@decifra/shared";
import type { User } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { SISTEMA_MENTOR, marcar } from "../ai/prompts";
import { ErroIA } from "../ai/tipos";
import { completa, raio } from "../domain/raio";
import { ErroApp, naoEncontrado, validar } from "../lib/erros";
import { lerLista } from "../lib/json";
import { exigirCandidato } from "../plugins/auth";
import { contarUso, evidenciasDe, inicioDoDia, limiteMentor, vagasDe } from "./servicos";

const HISTORICO_MAX = 20;

/**
 * Mentor DECIFRA: assistente conversacional com o contexto real da pessoa
 * (diagnóstico, evidências, Raio-X, plano e candidaturas). Respostas em
 * streaming (SSE) e histórico persistido por conversa.
 */
export async function rotasMentor(app: FastifyInstance) {
  const { db, ia } = app.ctx;

  /** Resumo compacto do que a DECIFRA sabe sobre a pessoa, enviado como dado ao modelo. */
  async function contexto(u: User): Promise<string> {
    const [perfil, evs, vagas, tarefas, cands] = await Promise.all([
      db.candidateProfile.findUnique({ where: { userId: u.id } }),
      evidenciasDe(db, u.id),
      vagasDe(db, u.id),
      db.task.findMany({ where: { userId: u.id, status: { not: "feito" } }, orderBy: { prazo: "asc" }, take: 10 }),
      db.application.findMany({ where: { userId: u.id }, include: { job: { select: { titulo: true } } }, take: 20 }),
    ]);
    const linhas: string[] = [`Nome: ${u.nome}`, `Plano: ${u.plano === "plus" ? "Candidato Plus" : "Candidato grátis"}`];
    if (perfil) {
      linhas.push(
        `Área de destino: ${AREAS[perfil.destino as AreaId]?.nome ?? perfil.destino}`,
        `Vem de: ${perfil.origem}`,
        `Etapa da transição: ${perfil.etapa}`,
        `O que mais atrapalha: ${lerLista(perfil.atrapalha).join("; ")}`,
      );
    } else linhas.push("Diagnóstico ainda não respondido.");

    linhas.push(`\nEvidências (${evs.length}):`);
    for (const e of evs.slice(0, 30)) {
      linhas.push(`- ${e.titulo} [${e.tipo}] competências: ${e.competencias.join(", ") || "nenhuma"}; ${completa(e) ? "bem documentada" : "documentação incompleta"}`);
    }
    linhas.push(`\nVagas analisadas no Raio-X (${vagas.length}):`);
    for (const v of vagas.slice(0, 10)) {
      const r = raio(v, evs);
      const lac = r.reqs.filter((q) => q.obrig && q.situacao === "nao_tem").map((q) => q.curto);
      const mostrar = r.reqs.filter((q) => q.obrig && q.situacao === "tem_precisa_mostrar").map((q) => q.curto);
      linhas.push(
        `- ${v.titulo}: decisão "${DECISOES[r.decisao].rotulo}". Ainda não tem: ${lac.join(", ") || "nada"}. Precisa mostrar: ${mostrar.join(", ") || "nada"}.`,
      );
    }
    linhas.push(`\nTarefas abertas no Plano (${tarefas.length}):`);
    for (const t of tarefas) linhas.push(`- ${t.titulo} (prazo ${t.prazo}, ${t.status})`);
    linhas.push(`\nCandidaturas (${cands.length}):`);
    for (const c of cands) linhas.push(`- ${c.job.titulo}: ${c.etapa}`);
    return linhas.join("\n").slice(0, 12000);
  }

  app.get("/mentor/conversas", async (req) => {
    const u = exigirCandidato(req);
    const cs = await db.conversation.findMany({ where: { userId: u.id }, orderBy: { updatedAt: "desc" }, take: 50 });
    return { itens: cs.map((c) => ({ id: c.id, titulo: c.titulo, atualizadaEm: c.updatedAt.toISOString() })) };
  });

  app.get<{ Params: { id: string } }>("/mentor/conversas/:id", async (req) => {
    const u = exigirCandidato(req);
    const c = await db.conversation.findFirst({ where: { id: req.params.id, userId: u.id }, include: { mensagens: { orderBy: { createdAt: "asc" } } } });
    if (!c) throw naoEncontrado("Conversa");
    return {
      id: c.id,
      titulo: c.titulo,
      mensagens: c.mensagens.map((m) => ({ id: m.id, papel: m.papel, conteudo: m.conteudo, criadaEm: m.createdAt.toISOString() })),
    };
  });

  app.delete<{ Params: { id: string } }>("/mentor/conversas/:id", async (req) => {
    const u = exigirCandidato(req);
    const r = await db.conversation.deleteMany({ where: { id: req.params.id, userId: u.id } });
    if (!r.count) throw naoEncontrado("Conversa");
    return { ok: true };
  });

  app.post("/mentor/mensagens", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const u = exigirCandidato(req);
    const d = validar(mensagemMentorSchema, req.body);
    if (!ia.ativa) throw new ErroApp(503, "ia_desativada", "O Mentor usa IA, que não está configurada neste ambiente.");
    const limite = limiteMentor(app.ctx, u);
    if ((await contarUso(db, u.id, "mentor", inicioDoDia())) >= limite) {
      throw new ErroApp(429, "limite_mentor", `Você usou as ${limite} mensagens do Mentor de hoje. Volte amanhã.`);
    }

    let conversa = d.conversaId ? await db.conversation.findFirst({ where: { id: d.conversaId, userId: u.id } }) : null;
    if (d.conversaId && !conversa) throw naoEncontrado("Conversa");
    conversa ??= await db.conversation.create({ data: { userId: u.id, titulo: d.mensagem.replace(/\s+/g, " ").slice(0, 60) } });

    await db.message.create({ data: { conversationId: conversa.id, papel: "user", conteudo: d.mensagem } });
    await db.usageEvent.create({ data: { userId: u.id, tipo: "mentor" } });
    const historico = (
      await db.message.findMany({ where: { conversationId: conversa.id }, orderBy: { createdAt: "desc" }, take: HISTORICO_MAX })
    ).reverse();
    // A API exige que a conversa comece pelo usuário.
    while (historico.length && historico[0]!.papel !== "user") historico.shift();
    const sistema = `${SISTEMA_MENTOR}\n\n${marcar("contexto", await contexto(u))}`;

    // A partir daqui a resposta é um stream SSE: o Fastify não envia mais nada.
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff",
    });
    const enviar = (evento: string, dados: unknown) => res.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);
    const cancelar = new AbortController();
    res.on("close", () => cancelar.abort());

    enviar("inicio", { conversaId: conversa.id, titulo: conversa.titulo });
    try {
      const texto = await ia.conversar(
        "mentor",
        u.id,
        { sistema, mensagens: historico.map((m) => ({ papel: m.papel as "user" | "assistant", conteudo: m.conteudo })) },
        (trecho) => enviar("trecho", { t: trecho }),
        cancelar.signal,
      );
      const msg = await db.message.create({ data: { conversationId: conversa.id, papel: "assistant", conteudo: texto || "(sem resposta)" } });
      await db.conversation.update({ where: { id: conversa.id }, data: { updatedAt: new Date() } });
      enviar("fim", { mensagemId: msg.id });
    } catch (e) {
      const motivo = e instanceof ErroIA ? e.motivo : "falha";
      req.log.warn({ motivo }, "mentor falhou");
      enviar("erro", {
        erro: motivo === "recusa" ? "Não posso ajudar com esse pedido. Que tal reformular?" : "O Mentor não respondeu agora. Tente de novo em instantes.",
      });
    } finally {
      res.end();
    }
  });
}
