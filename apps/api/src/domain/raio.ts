import type { Acao, Decisao, ItemRadar, RaioX, RequisitoAvaliado } from "@decifra/shared";
import { MINIS } from "./catalogo";
import { reCompetencia } from "./extrair";
import { juntar, mai, norm } from "./texto";
import type { EvidenciaDom, RequisitoDom, VagaDom } from "./tipos";

export const NADA = "Nada no seu Banco de Evidências ainda";

/* ---------- Qualidade de uma evidência ---------- */

export function completa(e: EvidenciaDom): boolean {
  return !!(e.problema && e.fez && e.ferramentas && e.resultado);
}

export function faltas(e: EvidenciaDom): string[] {
  const f: string[] = [];
  if (!e.problema) f.push("o problema que você resolveu");
  if (!e.fez) f.push("o que você fez");
  if (!e.ferramentas) f.push("as ferramentas usadas");
  if (!e.resultado) f.push("o resultado");
  if (e.tipo === "Projeto" && !e.link) f.push("um link público");
  return f;
}

/** 3 = sustenta o requisito; 2 = existe, mas ainda precisa ser mostrada. */
export function grau(e: EvidenciaDom): number {
  if (e.tipo === "Curso" || e.tipo === "Certificado") return e.concluido ? 3 : 2;
  return completa(e) ? 3 : 2;
}

function textoEv(e: EvidenciaDom): string {
  return norm([(e.competencias || []).join(" "), e.titulo, e.fez, e.ferramentas].join(" "));
}

/* ---------- Cruzamento requisito x evidências ---------- */

function notaFormal(req: RequisitoDom): string {
  if (req.aceita === "sim") return "A empresa informou que aceita experiência aplicada no lugar desta exigência.";
  if (req.aceita === "nao") return "A empresa informou que esta exigência é eliminatória.";
  return req.kind === "tempo"
    ? "Pode ser compensada com experiência aplicada. Verifique com a empresa se isso é considerado."
    : "Pode ser compensada com projetos e experiência aplicada. Pergunte à empresa se é eliminatória.";
}

export function cruzar(req: RequisitoDom, evs: EvidenciaDom[]): RequisitoAvaliado {
  if (req.tipo === "formal") {
    return { ...req, situacao: "formal", evidencia: "Não se aplica", evidenciaId: null, nota: notaFormal(req) };
  }
  const re = reCompetencia(req.curto);
  let melhor: EvidenciaDom | null = null;
  for (const e of evs) {
    if (req.evId === e.id || re.test(textoEv(e))) {
      if (!melhor || grau(e) > grau(melhor)) melhor = e;
    }
  }
  if (!melhor) return { ...req, situacao: "nao_tem", evidencia: NADA, evidenciaId: null, nota: "" };
  return {
    ...req,
    situacao: grau(melhor) >= 3 ? "comprova" : "tem_precisa_mostrar",
    evidencia: melhor.titulo,
    evidenciaId: melhor.id,
    nota: "",
  };
}

/* ---------- Decisão ---------- */

export function decidir(reqs: RequisitoAvaliado[]): Decisao {
  const base = reqs.filter((r) => r.tipo !== "formal" && r.obrig);
  if (!base.length) return "prepare_evidencias";
  const tec = base.filter((r) => r.tipo === "tecnica");
  const x = base.filter((r) => r.situacao === "nao_tem");
  if (base.every((r) => r.situacao === "comprova")) return "candidate_agora";
  if (!x.length) return "prepare_evidencias";
  const unica = x[0]!;
  if (x.length === 1 && !(unica.tipo === "tecnica" && tec.indexOf(unica) < 2)) return "prepare_evidencias";
  return x.length * 2 >= base.length ? "busque_compativel" : "prepare_evidencias";
}

