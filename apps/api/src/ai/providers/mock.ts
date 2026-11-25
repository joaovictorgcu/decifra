import { ErroIA, type PedidoConversa, type PedidoJSON, type ProvedorIA, type RespostaIA } from "../tipos";

/**
 * Provedor determinístico para testes de ponta a ponta e desenvolvimento sem
 * chave de API. Nunca é aceito com NODE_ENV=production (ver config/env.ts).
 * - Tarefas estruturadas: devolve "invalido", o que aciona o motor de regras,
 *   exceto a importação de currículo, que vira um rascunho com a 1ª linha do documento.
 * - Conversa: responde citando a última mensagem, em trechos, como um stream real.
 */
export class ProvedorMock implements ProvedorIA {
  readonly nome = "mock";

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
      if (r.success) return { dados: r.data, uso: { entrada: 0, saida: 0 }, modelo: "mock" };
    }
    throw new ErroIA("invalido", "mock: use o motor de regras");
  }

  async conversar(req: PedidoConversa, aoReceber: (t: string) => void): Promise<RespostaIA<string>> {
    const ultima = req.mensagens.at(-1)?.conteudo ?? "";
    const texto = `Resposta de teste do Mentor para: **${ultima.slice(0, 80)}**\n\n- Primeiro passo: revise suas evidências.\n- Depois: faça um Raio-X.`;
    for (const parte of texto.match(/.{1,12}/gs) ?? []) {
      if (req.signal.aborted) throw new ErroIA("tempo", "cancelado");
      aoReceber(parte);
      await new Promise((r) => setTimeout(r, 15));
    }
    return { dados: texto, uso: { entrada: 0, saida: 0 }, modelo: "mock" };
  }
}
