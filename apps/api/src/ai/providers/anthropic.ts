import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ProvedorConfigurado } from "../config";
import { ErroIA, lerRetryAfter, type PedidoConversa, type PedidoJSON, type ProvedorIA, type RespostaIA } from "../tipos";

/** Modelos que aceitam o fallback de recusa do lado do servidor (`fallbacks: "default"`). */
const ACEITAM_FALLBACK = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-2", "claude-fable-5-1", "claude-sonnet-5-5"]);
const BETA_FALLBACK = "server-side-fallback-2026-07-01" as const;

/** Anthropic (Claude) pelo SDK oficial, com saída estruturada nativa e streaming. */
export class ProvedorAnthropic implements ProvedorIA {
  readonly id = "anthropic" as const;
  private readonly client: Anthropic;
  private readonly fallbacks: "default" | "off";

  constructor(cfg: ProvedorConfigurado) {
    // Sem apiKey explícita, o SDK resolve credenciais do ambiente (ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN).
    this.client = new Anthropic({ apiKey: cfg.apiKey, maxRetries: 1 });
    this.fallbacks = cfg.anthropicFallbacks ?? "default";
  }

  private extras(modelo: string) {
    if (this.fallbacks === "off" || !ACEITAM_FALLBACK.has(modelo)) return {};
    return { betas: [BETA_FALLBACK], fallbacks: "default" as const };
  }

  async gerarJSON<T>(req: PedidoJSON<T>): Promise<RespostaIA<T>> {
    try {
      const resp = await this.client.beta.messages.parse(
        {
          model: req.modelo,
          max_tokens: req.maxTokens,
          system: req.sistema,
          messages: [{ role: "user", content: req.mensagem }],
          output_config: { format: zodOutputFormat(req.schema), effort: req.esforco },
          ...this.extras(req.modelo),
        },
        { signal: req.signal },
      );
      if (resp.stop_reason === "refusal") throw new ErroIA("recusa", "O modelo recusou a solicitação.");
      if (resp.stop_reason === "max_tokens") throw new ErroIA("invalido", "Resposta cortada pelo limite de tokens.");
      if (resp.parsed_output == null) throw new ErroIA("invalido", "Resposta fora do formato esperado.");
      return { dados: resp.parsed_output as T, uso: { entrada: resp.usage.input_tokens, saida: resp.usage.output_tokens }, modelo: resp.model };
    } catch (e) {
      throw normalizar(e);
    }
  }

  async conversar(req: PedidoConversa, aoReceber: (trecho: string) => void): Promise<RespostaIA<string>> {
    try {
      const stream = this.client.beta.messages.stream(
        {
          model: req.modelo,
          max_tokens: req.maxTokens,
          system: req.sistema,
          messages: req.mensagens.map((m) => ({ role: m.papel, content: m.conteudo })),
          output_config: { effort: req.esforco },
          ...this.extras(req.modelo),
        },
        { signal: req.signal },
      );
      let texto = "";
      for await (const evento of stream) {
        if (evento.type === "content_block_delta" && evento.delta.type === "text_delta") {
          texto += evento.delta.text;
          aoReceber(evento.delta.text);
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") throw new ErroIA("recusa", "O modelo recusou a solicitação.", { parcial: texto.length > 0 });
      return { dados: texto, uso: { entrada: final.usage.input_tokens, saida: final.usage.output_tokens }, modelo: final.model };
    } catch (e) {
      throw normalizar(e);
    }
  }
}

function normalizar(e: unknown): ErroIA {
  if (e instanceof ErroIA) return e;
  if (e instanceof Anthropic.APIUserAbortError) return new ErroIA("tempo", "Chamada interrompida.", { causa: e });
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new ErroIA("tempo", "Tempo esgotado ao consultar a IA.", { causa: e });
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return new ErroIA("autenticacao", "Credencial da IA inválida ou sem permissão.", { causa: e });
  }
  if (e instanceof Anthropic.RateLimitError) return new ErroIA("limite", "Limite de uso da IA atingido.", { causa: e, aposMs: lerRetryAfter(e.headers) });
  if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError) {
    return new ErroIA("requisicao", `Requisição recusada pela API (${e.status}).`, { causa: e });
  }
  if (e instanceof Anthropic.APIConnectionError) return new ErroIA("falha", "Não foi possível conectar à API de IA.", { causa: e });
  if (e instanceof Anthropic.APIError) return new ErroIA("falha", `Falha na API de IA (${e.status ?? "sem status"}).`, { causa: e, aposMs: lerRetryAfter(e.headers) });
  return new ErroIA("falha", e instanceof Error ? e.message : "Falha desconhecida na IA.", { causa: e });
}