export function justificar(reqs: RequisitoAvaliado[], d: Decisao): [string, string] {
  const ob = reqs.filter((r) => r.obrig);
  const nomes = (s: RequisitoAvaliado["situacao"]) => ob.filter((r) => r.situacao === s).map((r) => r.curto);
  const c = nomes("comprova");
  const t = nomes("tem_precisa_mostrar");
  const x = nomes("nao_tem");
  const fo = ob.find((r) => r.tipo === "formal");
  const cita = fo ? `“${fo.curto}”` : "";
  const fFormal =
    fo?.aceita === "sim"
      ? `${cita} é uma exigência formal, e a empresa informou que aceita experiência aplicada no lugar dela.`
      : `${cita} é uma exigência formal, e não falta de competência, então vale reunir experiência aplicada e verificar com a empresa se ela é considerada.`;
  let f1: string;
  let f2: string;

  if (d === "candidate_agora") {
    f1 = `Você comprova ${juntar(c)}, que é o que esta vaga pede em competências.`;
    f2 = fo ? fFormal : "Deixe essas evidências visíveis no seu Perfil ao se candidatar.";
  } else if (d === "busque_compativel") {
    f1 = `${mai(juntar(x))}${x.length > 1 ? " ainda não aparecem" : " ainda não aparece"} nas suas evidências, e isso é boa parte do que a vaga pede.`;
    const tem = c.concat(t);
    f2 = tem.length
      ? `Procure vagas centradas em ${juntar(tem)}, onde o que você já tem conta mais.`
      : "Procure vagas mais próximas do que você já fez e guarde esta como referência do que desenvolver.";
  } else if (!c.length && !t.length && !x.length) {
    f1 = fo
      ? `Só identifiquei exigências formais obrigatórias nesta vaga, como ${cita}.`
      : "Não identifiquei competências obrigatórias nesta vaga.";
    f2 = "Verifique com a empresa se experiência aplicada é considerada e reúna evidências do que você já fez.";
  } else {
    f1 = c.length
      ? `Você comprova ${juntar(c)}${t.length ? ` e tem base em ${juntar(t)}` : ""}`
      : t.length
        ? `Você tem base em ${juntar(t)}`
        : "Você já cobre parte do que a vaga pede";
    if (t.length) f1 += `, mas ainda precisa mostrar ${t.length > 1 ? "essas competências" : "essa competência"} com evidências concretas`;
    if (x.length) f1 += `${t.length ? ", e " : ", mas "}${juntar(x)}${x.length > 1 ? " ainda não aparecem" : " ainda não aparece"} nas suas evidências`;
    f1 += ".";
    f2 = fo ? fFormal : "Com essas evidências organizadas, sua candidatura responde melhor ao que a vaga pede.";
  }
  return [f1, f2];
}

/* ---------- Próximos passos ---------- */

export function miniDe(curto: string): string {
  return MINIS[curto] ?? `Faça em até 1 semana um mini-projeto de ${curto} com um cenário parecido com o desta vaga`;
}

