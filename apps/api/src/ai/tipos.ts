import type { z } from "zod";

/**
 * Contrato que todo provedor de IA implementa. O resto do sistema só conhece
 * esta interface: trocar de provedor ou de modelo não exige mudar regras de negócio.
 */
export interface ProvedorIA {
  readonly nome: string;
  /** Gera uma resposta estruturada, validada contra o schema Zod. */
  gerarJSON<T>(req: PedidoJSON<T>): Promise<RespostaIA<T>>;
  /** Conversa em texto livre com streaming de trechos via `aoReceber`. */
  conversar(req: PedidoConversa, aoReceber: (trecho: string) => void): Promise<RespostaIA<string>>;
}

export type Esforco = "low" | "medium" | "high";

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

export type MotivoFalhaIA = "desativada" | "recusa" | "invalido" | "tempo" | "limite" | "autenticacao" | "falha";

/** Erro normalizado de qualquer provedor. */
export class ErroIA extends Error {
  constructor(
    readonly motivo: MotivoFalhaIA,
    mensagem: string,
    readonly causa?: unknown,
  ) {
    super(mensagem);
    this.name = "ErroIA";
  }
}

/** Tarefas de IA do produto. Cada uma tem modelo, esforço e limites próprios. */
export type TarefaIA = "extrair_requisitos" | "traduzir" | "historia" | "feedback" | "importar_cv" | "mentor";
