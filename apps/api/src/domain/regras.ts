import type { DiagnosticoInput, EtapaTransicao, Traducao } from "@decifra/shared";
import { TROCAS } from "./catalogo";
import { juntar, mai, norm, semPonto } from "./texto";
import type { EvidenciaDom } from "./tipos";

/** Classifica a etapa da transição a partir do diagnóstico (regra do protótipo). */
export function classificarEtapa(p: Pick<DiagnosticoInput, "candidatou" | "tempo" | "atrapalha">): EtapaTransicao {
  const a = p.atrapalha as string[];
  if (p.candidatou === "sim" || a.includes("Pouco retorno das empresas")) return "Buscando a vaga";
  if (p.tempo === "0a6" || a.includes("Não sei por onde começar") || a.includes("Não sei qual área escolher")) return "Definindo o caminho";
  return "Construindo a base";
}

/** Tradutor por regras: usa só o que a pessoa escreveu e nunca inventa competência. */
export function traduzirPorRegras(entrada: string): Traducao[] {
  return entrada
    .split(/\n+/)
    .map((l) => semPonto(l.replace(/^\s*[-•*]\s*/, "")))
    .filter(Boolean)
    .map((l) => {
      const n = norm(l);
      let comps: string[] = [];
      if (/\bmetas?\b/.test(n) && /planilha/.test(n)) comps = ["análise de indicadores", "organização de dados", "comunicação de resultados"];
      else for (const t of TROCAS) if (t.re.test(n) && !comps.includes(t.para)) comps.push(t.para);
      if (!comps.length) {
        return {
          entrada: mai(l),
          competencias: [],
          curriculo: "",
          entrevista: "",
          falta: "Descreva o que você fazia, com a tarefa e a ferramenta, para eu encontrar a competência sem inventar nada.",
        };
      }
      return {
        entrada: mai(l),
        competencias: comps,
        curriculo: `${mai(l)}, com foco em ${juntar(comps)}. Acrescente números apenas se puder comprová-los.`,
        entrevista: `Conte uma situação real desta função: qual era o problema, o que você fez e o que mudou. Ligue a história a ${comps[0]}.`,
        falta: "",
      };
    });
}

/** História STAR montada só com os dados da evidência; o que falta fica marcado. */
export function historiaPorRegras(ev: EvidenciaDom) {
  const f = (v: string, c: string) => v || `[Complete na evidência: ${c}]`;
  return {
    situacao: f(ev.problema, "qual era o problema ou contexto"),
    tarefa: `Eu precisava resolver isso com ${(ev.competencias || []).join(", ") || "as competências desta evidência"}.`,
    acao: f(ev.fez, "o que você fez") + (ev.ferramentas ? ` Usei ${ev.ferramentas}.` : ""),
    resultado: f(ev.resultado, "o resultado que você consegue demonstrar"),
  };
}

/** Feedback por regras sobre clareza e objetividade de uma resposta de entrevista. */
export function feedbackPorRegras(t: string) {
  const n = norm(t);
  const pal = t.trim().split(/\s+/).filter(Boolean).length;
  const frases = t.split(/[.!?]+/).filter((s) => s.trim()).length || 1;
  const media = Math.round(pal / frases);
  const itens: string[] = [];
  const clareza =
    media <= 25
      ? "Boa clareza: as frases têm tamanho fácil de acompanhar."
      : `Suas frases estão longas, com cerca de ${media} palavras cada. Divida em frases menores.`;
  const objetividade =
    pal < 40
      ? "Resposta curta. Inclua o contexto, o que você fez e o resultado."
      : pal > 180
        ? "Resposta longa para uma entrevista. Busque até cerca de 150 palavras."
        : "Tamanho adequado para uma resposta falada.";
  if (!/\beu\b|fiz|criei|organizei|analisei|montei|preparei|acompanhei/.test(n)) itens.push("Deixe claro o que você fez, falando em primeira pessoa.");
  if (!/result|reduz|aument|melhor|consegui|entreg|\d/.test(n)) itens.push("Termine com o resultado, usando apenas o que você consegue demonstrar.");
  if (/\b(tipo assim|meio que|sei la|ne\b)/.test(n)) itens.push("Retire muletas como “tipo assim” e “sei lá”.");
  if (!itens.length) itens.push("Treine em voz alta e cronometre para chegar perto de 1 minuto e meio.");
  return { clareza, objetividade, sugestoes: itens };
}

/**
 * Guarda de conteúdo para respostas de IA: bloqueia promessas de contratação,
 * afirmações sobre a política da empresa e a recomendação genérica de "fazer um curso".
 */
export function violaPrincipios(textos: string[]): boolean {
  return textos.some((t) => {
    const n = norm(t);
    return (
      /faca (um |uma )?(curso|bootcamp)/.test(n) ||
      /(garant|voce sera contratad)/.test(n) ||
      (/a empresa (aceita|vai aceitar)/.test(n) && !/se a empresa/.test(n))
    );
  });
}