export function acoesDe(reqs: RequisitoAvaliado[], evs: EvidenciaDom[]): Acao[] {
  const ob = reqs.filter((r) => r.obrig);
  const formal = ob.find((r) => r.tipo === "formal");
  const base = ob.filter((r) => r.tipo !== "formal");
  const lim = formal ? 2 : 3;
  const out: Acao[] = [];
  const ordem = base
    .filter((r) => r.situacao === "nao_tem" && r.tipo === "tecnica")
    .concat(base.filter((r) => r.situacao === "tem_precisa_mostrar"));

  for (const r of ordem) {
    if (out.length >= lim) break;
    if (r.situacao === "nao_tem") {
      out.push({ texto: `${miniDe(r.curto)} e registre como evidência.`, tipo: "mini", comp: r.curto, evId: "" });
      continue;
    }
    const ev = evs.find((e) => e.id === r.evidenciaId);
    if (!ev) continue;
    if (ev.tipo === "Projeto") {
      out.push({ texto: `Documente seu projeto de ${r.curto} no portfólio, com o problema, os dados usados e o resultado.`, tipo: "doc", comp: "", evId: ev.id });
    } else if (ev.tipo === "Caso da carreira anterior") {
      out.push({ texto: `Prepare um caso de ${r.curto} a partir de “${ev.titulo}”, com o problema, o que você fez e o resultado.`, tipo: "doc", comp: "", evId: ev.id });
    } else {
      out.push({ texto: `Conclua “${ev.titulo}” e aplique ${r.curto} em um mini-projeto ligado a esta vaga.`, tipo: "doc", comp: "", evId: ev.id });
    }
  }
  if (formal && formal.aceita !== "sim") {
    out.push({
      texto:
        formal.kind === "tempo"
          ? "Verifique com a empresa se ela aceita experiência aplicada no lugar do tempo formal de atuação."
          : `Pergunte à empresa se projetos e experiência aplicada podem ser considerados no lugar de “${formal.curto}”.`,
      tipo: "verificar",
      comp: "",
      evId: "",
    });
  }
  if (!out.length) {
    out.push({ texto: "Envie sua candidatura com o link do seu Perfil de Evidências, na ordem dos requisitos desta vaga.", tipo: "verificar", comp: "", evId: "" });
  }
  return out.slice(0, 3);
}

/** Raio-X completo de uma vaga: situação de cada requisito, decisão, justificativa e ações. */
export function raio(vaga: Pick<VagaDom, "reqs">, evs: EvidenciaDom[]): RaioX {
  const reqs = vaga.reqs.map((r) => cruzar(r, evs));
  const decisao = decidir(reqs);
  return { reqs, decisao, justificativa: justificar(reqs, decisao), acoes: acoesDe(reqs, evs) };
}

/* ---------- Radar ---------- */

const ORDEM_DECISAO: Decisao[] = ["busque_compativel", "prepare_evidencias", "candidate_agora"];

/**
 * Agrega os requisitos das vagas salvas e estima, para cada lacuna, em quantas
 * vagas a situação melhoraria se ela fosse resolvida com uma evidência completa.
 */
export function radar(vagas: VagaDom[], evs: EvidenciaDom[]): ItemRadar[] {
  const m = new Map<string, ItemRadar>();
  for (const v of vagas) {
    for (const r of raio(v, evs).reqs) {
      if (r.tipo === "formal") continue;
      const i = m.get(r.curto) ?? { curto: r.curto, tipo: r.tipo, vagas: 0, obrig: 0, situacao: r.situacao, nomes: [], ganho: 0 };
      i.vagas++;
      if (r.obrig) i.obrig++;
      i.nomes.push(v.titulo);
      m.set(r.curto, i);
    }
  }
  const lista = [...m.values()].sort((a, b) => b.obrig - a.obrig || b.vagas - a.vagas);
  for (const i of lista) {
    if (i.situacao === "comprova") continue;
    // Simulação interna (não persistida): a lacuna resolvida com uma evidência completa.
    const hipotetica: EvidenciaDom = {
      id: "__simulacao__",
      titulo: i.curto,
      tipo: "Projeto",
      concluido: true,
      link: "",
      competencias: [i.curto],
      problema: "x",
      fez: "x",
      ferramentas: "x",
      resultado: "x",
    };
    i.ganho = vagas.filter((v) => {
      const antes = raio(v, evs);
      const depois = raio(v, evs.concat([hipotetica]));
      const somaA = antes.reqs.filter((r) => r.situacao === "comprova").length;
      const somaD = depois.reqs.filter((r) => r.situacao === "comprova").length;
      return (
        ORDEM_DECISAO.indexOf(depois.decisao) > ORDEM_DECISAO.indexOf(antes.decisao) ||
        (somaD > somaA && v.reqs.some((r) => r.curto === i.curto && r.obrig))
      );
    }).length;
  }
  return lista;
}
