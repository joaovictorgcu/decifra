import { describe, expect, it } from "vitest";
import { FiltroAcoes, lerAcoes, separarAcoes } from "../src/ai/acoes-mentor";

describe("ações sugeridas pelo Mentor", () => {
  it("o filtro esconde o bloco mesmo partido entre trechos", () => {
    const f = new FiltroAcoes();
    const texto = 'Faça isto.\n<acoes>[{"tipo":"mini","competencia":"SQL"}]</acoes>';
    let visivel = "";
    for (const parte of texto.match(/.{1,5}/gs)!) visivel += f.processar(parte);
    const fim = f.finalizar();
    expect(visivel + fim.pendente).toBe("Faça isto.\n");
    expect(lerAcoes(fim.bloco!)).toEqual([{ tipo: "mini", competencia: "SQL", executada: false }]);
  });

  it("um '<' comum no texto não é engolido", () => {
    const f = new FiltroAcoes();
    const v = f.processar("nota < 5 e ") + f.processar("x <") + f.processar("b>texto</b>");
    expect(v + f.finalizar().pendente).toBe("nota < 5 e x <b>texto</b>");
  });

  it("valida, limita a 3, remove repetidas e recusa títulos com link", () => {
    const acoes = lerAcoes(
      JSON.stringify([
        { tipo: "tarefa", titulo: "Publicar o painel no GitHub com README", prazoDias: 90 },
        { tipo: "tarefa", titulo: "Publicar o painel no GitHub com README" },
        { tipo: "tarefa", titulo: "Ver https://site-inventado.com" },
        { tipo: "mini", competencia: "Power BI" },
        { tipo: "apagar_conta" },
        { tipo: "mini", competencia: "SQL" },
        { tipo: "mini", competencia: "Python" },
      ]),
    );
    expect(acoes).toEqual([
      { tipo: "tarefa", titulo: "Publicar o painel no GitHub com README", prazoDias: 30, executada: false },
      { tipo: "mini", competencia: "Power BI", executada: false },
      { tipo: "mini", competencia: "SQL", executada: false },
    ]);
    expect(lerAcoes("isto não é json")).toEqual([]);
    // Visto na avaliação real com modelo local: sugestão de curso genérico é descartada.
    expect(lerAcoes(JSON.stringify([{ tipo: "tarefa", titulo: "Aprenda Power BI através de um curso online" }]))).toEqual([]);
  });

  it("separa texto e ações de uma resposta completa", () => {
    const r = separarAcoes('Texto final.\n<acoes>[{"tipo":"mini","competencia":"Figma"}]</acoes>');
    expect(r.texto).toBe("Texto final.");
    expect(r.acoes).toHaveLength(1);
  });
});
