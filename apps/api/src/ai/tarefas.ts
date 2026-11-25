import type { EvidenciaInput, Traducao } from "@decifra/shared";
import { TIPOS_EVIDENCIA } from "@decifra/shared";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { violaPrincipios } from "../domain/regras";
import type { EvidenciaDom, RequisitoDom } from "../domain/tipos";
import { redigirDadosPessoais } from "./privacidade";
import { SISTEMA_EXTRAIR, SISTEMA_FEEDBACK, SISTEMA_HISTORIA, SISTEMA_IMPORTAR_CV, SISTEMA_TRADUZIR, marcar } from "./prompts";
import type { ServicoIA } from "./servico";
import { ErroIA, type MetaIA } from "./tipos";

/**
 * Tarefas de IA do produto. As tarefas com alternativa por regras devolvem
 * `null` em qualquer falha (sem provedor, cota, indisponibilidade, resposta
 * inválida ou que viole os princípios) e a rota usa o motor de regras, marcando
 * o resultado como "regras". Saídas da IA nunca são usadas sem validação.
 */
export interface ComMeta<T> {
  valor: T;
  meta: MetaIA;
}

/** Erros que indicam problema de programação (não de disponibilidade) continuam visíveis nos logs. */
function tolerar(e: unknown): null {
  if (e instanceof ErroIA) return null;
  throw e;
}

/* ---------- Extração de requisitos ---------- */

const RequisitosIA = z.object({
  requisitos: z.array(
    z.object({
      requisito: z.string(),
      curto: z.string(),
      tipo: z.enum(["tecnica", "formal", "comportamental"]),
      kind: z.enum(["tempo", "diploma", "certificacao", ""]),
      obrig: z.boolean(),
      evId: z.string(),
    }),
  ),
});

