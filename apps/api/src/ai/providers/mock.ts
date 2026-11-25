import { ErroIA, type PedidoConversa, type PedidoJSON, type ProvedorIA, type RespostaIA } from "../tipos";

/**
 * Provedor determinístico para testes de ponta a ponta. Nunca é aceito com
 * NODE_ENV=production (ver ai/config.ts).
 * - Tarefas estruturadas: devolve "invalido" (o motor de regras assume),
 *   exceto a importação de currículo, que vira um rascunho com a 1ª linha do documento.
 * - Conversa: responde citando a última mensagem, em trechos, como um stream real.
 *   Gatilhos para testes: "#falhar" (falha antes de responder), "#cortar" (falha
 *   no meio do stream) e "#lento" (stream lento, para testar o cancelamento).
 */
export class ProvedorMock implements ProvedorIA {
  readonly id = "mock" as const;

  async gerarJSON<T>(req: PedidoJSON<T>): Promise<RespostaIA<T>> {
    if (req.nomeSchema === "evidencias_do_documento") {
      const doc = req.mensagem.split("<documento>")[1] ?? "";
      const linha = doc.split("\n").map((l) => l.trim()).find((l) => l.length > 3) ?? "Experiência";
      const dados = {
        evidencias: [
          { titulo: linha.slice(0, 100), tipo: "Caso da carreira anterior", concluido: false, link: "", competencias: ["comunicação"], problema: "", fez: linha, ferramentas: "", resultado: "" },
        ],
      };
      const r = req.schema.safeParse(dados);
      if (r.success) return { dados: r.data, uso: { entrada: 0, saida: 0 }, modelo: req.modelo };
    }
    throw new ErroIA("invalido", "mock: use o motor de regras");
  }

  async conversar(req: PedidoConversa, aoReceber: (t: string) => void): Promise<RespostaIA<string>> {
    const ultima = req.mensagens.at(-1)?.conteudo ?? "";
    if (ultima.includes("#falhar")) throw new ErroIA("falha", "mock: falha simulada");
    const base = `Resposta de teste do Mentor para: **${ultima.replace(/#\w+/g, "").trim().slice(0, 80)}**\n\n- Primeiro passo: revise suas evidências.\n- Depois: faça um Raio-X.`;
    // "#acoes" faz o simulador sugerir ações, como um modelo real faria.
    const texto = ultima.includes("#acoes")
      ? `${base}\n<acoes>[{"tipo":"tarefa","titulo":"Documentar o painel de vendas com problema, dados e resultado","prazoDias":5},{"tipo":"mini","competencia":"Power BI"}]</acoes>`
      : base;
    const atraso = ultima.includes("#lento") ? 250 : 15;
    const partes = texto.match(/.{1,12}/gs) ?? [];
    for (const [i, parte] of partes.entries()) {
      if (req.signal.aborted) throw new ErroIA("tempo", "cancelado");
      if (ultima.includes("#cortar") && i === 3) throw new ErroIA("falha", "mock: queda no meio do stream");
      aoReceber(parte);
      await new Promise((r) => setTimeout(r, atraso));
    }
    return { dados: texto, uso: { entrada: 0, saida: 0 }, modelo: req.modelo };
  }
}
