import type { z } from "zod";
import type { Env } from "../config/env";
import { ProvedorAnthropic } from "./providers/anthropic";
import { ProvedorOpenAI } from "./providers/openai";
import { ErroIA, type Esforco, type MensagemIA, type ProvedorIA, type TarefaIA } from "./tipos";

/**
 * Perfil de cada tarefa de IA. "rapido" usa AI_MODEL_FAST (se definido),
 * "principal" usa AI_MODEL. Cada tarefa pode ser sobrescrita por
 * AI_MODEL_<TAREFA> (ex.: AI_MODEL_MENTOR), sem mudar código.
 */
const PERFIS: Record<TarefaIA, { nivel: "rapido" | "principal"; esforco: Esforco; maxTokens: number }> = {
  extrair_requisitos: { nivel: "rapido", esforco: "low", maxTokens: 16000 },
  traduzir: { nivel: "rapido", esforco: "low", maxTokens: 16000 },
  feedback: { nivel: "rapido", esforco: "low", maxTokens: 16000 },
  historia: { nivel: "principal", esforco: "medium", maxTokens: 16000 },
  importar_cv: { nivel: "principal", esforco: "medium", maxTokens: 16000 },
  mentor: { nivel: "principal", esforco: "medium", maxTokens: 16000 },
};

const MODELO_PADRAO: Partial<Record<Env["AI_PROVIDER"], string>> = {
  anthropic: "claude-opus-5-5",
};

export interface RegistroInteracao {
  userId: string | null;
  tarefa: TarefaIA;
  provedor: string;
  modelo: string;
  status: "ok" | "invalido" | "erro" | "recusa";
  latenciaMs: number;
  tokensEntrada: number;
  tokensSaida: number;
  erro: string;
}

export type Registrador = (r: RegistroInteracao) => Promise<void> | void;

export class ServicoIA {
  constructor(
    private readonly provedor: ProvedorIA | null,
    private readonly env: Pick<Env, "AI_MODEL" | "AI_MODEL_FAST" | "AI_TIMEOUT_MS" | "AI_PROVIDER">,
    private readonly registrar: Registrador,
    private readonly modelosPorTarefa: Partial<Record<TarefaIA, string>> = {},
  ) {}

  get ativa(): boolean {
    return this.provedor !== null;
  }

  get nomeProvedor(): string {
    return this.provedor?.nome ?? "none";
  }

  modeloDe(tarefa: TarefaIA): string {
    const perfil = PERFIS[tarefa];
    const principal = this.env.AI_MODEL ?? MODELO_PADRAO[this.env.AI_PROVIDER] ?? "";
    const base = perfil.nivel === "rapido" ? (this.env.AI_MODEL_FAST ?? principal) : principal;
    return this.modelosPorTarefa[tarefa] ?? base;
  }

  async gerarJSON<T>(
    tarefa: TarefaIA,
    userId: string | null,
    p: { sistema: string; mensagem: string; schema: z.ZodType<T>; nomeSchema: string },
  ): Promise<T> {
    const provedor = this.exigir();
    const perfil = PERFIS[tarefa];
    const modelo = this.modeloDe(tarefa);
    return this.medir(tarefa, userId, modelo, async (signal) => {
      const r = await provedor.gerarJSON({ ...p, modelo, esforco: perfil.esforco, maxTokens: perfil.maxTokens, signal });
      return { valor: r.dados, uso: r.uso, modelo: r.modelo };
    });
  }

  async conversar(
    tarefa: TarefaIA,
    userId: string | null,
    p: { sistema: string; mensagens: MensagemIA[] },
    aoReceber: (trecho: string) => void,
    sinalExterno?: AbortSignal,
  ): Promise<string> {
    const provedor = this.exigir();
    const perfil = PERFIS[tarefa];
    const modelo = this.modeloDe(tarefa);
    return this.medir(
      tarefa,
      userId,
      modelo,
      async (signal) => {
        const r = await provedor.conversar({ ...p, modelo, esforco: perfil.esforco, maxTokens: perfil.maxTokens, signal }, aoReceber);
        return { valor: r.dados, uso: r.uso, modelo: r.modelo };
      },
      sinalExterno,
    );
  }

  private exigir(): ProvedorIA {
    if (!this.provedor) throw new ErroIA("desativada", "A IA não está configurada neste ambiente.");
    return this.provedor;
  }

  private async medir<T>(
    tarefa: TarefaIA,
    userId: string | null,
    modelo: string,
    fn: (signal: AbortSignal) => Promise<{ valor: T; uso: { entrada: number; saida: number }; modelo: string }>,
    sinalExterno?: AbortSignal,
  ): Promise<T> {
    const inicio = Date.now();
    const sinais = [AbortSignal.timeout(this.env.AI_TIMEOUT_MS)];
    if (sinalExterno) sinais.push(sinalExterno);
    const signal = AbortSignal.any(sinais);
    try {
      const r = await fn(signal);
      await this.log({ userId, tarefa, modelo: r.modelo, status: "ok", inicio, uso: r.uso, erro: "" });
      return r.valor;
    } catch (e) {
      const erro = e instanceof ErroIA ? e : new ErroIA("falha", e instanceof Error ? e.message : "Falha na IA", e);
      const status = erro.motivo === "recusa" ? "recusa" : erro.motivo === "invalido" ? "invalido" : "erro";
      await this.log({ userId, tarefa, modelo, status, inicio, uso: { entrada: 0, saida: 0 }, erro: `${erro.motivo}: ${erro.message}` });
      throw erro;
    }
  }

  private async log(r: {
    userId: string | null;
    tarefa: TarefaIA;
    modelo: string;
    status: RegistroInteracao["status"];
    inicio: number;
    uso: { entrada: number; saida: number };
    erro: string;
  }) {
    try {
      await this.registrar({
        userId: r.userId,
        tarefa: r.tarefa,
        provedor: this.nomeProvedor,
        modelo: r.modelo,
        status: r.status,
        latenciaMs: Date.now() - r.inicio,
        tokensEntrada: r.uso.entrada,
        tokensSaida: r.uso.saida,
        erro: r.erro.slice(0, 500),
      });
    } catch {
      /* O registro nunca deve derrubar a resposta ao usuário. */
    }
  }
}

/** Cria o provedor configurado no ambiente (ou nenhum, quando AI_PROVIDER=none). */
export function criarProvedor(env: Env): ProvedorIA | null {
  switch (env.AI_PROVIDER) {
    case "anthropic":
      return new ProvedorAnthropic(env.ANTHROPIC_API_KEY, env.ANTHROPIC_FALLBACKS);
    case "openai":
      return new ProvedorOpenAI("openai", { apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL });
    case "openai-compatible":
      return new ProvedorOpenAI("openai-compatible", { apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL });
    default:
      return null;
  }
}

/** Lê sobrescritas de modelo por tarefa (AI_MODEL_EXTRAIR_REQUISITOS, AI_MODEL_MENTOR...). */
export function modelosPorTarefaDoAmbiente(fonte: NodeJS.ProcessEnv = process.env): Partial<Record<TarefaIA, string>> {
  const tarefas: TarefaIA[] = ["extrair_requisitos", "traduzir", "historia", "feedback", "importar_cv", "mentor"];
  const out: Partial<Record<TarefaIA, string>> = {};
  for (const t of tarefas) {
    const v = fonte[`AI_MODEL_${t.toUpperCase()}`];
    if (v) out[t] = v;
  }
  return out;
}
