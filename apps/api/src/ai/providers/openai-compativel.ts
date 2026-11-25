import OpenAI from "openai";
import { z } from "zod";
import type { ProvedorConfigurado } from "../config";
import { ErroIA, lerRetryAfter, type IdProvedor, type PedidoConversa, type PedidoJSON, type ProvedorIA, type RespostaIA } from "../tipos";

/**
 * Cliente único para APIs compatíveis com a da OpenAI: OpenAI, Groq, Gemini
 * (endpoint de compatibilidade), OpenRouter, Ollama e servidores próprios.
 * As diferenças entre eles (parâmetro de limite, formato de JSON, cabeçalhos,
 * preferências de privacidade) vêm do catálogo/configuração, não de if/else.
 */
export class ProvedorCompativel implements ProvedorIA {
  readonly id: IdProvedor;
  private readonly client: OpenAI;

  constructor(private readonly cfg: ProvedorConfigurado) {
    this.id = cfg.def.id;
    this.client = new OpenAI({
      apiKey: cfg.apiKey ?? "nao-necessaria",
      baseURL: cfg.baseURL ?? cfg.def.baseURL,
      defaultHeaders: cfg.cabecalhos,
      // O roteador da DECIFRA cuida de tentar outro provedor; aqui só uma nova tentativa rápida para falhas de rede.
      maxRetries: 1,
    });
  }

  private parametros(maxTokens: number, esforco: string): Record<string, unknown> {
    const p: Record<string, unknown> = { [this.cfg.def.paramLimite]: maxTokens, ...(this.cfg.corpoExtra ?? {}) };
    if (this.cfg.def.enviaEsforco) p.reasoning_effort = esforco;
    return p;
  }

  async gerarJSON<T>(req: PedidoJSON<T>): Promise<RespostaIA<T>> {
    const jsonSchema = paraSchemaEstrito(req.schema);
    let formato = this.cfg.def.formatoJson;
    const sistema = (f: string) =>
      f === "json_schema"
        ? `${req.sistema}\n\nResponda apenas com JSON no formato pedido.`
        : `${req.sistema}\n\nResponda APENAS com um objeto JSON válido que siga este JSON Schema (${req.nomeSchema}):\n${JSON.stringify(jsonSchema)}`;
    const mensagens: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: sistema(formato) },
      { role: "user", content: req.mensagem },
    ];
    let entrada = 0;
    let saida = 0;
    try {
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const responseFormat =
          formato === "json_schema"
            ? { type: "json_schema" as const, json_schema: { name: req.nomeSchema, strict: true, schema: jsonSchema } }
            : { type: "json_object" as const };
        let resp: OpenAI.Chat.ChatCompletion;
        try {
          resp = await this.client.chat.completions.create(
            { model: req.modelo, messages: mensagens, response_format: responseFormat, ...this.parametros(req.maxTokens, req.esforco) } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
            { signal: req.signal },
          );
        } catch (e) {
          // Modelo/servidor sem json_schema: tenta de novo em modo JSON simples, com o schema no prompt.
          if (formato === "json_schema" && e instanceof OpenAI.BadRequestError) {
            formato = "json_object";
            mensagens[0] = { role: "system", content: sistema(formato) };
            continue;
          }
          throw e;
        }
        erroNoCorpo(resp);
        entrada += resp.usage?.prompt_tokens ?? 0;
        saida += resp.usage?.completion_tokens ?? 0;
        const escolha = resp.choices?.[0];
        if (escolha?.message.refusal) throw new ErroIA("recusa", "O modelo recusou a solicitação.");
        if (escolha?.finish_reason === "length") throw new ErroIA("invalido", "Resposta cortada pelo limite de tokens.");
        const bruto = escolha?.message.content ?? "";
        const r = req.schema.safeParse(extrairJSON(bruto));
        if (r.success) return { dados: r.data, uso: { entrada, saida }, modelo: resp.model || req.modelo };
        mensagens.push(
          { role: "assistant", content: bruto.slice(0, 8000) },
          { role: "user", content: `O JSON acima não segue o schema pedido (${r.error.issues[0]?.path.join(".") || "formato"}). Responda novamente, só com o JSON corrigido.` },
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
          ...this.parametros(req.maxTokens, req.esforco),
        } as OpenAI.Chat.ChatCompletionCreateParamsStreaming,
        { signal: req.signal },
      );
      const filtro = new FiltroPensamento();
      let texto = "";
      let uso = { entrada: 0, saida: 0 };
      let modelo = req.modelo;
      for await (const parte of stream) {
        erroNoCorpo(parte);
        modelo = parte.model || modelo;
        const delta = parte.choices?.[0]?.delta?.content;
        if (delta) {
          const limpo = filtro.processar(delta);
          if (limpo) {
            texto += limpo;
            aoReceber(limpo);
          }
        }
        if (parte.usage) uso = { entrada: parte.usage.prompt_tokens, saida: parte.usage.completion_tokens };
      }
      if (!texto.trim()) throw new ErroIA("invalido", "O modelo não devolveu texto.");
      return { dados: texto, uso, modelo };
    } catch (e) {
      throw normalizar(e);
    }
  }
}

