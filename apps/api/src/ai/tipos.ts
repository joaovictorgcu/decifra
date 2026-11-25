import type { z } from "zod";

/** Provedores suportados. "compativel" é qualquer servidor com API compatível com a da OpenAI (vLLM, LM Studio...). */
export type IdProvedor = "groq" | "gemini" | "openrouter" | "ollama" | "anthropic" | "openai" | "compativel" | "mock";

/** Complexidade da tarefa, usada para escolher provedor e modelo. */
export type Nivel = "simples" | "intermediaria" | "complexa";
export const NIVEIS: Nivel[] = ["simples", "intermediaria", "complexa"];

/** Quão pessoal é o conteúdo enviado ao modelo. */
export type Sensibilidade = "baixa" | "media" | "alta";

/**
 * Tratamento de dados pelo provedor:
 * - local: nada sai da sua infraestrutura (Ollama, servidor próprio);
 * - sem_treino: o provedor não treina com os dados (termos de API pagos, Groq);
 * - pode_treinar: o provedor pode usar os dados para melhorar produtos (ex.: Gemini gratuito).
 */
export type Privacidade = "local" | "sem_treino" | "pode_treinar";

/** Tarefas de IA do produto. Cada uma tem nível-base, sensibilidade e limites próprios (ver roteador.ts). */
export type TarefaIA = "extrair_requisitos" | "traduzir" | "historia" | "feedback" | "importar_cv" | "mentor";
export const TAREFAS: TarefaIA[] = ["extrair_requisitos", "traduzir", "historia", "feedback", "importar_cv", "mentor"];

export type Esforco = "low" | "medium" | "high";

/** Contrato que cada provedor implementa. O resto do sistema só conhece esta interface. */
export interface ProvedorIA {
  readonly id: IdProvedor;
  gerarJSON<T>(req: PedidoJSON<T>): Promise<RespostaIA<T>>;
  conversar(req: PedidoConversa, aoReceber: (trecho: string) => void): Promise<RespostaIA<string>>;
}

export interface PedidoBase {
  modelo: string;
  sistema: string;
  maxTokens: number;
  esforco: Esforco;
  signal: AbortSignal;
}

export interface PedidoJSON<T> extends PedidoBase {
  mensagem: string;
  schema: z.ZodType<T>;
  nomeSchema: string;
}

export interface MensagemIA {
  papel: "user" | "assistant";
  conteudo: string;
}

export interface PedidoConversa extends PedidoBase {
  mensagens: MensagemIA[];
}

export interface UsoIA {
  entrada: number;
  saida: number;
}

export interface RespostaIA<T> {
  dados: T;
  uso: UsoIA;
  modelo: string;
}

/** O que a interface pode mostrar sobre quem gerou um resultado. */
export interface MetaIA {
  provedor: IdProvedor;
  rotulo: string;
  modelo: string;
  nivel: Nivel;
}

export type MotivoFalhaIA =
  | "desativada" // nenhum provedor configurado
  | "privacidade" // nenhum provedor permitido para o nível de sensibilidade da tarefa
  | "indisponivel" // todos os provedores falharam ou estão em pausa (disjuntor)
  | "cota" // limite diário do usuário
  | "cancelado" // a pessoa cancelou
  | "recusa"
  | "invalido" // resposta fora do formato esperado
  | "tempo"
  | "limite" // 429 do provedor
  | "autenticacao"
  | "requisicao" // 400: parâmetro ou modelo não aceito
  | "falha";

/** Erro normalizado de qualquer provedor. */
export class ErroIA extends Error {
  readonly motivo: MotivoFalhaIA;
  readonly causa?: unknown;
  /** Quando tentar de novo, em ms (vem do Retry-After ou do disjuntor). */
  readonly aposMs?: number;
  /** A falha aconteceu depois de parte da resposta já ter sido enviada (streaming). */
  readonly parcial: boolean;

  constructor(motivo: MotivoFalhaIA, mensagem: string, opcoes: { causa?: unknown; aposMs?: number; parcial?: boolean } = {}) {
    super(mensagem);
    this.name = "ErroIA";
    this.motivo = motivo;
    this.causa = opcoes.causa;
    this.aposMs = opcoes.aposMs;
    this.parcial = opcoes.parcial ?? false;
  }
}

/** Lê Retry-After (segundos ou data HTTP) de um objeto Headers. */
export function lerRetryAfter(headers: unknown): number | undefined {
  const h = headers as { get?: (n: string) => string | null } | undefined;
  const v = h?.get?.("retry-after");
  if (!v) return undefined;
  const s = Number(v);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const d = Date.parse(v);
  return Number.isFinite(d) ? Math.max(0, d - Date.now()) : undefined;
}
