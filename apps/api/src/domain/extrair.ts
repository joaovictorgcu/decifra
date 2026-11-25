import { randomUUID } from "node:crypto";
import { CATALOGO, FORMAL, type ItemCatalogo } from "./catalogo";
import { mai, norm, semPonto } from "./texto";
import type { RequisitoDom } from "./tipos";

const INI = /^(requisitos|qualificacoes|responsabilidades|atividades|atribuicoes|o que (buscamos|esperamos)|perfil|voce)/;
const DES = /^(diferenciais?|desejave(l|is)|sera um diferencial)/;
const FORA = /^(beneficios|sobre( a empresa| nos)?\b|o que oferecemos|oferecemos|remuneracao|salario|local\b)/;

/**
 * Motor de regras: extrai requisitos de uma descrição de vaga.
 * Reconhece seções (requisitos, diferenciais, benefícios), separa exigências
 * formais (tempo, diploma, certificação) de competências e marca diferenciais
 * como desejáveis. É o fallback determinístico quando a IA não está disponível.
 */
export function extrairRequisitos(texto: string): RequisitoDom[] {
  const linhas = String(texto)
    .split(/\n+/)
    .map((l) => l.replace(/^[\s#>*•-]+/, "").trim())
    .filter(Boolean);
  let pular = linhas.some((l) => INI.test(norm(l)) || DES.test(norm(l)));
  let des = false;
  const vistos = new Set<string>();
  const lista: RequisitoDom[] = [];

  for (let limpa of linhas) {
    const n = norm(limpa);
    if (FORA.test(n)) {
      pular = true;
      continue;
    }
    if (DES.test(n)) {
      pular = false;
      des = true;
      limpa = limpa.replace(/^[^:]{0,40}:\s*/, "");
      if (/^(diferenciais?|desejave(l|is)):?$/.test(norm(limpa))) continue;
    } else if (INI.test(n)) {
      pular = false;
      des = false;
      limpa = limpa.replace(/^[^:]{0,40}:\s*/, "");
      if (INI.test(norm(limpa)) && limpa.length < 30) continue;
    }
    if (pular || !limpa) continue;

    for (const s of limpa.split(/;|\.\s+/)) {
      const seg = semPonto(s);
      if (!seg) continue;
      const ns = norm(seg);
      const opcional = des || /desejavel|diferencial/.test(ns);
      const achados: ({ f: (typeof FORMAL)[number] } | { c: ItemCatalogo })[] = [];
      for (const f of FORMAL) if (f.re.test(ns)) achados.push({ f });
      for (const c of CATALOGO) if (c.re.test(ns)) achados.push({ c });

      for (const a of achados) {
        const chave = "f" in a ? `f:${a.f.tipo}` : a.c.c;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        if ("f" in a) {
          lista.push({ id: randomUUID(), requisito: seg, curto: seg, tipo: "formal", kind: a.f.tipo, obrig: !opcional, evId: null, aceita: "" });
        } else {
          lista.push({
            id: randomUUID(),
            requisito: achados.length === 1 && seg.length <= 90 ? seg : mai(a.c.c),
            curto: a.c.c,
            tipo: a.c.t,
            kind: null,
            obrig: !opcional,
            evId: null,
            aceita: "",
          });
        }
      }
    }
  }
  return lista;
}

/** Expressão usada para achar uma competência nas evidências do candidato. */
export function reCompetencia(curto: string): RegExp {
  const n = norm(curto);
  const item = CATALOGO.find((x) => x.c === curto || x.re.test(n));
  if (item) return item.rep ?? item.re;
  return new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}