/* ---------- Utilidades ---------- */

/**
 * Converte o schema Zod em JSON Schema no formato exigido pelo modo estrito
 * (todas as propriedades obrigatórias e additionalProperties: false).
 */
export function paraSchemaEstrito(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  delete js.$schema;
  const andar = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (o.type === "object" && o.properties && typeof o.properties === "object") {
      o.additionalProperties = false;
      o.required = Object.keys(o.properties);
      for (const v of Object.values(o.properties)) andar(v);
    }
    if (o.items) andar(o.items);
    for (const k of ["anyOf", "oneOf", "allOf"]) if (Array.isArray(o[k])) (o[k] as unknown[]).forEach(andar);
  };
  andar(js);
  return js;
}

/** Extrai o JSON de uma resposta, tolerando cercas de código e blocos de raciocínio. */
export function extrairJSON(bruto: string): unknown {
  let t = bruto.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cerca) t = cerca[1]!.trim();
  try {
    return JSON.parse(t);
  } catch {
    const i = t.indexOf("{");
    const f = t.lastIndexOf("}");
    if (i >= 0 && f > i) {
      try {
        return JSON.parse(t.slice(i, f + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

/** Remove blocos <think>...</think> que alguns modelos abertos emitem no streaming. */
class FiltroPensamento {
  private dentro = false;
  private resto = "";
  processar(trecho: string): string {
    let t = this.resto + trecho;
    this.resto = "";
    let out = "";
    while (t.length) {
      if (this.dentro) {
        const f = t.indexOf("</think>");
        if (f < 0) {
          this.resto = t.slice(-8);
          return out;
        }
        t = t.slice(f + 8);
        this.dentro = false;
      } else {
        const i = t.indexOf("<think>");
        if (i < 0) {
          // Guarda um possível começo de tag cortado entre dois trechos.
          const parcial = t.lastIndexOf("<");
          if (parcial >= 0 && "<think>".startsWith(t.slice(parcial))) {
            out += t.slice(0, parcial);
            this.resto = t.slice(parcial);
          } else out += t;
          return out;
        }
        out += t.slice(0, i);
        t = t.slice(i + 7);
        this.dentro = true;
      }
    }
    return out;
  }
}

/** OpenRouter pode devolver erro com HTTP 200, no corpo ou no stream. */
function erroNoCorpo(r: unknown) {
  const e = (r as { error?: { code?: number; message?: string; metadata?: { error_type?: string } } }).error;
  if (!e) return;
  const tipo = e.metadata?.error_type;
  const cod = Number(e.code);
  if (cod === 429 || tipo === "rate_limit_exceeded") throw new ErroIA("limite", "Limite do provedor atingido.");
  if (cod === 401 || tipo === "authentication") throw new ErroIA("autenticacao", "Credencial inválida.");
  if (tipo === "refusal" || tipo === "content_policy_violation") throw new ErroIA("recusa", "O modelo recusou a solicitação.");
  throw new ErroIA("falha", `Falha do provedor: ${e.message ?? "erro desconhecido"}`.slice(0, 200));
}

function normalizar(e: unknown): ErroIA {
  if (e instanceof ErroIA) return e;
  if (e instanceof OpenAI.APIUserAbortError) return new ErroIA("tempo", "Chamada interrompida.", { causa: e });
  if (e instanceof OpenAI.APIConnectionTimeoutError) return new ErroIA("tempo", "Tempo esgotado ao consultar a IA.", { causa: e });
  if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError) {
    return new ErroIA("autenticacao", "Credencial da IA inválida ou sem permissão.", { causa: e });
  }
  if (e instanceof OpenAI.RateLimitError) return new ErroIA("limite", "Limite de uso do provedor atingido.", { causa: e, aposMs: lerRetryAfter(e.headers) });
  if (e instanceof OpenAI.BadRequestError || e instanceof OpenAI.NotFoundError || e instanceof OpenAI.UnprocessableEntityError) {
    return new ErroIA("requisicao", `Requisição recusada pelo provedor (${e.status}).`, { causa: e });
  }
  if (e instanceof OpenAI.APIConnectionError) return new ErroIA("falha", "Não foi possível conectar ao provedor de IA.", { causa: e });
  if (e instanceof OpenAI.APIError) {
    const status = e.status ?? 0;
    if (status === 402) return new ErroIA("limite", "Créditos do provedor esgotados.", { causa: e, aposMs: lerRetryAfter(e.headers) });
    return new ErroIA("falha", `Falha na API de IA (${status || "sem status"}).`, { causa: e, aposMs: lerRetryAfter(e.headers) });
  }
  if (e instanceof Error && e.name === "AbortError") return new ErroIA("tempo", "Chamada interrompida.", { causa: e });
  return new ErroIA("falha", e instanceof Error ? e.message : "Falha desconhecida na IA.", { causa: e });
}
