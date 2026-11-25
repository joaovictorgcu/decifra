import type { EvidenciaInput, Traducao } from "@decifra/shared";
import { TIPOS_EVIDENCIA } from "@decifra/shared";
import { z } from "zod";
import { violaPrincipios } from "../domain/regras";
import type { EvidenciaDom, RequisitoDom } from "../domain/tipos";
import { randomUUID } from "node:crypto";
import {
  SISTEMA_EXTRAIR,
  SISTEMA_FEEDBACK,
  SISTEMA_HISTORIA,
  SISTEMA_IMPORTAR_CV,
  SISTEMA_TRADUZIR,
  marcar,
} from "./prompts";
import type { ServicoIA } from "./servico";

/**
 * Tarefas de IA do produto. Cada função devolve `null` quando a IA não está
 * disponível ou a resposta não passa na validação; quem chama aplica o motor
 * de regras como fallback. Saídas da IA nunca são usadas sem validação.
 */

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
): Promise<RequisitoDom[] | null> {
  if (!ia.ativa) return null;
  try {
    const r = await ia.gerarJSON("extrair_requisitos", userId, {
      sistema: SISTEMA_EXTRAIR,
      nomeSchema: "requisitos_da_vaga",
      schema: RequisitosIA,
      mensagem: `${marcar("evidencias", JSON.stringify(evs.map((e) => ({ id: e.id, titulo: e.titulo, competencias: e.competencias }))))}\n\n${marcar("vaga", texto)}`,
    });
    const ids = new Set(evs.map((e) => e.id));
    const vistos = new Set<string>();
    const lista: RequisitoDom[] = [];
    for (const q of r.requisitos.slice(0, 40)) {
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
        kind: q.tipo === "formal" ? (q.kind || "tempo") : null,
        obrig: q.obrig,
        // A IA só pode apontar evidências que existem e pertencem à pessoa.
        evId: q.evId && ids.has(q.evId) ? q.evId : null,
        aceita: "",
      });
    }
    return lista.length ? lista : null;
  } catch {
    return null;
  }
}

/* ---------- Tradutor de experiência ---------- */

const TraducaoIA = z.object({
  itens: z.array(
    z.object({
      entrada: z.string(),
      competencias: z.array(z.string()),
      curriculo: z.string(),
      entrevista: z.string(),
      falta: z.string(),
    }),
  ),
});

export async function traduzirIA(ia: ServicoIA, userId: string, entrada: string, area: string): Promise<Traducao[] | null> {
  if (!ia.ativa) return null;
  try {
    const r = await ia.gerarJSON("traduzir", userId, {
      sistema: SISTEMA_TRADUZIR(area),
      nomeSchema: "traducao_de_experiencia",
      schema: TraducaoIA,
      mensagem: marcar("experiencia", entrada),
    });
    const itens = r.itens
      .filter((i) => i.entrada.trim())
      .slice(0, 20)
      .map((i) => {
        const competencias = i.competencias.map((c) => c.trim()).filter(Boolean).slice(0, 8);
        return competencias.length
          ? { entrada: i.entrada.trim(), competencias, curriculo: i.curriculo.trim(), entrevista: i.entrevista.trim(), falta: "" }
          : { entrada: i.entrada.trim(), competencias: [], curriculo: "", entrevista: "", falta: i.falta.trim() || "Detalhe a tarefa e a ferramenta usada." };
      });
    if (!itens.length) return null;
    if (itens.some((i) => i.competencias.length && (!i.curriculo || !i.entrevista))) return null;
    if (violaPrincipios(itens.map((i) => `${i.curriculo} ${i.entrevista}`))) return null;
    return itens;
  } catch {
    return null;
  }
}

/* ---------- História STAR ---------- */

const HistoriaIA = z.object({ situacao: z.string(), tarefa: z.string(), acao: z.string(), resultado: z.string() });

export async function historiaIA(ia: ServicoIA, userId: string, pergunta: string, ev: EvidenciaDom) {
  if (!ia.ativa) return null;
  try {
    const dados = {
      titulo: ev.titulo,
      tipo: ev.tipo,
      competencias: ev.competencias,
      problema: ev.problema,
      fez: ev.fez,
      ferramentas: ev.ferramentas,
      resultado: ev.resultado,
    };
    const r = await ia.gerarJSON("historia", userId, {
      sistema: SISTEMA_HISTORIA,
      nomeSchema: "historia_star",
      schema: HistoriaIA,
      mensagem: `${marcar("pergunta", pergunta)}\n\n${marcar("evidencia", JSON.stringify(dados))}`,
    });
    const h = { situacao: r.situacao.trim(), tarefa: r.tarefa.trim(), acao: r.acao.trim(), resultado: r.resultado.trim() };
    if (!h.situacao || !h.tarefa || !h.acao || !h.resultado) return null;
    if (violaPrincipios(Object.values(h))) return null;
    return h;
  } catch {
    return null;
  }
}

/* ---------- Feedback de resposta ---------- */

const FeedbackIA = z.object({ clareza: z.string(), objetividade: z.string(), sugestoes: z.array(z.string()) });

export async function feedbackIA(ia: ServicoIA, userId: string, pergunta: string, resposta: string) {
  if (!ia.ativa) return null;
  try {
    const r = await ia.gerarJSON("feedback", userId, {
      sistema: SISTEMA_FEEDBACK,
      nomeSchema: "feedback_entrevista",
      schema: FeedbackIA,
      mensagem: `${marcar("pergunta", pergunta)}\n\n${marcar("resposta", resposta)}`,
    });
    const sugestoes = r.sugestoes.map((s) => s.trim()).filter(Boolean).slice(0, 3);
    if (!r.clareza.trim() || !r.objetividade.trim() || !sugestoes.length) return null;
    if (violaPrincipios([r.clareza, r.objetividade, ...sugestoes])) return null;
    return { clareza: r.clareza.trim(), objetividade: r.objetividade.trim(), sugestoes };
  } catch {
    return null;
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

/** Propõe rascunhos de evidências a partir de um documento. Lança ErroIA se a IA estiver desativada ou falhar. */
export async function importarCurriculoIA(ia: ServicoIA, userId: string, documento: string, area: string): Promise<EvidenciaInput[]> {
  const r = await ia.gerarJSON("importar_cv", userId, {
    sistema: SISTEMA_IMPORTAR_CV,
    nomeSchema: "evidencias_do_documento",
    schema: ImportacaoIA,
    mensagem: `Área de destino: ${area}\n\n${marcar("documento", documento)}`,
  });
  const linkOk = (l: string) => (/^https?:\/\/[^\s]+\.[^\s]+/i.test(l.trim()) && documento.includes(l.trim()) ? l.trim() : "");
  return r.evidencias
    .filter((e) => e.titulo.trim())
    .slice(0, 12)
    .map((e) => ({
      titulo: e.titulo.trim().slice(0, 140),
      tipo: e.tipo,
      concluido: e.concluido,
      // Links precisam aparecer literalmente no documento: a IA não pode criá-los.
      link: linkOk(e.link),
      competencias: [...new Set(e.competencias.map((c) => c.trim().slice(0, 60)).filter(Boolean))].slice(0, 15),
      problema: e.problema.trim().slice(0, 2000),
      fez: e.fez.trim().slice(0, 2000),
      ferramentas: e.ferramentas.trim().slice(0, 300),
      resultado: e.resultado.trim().slice(0, 2000),
    }));
}
