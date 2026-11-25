import OpenAI from "openai";
import { z } from "zod";
import { ErroIA, type PedidoConversa, type PedidoJSON, type ProvedorIA, type RespostaIA } from "../tipos";

/**
 * Provedor para a API da OpenAI e para qualquer servidor compatível
 * (Ollama, LM Studio, vLLM, OpenRouter). Usa o modo JSON, que todos esses
 * servidores suportam, e valida a saída com Zod. Uma tentativa de correção é
 * feita quando o JSON vem fora do schema.
 */
export class ProvedorOpenAI implements ProvedorIA {
  private readonly client: OpenAI;

  constructor(
    readonly nome: "openai" | "openai-compatible",
    opcoes: { apiKey?: string; baseURL?: string },
  ) {
    this.client = new OpenAI({ apiKey: opcoes.apiKey ?? "nao-necessaria", baseURL: opcoes.baseURL, maxRetries: 2 });
  }

  private limite(max: number) {
    // A API oficial usa max_completion_tokens; servidores compatíveis costumam aceitar só max_tokens.
    return this.nome === "openai" ? { max_completion_tokens: max } : { max_tokens: max };
  }

  async gerarJSON<T>(req: PedidoJSON<T>): Promise<RespostaIA<T>> {
    const esquema = JSON.stringify(z.toJSONSchema(req.schema));
    const sistema = `${req.sistema}\n\nResponda APENAS com um objeto JSON válido que siga este JSON Schema (${req.nomeSchema}):\n${esquema}`;
    const mensagens: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: sistema },
      { role: "user", content: req.mensagem },
    ];
    let entrada = 0;
    let saida = 0;
    try {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const resp = await this.client.chat.completions.create(
          { model: req.modelo, messages: mensagens, response_format: { type: "json_object" }, ...this.limite(req.maxTokens) },
          { signal: req.signal },
        );
        entrada += resp.usage?.prompt_tokens ?? 0;
        saida += resp.usage?.completion_tokens ?? 0;
        const escolha = resp.choices[0];
        if (escolha?.message.refusal) throw new ErroIA("recusa", "O modelo recusou a solicitação.");
        const bruto = escolha?.message.content ?? "";
        let json: unknown;
        try {
          json = JSON.parse(bruto);
        } catch {
          json = undefined;
        }
        const r = req.schema.safeParse(json);
        if (r.success) return { dados: r.data, uso: { entrada, saida }, modelo: resp.model };
        mensagens.push(
          { role: "assistant", content: bruto },
          { role: "user", content: "O JSON acima não segue o schema pedido. Responda novamente, só com o JSON corrigido." },
        );
      }
      throw new ErroIA("invalido", "Resposta fora do formato esperado.");
    } catch (e) {
      throw normalizar(e);
    }
  }

  async conversar(req: PedidoConversa, aoReceber: (trecho: string) => void): Promise<RespostaIA<string>> {
    try {
      const stream = await this.client.chat.completions.create(
        {
          model: req.modelo,
          stream: true,
          stream_options: { include_usage: true },
          messages: [{ role: "system", content: req.sistema }, ...req.mensagens.map((m) => ({ role: m.papel, content: m.conteudo }))],
          ...this.limite(req.maxTokens),
        },
        { signal: req.signal },
      );
      let texto = "";
      let uso = { entrada: 0, saida: 0 };
      let modelo = req.modelo;
      for await (const parte of stream) {
        modelo = parte.model || modelo;
        const delta = parte.choices[0]?.delta?.content;
        if (delta) {
          texto += delta;
          aoReceber(delta);
        }
        if (parte.usage) uso = { entrada: parte.usage.prompt_tokens, saida: parte.usage.completion_tokens };
      }
      return { dados: texto, uso, modelo };
    } catch (e) {
      throw normalizar(e);
    }
  }
}

function normalizar(e: unknown): ErroIA {
  if (e instanceof ErroIA) return e;
  if (e instanceof OpenAI.APIUserAbortError || e instanceof OpenAI.APIConnectionTimeoutError) {
    return new ErroIA("tempo", "Tempo esgotado ao consultar a IA.", e);
  }
  if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError) {
    return new ErroIA("autenticacao", "Credencial da IA inválida ou sem permissão.", e);
  }
  if (e instanceof OpenAI.RateLimitError) return new ErroIA("limite", "Limite de uso da IA atingido.", e);
  if (e instanceof OpenAI.APIConnectionError) return new ErroIA("falha", "Não foi possível conectar ao servidor de IA.", e);
  if (e instanceof OpenAI.APIError) return new ErroIA("falha", `Falha na API de IA (${e.status ?? "sem status"}).`, e);
  return new ErroIA("falha", e instanceof Error ? e.message : "Falha desconhecida na IA.", e);
}
