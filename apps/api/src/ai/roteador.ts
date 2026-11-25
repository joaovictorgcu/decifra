import type { Alvo, ConfigIA } from "./config";
import type { Disjuntor } from "./disjuntor";
import type { Esforco, IdProvedor, Nivel, Sensibilidade, TarefaIA } from "./tipos";

/**
 * Roteamento determinístico: decide nível de complexidade e a ordem de
 * provedores sem chamar nenhum modelo. Considera a tarefa, o volume de
 * contexto, a necessidade de raciocínio e o impacto de um erro, não só o
 * tamanho da mensagem.
 */

export interface PerfilTarefa {
  /** Nível mínimo da tarefa. */
  nivelBase: Nivel;
  /** Quão pessoal é o conteúdo enviado. */
  sensibilidade: Sensibilidade;
  /** Impacto de uma resposta errada: alto empurra para modelos mais capazes. */
  impacto: "baixo" | "medio" | "alto";
  esforco: Record<Nivel, Esforco>;
  maxTokens: number;
}

export const PERFIS: Record<TarefaIA, PerfilTarefa> = {
  // Reformular experiências em competências: linguagem, pouco raciocínio.
  traduzir: { nivelBase: "simples", sensibilidade: "media", impacto: "baixo", esforco: { simples: "low", intermediaria: "low", complexa: "medium" }, maxTokens: 4000 },
  // Feedback de entrevista: avaliação de texto curto.
  feedback: { nivelBase: "intermediaria", sensibilidade: "media", impacto: "medio", esforco: { simples: "low", intermediaria: "low", complexa: "medium" }, maxTokens: 3000 },
  // Extração e classificação de requisitos: alimenta a decisão do Raio-X (erro custa caro).
  extrair_requisitos: { nivelBase: "intermediaria", sensibilidade: "baixa", impacto: "alto", esforco: { simples: "low", intermediaria: "low", complexa: "medium" }, maxTokens: 6000 },
  // História STAR: escrita fiel aos dados da evidência.
  historia: { nivelBase: "intermediaria", sensibilidade: "media", impacto: "medio", esforco: { simples: "low", intermediaria: "medium", complexa: "medium" }, maxTokens: 3000 },
  // Currículo: dados pessoais, documento longo, não pode inventar nada.
  importar_cv: { nivelBase: "intermediaria", sensibilidade: "alta", impacto: "alto", esforco: { simples: "low", intermediaria: "medium", complexa: "medium" }, maxTokens: 12000 },
  // Mentor: varia de dúvida simples a plano de transição.
  mentor: { nivelBase: "intermediaria", sensibilidade: "alta", impacto: "medio", esforco: { simples: "low", intermediaria: "medium", complexa: "medium" }, maxTokens: 4000 },
};

/** Sinais objetivos que a rota HTTP conhece e que influenciam a complexidade. */
export interface Sinais {
  /** Tamanho do texto principal (vaga, documento, experiência), em caracteres. */
  tamanho?: number;
  /** Quantidade de itens/linhas a processar (ex.: funções no Tradutor). */
  itens?: number;
  /** Evidências no contexto (cruzamento). */
  evidencias?: number;
  /** Vagas analisadas no contexto. */
  vagas?: number;
  /** Mensagem atual do Mentor. */
  mensagem?: string;
  /** Mensagens anteriores na conversa. */
  turnos?: number;
}

const SUBIR: Record<Nivel, Nivel> = { simples: "intermediaria", intermediaria: "complexa", complexa: "complexa" };
const ORDEM: Nivel[] = ["simples", "intermediaria", "complexa"];
const maior = (a: Nivel, b: Nivel) => (ORDEM.indexOf(a) >= ORDEM.indexOf(b) ? a : b);

// Pedidos que exigem cruzar o contexto da pessoa e raciocinar sobre o caminho dela.
const INTENCAO_COMPLEXA =
  /\b(plano|planej|estrat[eé]g|roteiro|cronograma|prioriz|compar|analis|avali|revis|diagn[oó]stic|transi[cç][aã]o|por onde come[cç]|pr[oó]ximos? passos?|o que (eu )?(devo|fa[cç]o|preciso)|minhas? (vagas|evid[eê]ncias|lacunas|candidaturas)|lacuna|semanas?|meses|entrevista (amanh|semana)|me prepar)/i;
