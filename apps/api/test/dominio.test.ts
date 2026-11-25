import { describe, expect, it } from "vitest";
import { extrairRequisitos } from "../src/domain/extrair";
import { acoesDe, completa, cruzar, decidir, faltas, raio, radar } from "../src/domain/raio";
import { classificarEtapa, feedbackPorRegras, historiaPorRegras, traduzirPorRegras, violaPrincipios } from "../src/domain/regras";
import type { EvidenciaDom, VagaDom } from "../src/domain/tipos";

const ev = (p: Partial<EvidenciaDom>): EvidenciaDom => ({
  id: p.id ?? Math.random().toString(36).slice(2),
  titulo: "Evidência",
  tipo: "Projeto",
  concluido: false,
  link: "",
  competencias: [],
  problema: "",
  fez: "",
  ferramentas: "",
  resultado: "",
  ...p,
});

// Cenário do protótipo: Ana, assistente administrativa migrando para dados.
const EVS_ANA = [
  ev({ id: "e1", titulo: "Curso de SQL concluído", tipo: "Curso", concluido: true, competencias: ["SQL"], fez: "Concluí o curso de SQL.", ferramentas: "SQL" }),
  ev({ id: "e2", titulo: "Dashboard em Power BI feito em curso", tipo: "Projeto", competencias: ["Power BI"], ferramentas: "Power BI" }),
  ev({ id: "e3", titulo: "Acompanhamento de metas de vendas", tipo: "Caso da carreira anterior", competencias: ["análise de indicadores", "Excel"], fez: "Acompanho metas de vendas em planilhas.", ferramentas: "Excel" }),
];

const VAGA1 = "Vaga: Analista de Dados Júnior\n\nRequisitos:\n- SQL\n- Power BI\n- Análise de indicadores\n- 1 ano de experiência na área";
const VAGA2 =
  "Vaga: Analista de BI Júnior\n\nRequisitos:\n- SQL\n- Power BI\n- Excel avançado\n- Comunicação com as áreas de negócio\n- Graduação em áreas de exatas\n\nDiferenciais:\n- Python";
const VAGA3 = "Vaga: Assistente de Dados\n\nRequisitos:\n- Excel\n- Análise de indicadores\n- Senso de organização\n\nDesejável:\n- SQL";

const vaga = (id: string, texto: string): VagaDom => ({ id, titulo: id, reqs: extrairRequisitos(texto) });

describe("extração de requisitos por regras", () => {
  it("separa competências e exigência formal", () => {
    const r = extrairRequisitos(VAGA1);
    expect(r.map((x) => x.curto)).toEqual(["SQL", "Power BI", "análise de indicadores", "1 ano de experiência na área"]);
    expect(r[3]).toMatchObject({ tipo: "formal", kind: "tempo", obrig: true });
  });

  it("marca diferenciais e desejáveis como não obrigatórios", () => {
    const r2 = extrairRequisitos(VAGA2);
    expect(r2.find((x) => x.curto === "Python")?.obrig).toBe(false);
    expect(r2.find((x) => x.kind === "diploma")?.obrig).toBe(true);
    const r3 = extrairRequisitos(VAGA3);
    expect(r3.find((x) => x.curto === "SQL")?.obrig).toBe(false);
    expect(r3.find((x) => x.curto === "organização")?.tipo).toBe("comportamental");
  });

  it("ignora benefícios e textos sobre a empresa", () => {
    const r = extrairRequisitos(`${VAGA1}\n\nBenefícios:\n- Curso de Python pago\n\nSobre a empresa:\nUsamos Figma`);
    expect(r.some((x) => x.curto === "Python" || x.curto === "Figma")).toBe(false);
  });

  it("devolve lista vazia quando não há requisito reconhecível", () => {
    expect(extrairRequisitos("Venha trabalhar conosco em um ambiente incrível e descontraído.")).toEqual([]);
  });
});