export async function extrairRequisitosIA(
  ia: ServicoIA,
  userId: string | null,
  texto: string,
  evs: Pick<EvidenciaDom, "id" | "titulo" | "competencias">[],
): Promise<ComMeta<RequisitoDom[]> | null> {
  if (!ia.ativa) return null;
  try {
    const r = await ia.gerarJSON(
      "extrair_requisitos",
      userId,
      {
        sistema: SISTEMA_EXTRAIR,
        nomeSchema: "requisitos_da_vaga",
        schema: RequisitosIA,
        mensagem: `${marcar("evidencias", JSON.stringify(evs.map((e) => ({ id: e.id, titulo: e.titulo, competencias: e.competencias }))))}\n\n${marcar("vaga", redigirDadosPessoais(texto))}`,
      },
      { tamanho: texto.length, evidencias: evs.length },
    );
    const ids = new Set(evs.map((e) => e.id));
    const vistos = new Set<string>();
    const lista: RequisitoDom[] = [];
    for (const q of r.dados.requisitos.slice(0, 40)) {
      const requisito = q.requisito.trim().slice(0, 300);
      const curto = q.curto.trim().slice(0, 80);
      if (!requisito || !curto) continue;
      const chave = `${q.tipo}:${curto.toLowerCase()}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      lista.push({
        id: randomUUID(),
        requisito,
        curto,
        tipo: q.tipo,
        kind: q.tipo === "formal" ? q.kind || "tempo" : null,
        obrig: q.obrig,
        // A IA só pode apontar evidências que existem e pertencem à pessoa.
        evId: q.evId && ids.has(q.evId) ? q.evId : null,
        aceita: "",
      });
    }
    if (!lista.length) {
      await ia.registrarDescarte("extrair_requisitos", userId, r.meta, "nenhum requisito válido");
      return null;
    }
    return { valor: lista, meta: r.meta };
  } catch (e) {
    return tolerar(e);
  }
}

/* ---------- Tradutor de experiência ---------- */

const TraducaoIA = z.object({
  itens: z.array(z.object({ entrada: z.string(), competencias: z.array(z.string()), curriculo: z.string(), entrevista: z.string(), falta: z.string() })),
});

export async function traduzirIA(ia: ServicoIA, userId: string, entrada: string, area: string): Promise<ComMeta<Traducao[]> | null> {
  if (!ia.ativa) return null;
  try {
    const r = await ia.gerarJSON(
      "traduzir",
      userId,
      { sistema: SISTEMA_TRADUZIR(area), nomeSchema: "traducao_de_experiencia", schema: TraducaoIA, mensagem: marcar("experiencia", redigirDadosPessoais(entrada)) },
      { tamanho: entrada.length, itens: entrada.split(/\n+/).filter((l) => l.trim()).length },
    );
    const itens = r.dados.itens
      .filter((i) => i.entrada.trim())
      .slice(0, 20)
      .map((i) => {
        const competencias = i.competencias.map((c) => c.trim()).filter(Boolean).slice(0, 8);
        return competencias.length
          ? { entrada: i.entrada.trim(), competencias, curriculo: i.curriculo.trim(), entrevista: i.entrevista.trim(), falta: "" }
          : { entrada: i.entrada.trim(), competencias: [], curriculo: "", entrevista: "", falta: i.falta.trim() || "Detalhe a tarefa e a ferramenta usada." };
      });
    const descarte = !itens.length
      ? "sem itens"
      : itens.some((i) => i.competencias.length && (!i.curriculo || !i.entrevista))
        ? "item sem frase de currículo ou de entrevista"
        : violaPrincipios(itens.map((i) => `${i.curriculo} ${i.entrevista}`))
          ? "violou princípios"
          : null;
    if (descarte) {
      await ia.registrarDescarte("traduzir", userId, r.meta, descarte);
      return null;
    }
    return { valor: itens, meta: r.meta };
  } catch (e) {
    return tolerar(e);
  }
}

/* ---------- História STAR ---------- */

const HistoriaIA = z.object({ situacao: z.string(), tarefa: z.string(), acao: z.string(), resultado: z.string() });

export async function historiaIA(ia: ServicoIA, userId: string, pergunta: string, ev: EvidenciaDom) {
  if (!ia.ativa) return null;
  try {
    const dados = { titulo: ev.titulo, tipo: ev.tipo, competencias: ev.competencias, problema: ev.problema, fez: ev.fez, ferramentas: ev.ferramentas, resultado: ev.resultado };
    const json = redigirDadosPessoais(JSON.stringify(dados));
    const r = await ia.gerarJSON(
      "historia",
      userId,
      { sistema: SISTEMA_HISTORIA, nomeSchema: "historia_star", schema: HistoriaIA, mensagem: `${marcar("pergunta", pergunta)}\n\n${marcar("evidencia", json)}` },
      { tamanho: json.length },
    );
    const h = { situacao: r.dados.situacao.trim(), tarefa: r.dados.tarefa.trim(), acao: r.dados.acao.trim(), resultado: r.dados.resultado.trim() };
    if (!h.situacao || !h.tarefa || !h.acao || !h.resultado || violaPrincipios(Object.values(h))) {
      await ia.registrarDescarte("historia", userId, r.meta, "campo vazio ou violou princípios");
      return null;
    }
    return { valor: h, meta: r.meta };
  } catch (e) {
    return tolerar(e);
  }
}

/* ---------- Feedback de resposta ---------- */

const FeedbackIA = z.object({ clareza: z.string(), objetividade: z.string(), sugestoes: z.array(z.string()) });

export async function feedbackIA(ia: ServicoIA, userId: string, pergunta: string, resposta: string) {
  if (!ia.ativa) return null;
  try {
    const r = await ia.gerarJSON(
      "feedback",
      userId,
      {
        sistema: SISTEMA_FEEDBACK,
        nomeSchema: "feedback_entrevista",
        schema: FeedbackIA,
        mensagem: `${marcar("pergunta", pergunta)}\n\n${marcar("resposta", redigirDadosPessoais(resposta))}`,
      },
      { tamanho: resposta.length },
    );
    const sugestoes = r.dados.sugestoes.map((s) => s.trim()).filter(Boolean).slice(0, 3);
    if (!r.dados.clareza.trim() || !r.dados.objetividade.trim() || !sugestoes.length || violaPrincipios([r.dados.clareza, r.dados.objetividade, ...sugestoes])) {
      await ia.registrarDescarte("feedback", userId, r.meta, "campo vazio ou violou princípios");
      return null;
    }
    return { valor: { clareza: r.dados.clareza.trim(), objetividade: r.dados.objetividade.trim(), sugestoes }, meta: r.meta };
  } catch (e) {
    return tolerar(e);
  }
}

/* ---------- Importação de currículo ---------- */

const ImportacaoIA = z.object({
  evidencias: z.array(
    z.object({
      titulo: z.string(),
      tipo: z.enum(TIPOS_EVIDENCIA),
      concluido: z.boolean(),
      link: z.string(),
      competencias: z.array(z.string()),
      problema: z.string(),
      fez: z.string(),
      ferramentas: z.string(),
      resultado: z.string(),
    }),
  ),
});

/**
 * Propõe rascunhos de evidências a partir de um documento. Não há alternativa
 * por regras: lança ErroIA quando a IA não está disponível.
 */
export async function importarCurriculoIA(ia: ServicoIA, userId: string, documento: string, area: string): Promise<ComMeta<EvidenciaInput[]>> {
  const limpo = redigirDadosPessoais(documento);
  const r = await ia.gerarJSON(
    "importar_cv",
    userId,
    { sistema: SISTEMA_IMPORTAR_CV, nomeSchema: "evidencias_do_documento", schema: ImportacaoIA, mensagem: `Área de destino: ${area}\n\n${marcar("documento", limpo)}` },
    { tamanho: limpo.length },
  );
  // Links precisam aparecer literalmente no documento: a IA não pode criá-los.
  const linkOk = (l: string) => (/^https?:\/\/[^\s]+\.[^\s]+/i.test(l.trim()) && documento.includes(l.trim()) ? l.trim() : "");
  const valor = r.dados.evidencias
    .filter((e) => e.titulo.trim())
    .slice(0, 12)
    .map((e) => ({
      titulo: e.titulo.trim().slice(0, 140),
      tipo: e.tipo,
      // "Concluído" só faz sentido para curso e certificado.
      concluido: (e.tipo === "Curso" || e.tipo === "Certificado") && e.concluido,
      link: linkOk(e.link),
      competencias: [...new Set(e.competencias.map((c) => c.trim().slice(0, 60)).filter(Boolean))].slice(0, 15),
      problema: e.problema.trim().slice(0, 2000),
      fez: e.fez.trim().slice(0, 2000),
      ferramentas: e.ferramentas.trim().slice(0, 300),
      resultado: e.resultado.trim().slice(0, 2000),
    }));
  return { valor, meta: r.meta };
}

/** Texto curto para a interface, ex.: "Groq · gpt-oss-120b". */
export function descreverMeta(m: MetaIA): string {
  return `${m.rotulo} · ${m.modelo.replace(/^[^/]+\//, "")}`;
}