// Dúvidas conceituais ou de uso da plataforma: não dependem do contexto pessoal.
const INTENCAO_SIMPLES =
  /^(o que [eé]|o que significa|o que quer dizer|qual a diferen[cç]a|explique|explica|me explica|defin|como funciona|como (eu )?uso|onde (fica|encontro|vejo)|reformul|reescrev|traduz|corrig|resuma|resume|obrigad|valeu|ok\b|oi\b|ol[aá]\b|bom dia|boa (tarde|noite))/i;

/** Decide o nível de complexidade da chamada. Puro e testável. */
export function classificar(tarefa: TarefaIA, s: Sinais = {}): Nivel {
  const p = PERFIS[tarefa];
  let n = p.nivelBase;
  switch (tarefa) {
    case "traduzir":
      if ((s.itens ?? 0) > 8 || (s.tamanho ?? 0) > 1500) n = SUBIR[n];
      break;
    case "extrair_requisitos":
      // Vagas longas ou com muitas evidências para cruzar pedem mais raciocínio.
      if ((s.tamanho ?? 0) > 6000 || ((s.evidencias ?? 0) >= 15 && (s.tamanho ?? 0) > 2500)) n = "complexa";
      break;
    case "importar_cv":
      if ((s.tamanho ?? 0) > 5000) n = "complexa";
      break;
    case "historia":
    case "feedback":
      if ((s.tamanho ?? 0) > 1800) n = "complexa";
      break;
    case "mentor": {
      const m = (s.mensagem ?? "").trim();
      const contextoRico = (s.evidencias ?? 0) >= 3 || (s.vagas ?? 0) >= 2;
      if (INTENCAO_COMPLEXA.test(m) && (contextoRico || m.length > 280)) n = "complexa";
      else if (m.length > 700 || (s.turnos ?? 0) > 16) n = "complexa";
      else if (INTENCAO_SIMPLES.test(m) && m.length <= 220 && !INTENCAO_COMPLEXA.test(m)) n = "simples";
      else n = "intermediaria";
      break;
    }
  }
  if (p.impacto === "alto") n = maior(n, "intermediaria");
  return n;
}

/** Provedor permitido para o nível de sensibilidade, conforme a política de privacidade configurada. */
export function permitido(cfg: ConfigIA, provedor: IdProvedor, sens: Sensibilidade): boolean {
  if (cfg.privacidade === "aberta") return true;
  const restrito = sens === "alta" || (cfg.privacidade === "estrita" && sens === "media");
  if (!restrito) return true;
  if (cfg.confiaveis) return cfg.confiaveis.has(provedor);
  const p = cfg.provedores.get(provedor);
  return !!p && p.privacidade !== "pode_treinar";
}

export interface PlanoRota {
  nivel: Nivel;
  /** Alvos na ordem de tentativa, já com modelo resolvido. */
  alvos: Required<Alvo>[];
  /** Alvos removidos pela política de privacidade. */
  vetadosPrivacidade: IdProvedor[];
  /** Alvos em pausa pelo disjuntor, com o horário de liberação. */
  emPausa: { provedor: IdProvedor; ate: number }[];
}

/** Monta a ordem de tentativa para uma chamada. */
export function planejar(cfg: ConfigIA, tarefa: TarefaIA, nivel: Nivel, disjuntor: Disjuntor, agora: number): PlanoRota {
  const sens = PERFIS[tarefa].sensibilidade;
  const base = cfg.rotasTarefa[tarefa] ?? cfg.rotas[nivel];
  const vistos = new Set<string>();
  const alvos: Required<Alvo>[] = [];
  const vetados: IdProvedor[] = [];
  const pausa: { provedor: IdProvedor; ate: number }[] = [];
  for (const a of base) {
    const p = cfg.provedores.get(a.provedor);
    if (!p) continue;
    const modelo = a.modelo ?? p.modelos[nivel];
    const chave = `${a.provedor}:${modelo}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    if (!permitido(cfg, a.provedor, sens)) {
      vetados.push(a.provedor);
      continue;
    }
    const ate = disjuntor.pausadoAte(a.provedor, agora);
    if (ate) {
      pausa.push({ provedor: a.provedor, ate });
      continue;
    }
    alvos.push({ provedor: a.provedor, modelo });
  }
  return { nivel, alvos, vetadosPrivacidade: vetados, emPausa: pausa };
}