describe("Raio-X: cruzamento e decisão", () => {
  it("reproduz o exemplo da landing (prepare evidências antes)", () => {
    const R = raio(vaga("v1", VAGA1), EVS_ANA);
    expect(R.reqs.map((r) => r.situacao)).toEqual(["comprova", "tem_precisa_mostrar", "tem_precisa_mostrar", "formal"]);
    expect(R.decisao).toBe("prepare_evidencias");
    expect(R.justificativa[0]).toContain("Você comprova SQL");
    expect(R.acoes.length).toBeLessThanOrEqual(3);
    expect(R.acoes.at(-1)?.tipo).toBe("verificar");
  });

  it("candidate-se agora quando tudo obrigatório está comprovado", () => {
    const evs = [
      ev({ competencias: ["SQL", "Power BI", "análise de indicadores"], problema: "p", fez: "f", ferramentas: "t", resultado: "r", link: "https://x.dev" }),
    ];
    expect(raio(vaga("v1", VAGA1), evs).decisao).toBe("candidate_agora");
  });

  it("busque uma vaga mais compatível quando falta a maior parte", () => {
    expect(raio(vaga("v1", VAGA1), []).decisao).toBe("busque_compativel");
  });

  it("uma lacuna comportamental isolada não derruba a decisão", () => {
    expect(raio(vaga("v2", VAGA2), EVS_ANA).decisao).toBe("prepare_evidencias");
  });

  it("evId apontado pela IA conta como evidência", () => {
    const req = { ...extrairRequisitos("Requisitos:\n- Tableau")[0]!, evId: "e2" };
    expect(cruzar(req, EVS_ANA).evidenciaId).toBe("e2");
  });

  it("decisão da empresa sobre exigência formal muda nota e ações", () => {
    const reqs = extrairRequisitos(VAGA1).map((r) => (r.tipo === "formal" ? { ...r, aceita: "sim" as const } : r));
    const R = raio({ reqs }, EVS_ANA);
    expect(R.reqs.find((r) => r.tipo === "formal")?.nota).toContain("aceita experiência aplicada");
    expect(R.acoes.some((a) => a.tipo === "verificar" && a.texto.includes("Verifique"))).toBe(false);
  });

  it("sem requisitos obrigatórios não formais, pede preparo", () => {
    expect(decidir([])).toBe("prepare_evidencias");
  });

  it("ações sugerem mini-projeto para lacuna técnica", () => {
    const R = raio(vaga("v1", VAGA1), []);
    const a = acoesDe(R.reqs, []);
    expect(a[0]).toMatchObject({ tipo: "mini", comp: "SQL" });
  });
});

describe("Radar", () => {
  it("prioriza lacunas recorrentes e calcula ganho", () => {
    const vagas = [vaga("v1", VAGA1), vaga("v2", VAGA2), vaga("v3", VAGA3)];
    const R = radar(vagas, EVS_ANA);
    const sql = R.find((i) => i.curto === "SQL");
    expect(sql?.vagas).toBe(3);
    expect(sql?.situacao).toBe("comprova");
    const pbi = R.find((i) => i.curto === "Power BI");
    expect(pbi?.ganho).toBeGreaterThan(0);
  });
});

describe("evidências", () => {
  it("indica o que falta para ficar bem documentada", () => {
    const e = ev({ tipo: "Projeto" });
    expect(completa(e)).toBe(false);
    expect(faltas(e)).toContain("um link público");
  });
});

describe("regras locais", () => {
  it("classifica a etapa da transição", () => {
    expect(classificarEtapa({ candidatou: "sim", tempo: "1mais", atrapalha: [] })).toBe("Buscando a vaga");
    expect(classificarEtapa({ candidatou: "nao", tempo: "0a6", atrapalha: [] })).toBe("Definindo o caminho");
    expect(classificarEtapa({ candidatou: "nao", tempo: "1mais", atrapalha: ["Currículo desatualizado"] })).toBe("Construindo a base");
  });

  it("tradutor nunca inventa competência", () => {
    const t = traduzirPorRegras("Acompanhava metas de vendas em planilhas\nFazia café");
    expect(t[0]?.competencias).toContain("análise de indicadores");
    expect(t[1]?.competencias).toEqual([]);
    expect(t[1]?.falta).toBeTruthy();
  });

  it("história marca o que falta em vez de inventar", () => {
    const h = historiaPorRegras(ev({ competencias: ["SQL"] }));
    expect(h.situacao).toContain("[Complete na evidência");
  });

  it("feedback detecta resposta curta e sem resultado", () => {
    const f = feedbackPorRegras("Mudei porque gosto de dados.");
    expect(f.objetividade).toContain("curta");
    expect(f.sugestoes.length).toBeGreaterThan(0);
  });

  it("guarda bloqueia promessas e afirmações sobre a empresa", () => {
    expect(violaPrincipios(["Com isso você será contratada."])).toBe(true);
    expect(violaPrincipios(["A empresa aceita experiência aplicada."])).toBe(true);
    expect(violaPrincipios(["Pergunte se a empresa aceita experiência aplicada."])).toBe(false);
    expect(violaPrincipios(["Faça um curso de SQL."])).toBe(true);
  });
});
