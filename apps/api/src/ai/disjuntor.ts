import type { IdProvedor, MotivoFalhaIA } from "./tipos";

/**
 * Disjuntor (circuit breaker) por provedor, em memória. Evita insistir em um
 * provedor que acabou de falhar:
 * - 429 (limite): pausa pelo Retry-After informado, ou 60 s;
 * - credencial inválida: pausa de 15 min (só volta com correção da chave);
 * - falhas transitórias (timeout, 5xx, conexão): abre após 3 seguidas, por 30 s;
 * - resposta inválida e recusa não pausam (são da requisição, não do provedor).
 */
export class Disjuntor {
  private falhas = new Map<IdProvedor, number>();
  private abertoAte = new Map<IdProvedor, number>();

  constructor(
    private readonly opcoes = { limiteFalhas: 3, pausaFalhaMs: 30_000, pausaLimiteMs: 60_000, pausaAutenticacaoMs: 15 * 60_000, pausaMaximaMs: 30 * 60_000 },
  ) {}

  pausadoAte(id: IdProvedor, agora: number): number | null {
    const ate = this.abertoAte.get(id);
    if (!ate) return null;
    if (ate <= agora) {
      this.abertoAte.delete(id);
      this.falhas.set(id, 0);
      return null;
    }
    return ate;
  }

  sucesso(id: IdProvedor) {
    this.falhas.set(id, 0);
    this.abertoAte.delete(id);
  }

  falha(id: IdProvedor, motivo: MotivoFalhaIA, agora: number, aposMs?: number) {
    const pausar = (ms: number) => this.abertoAte.set(id, agora + Math.min(ms, this.opcoes.pausaMaximaMs));
    switch (motivo) {
      case "limite":
        pausar(aposMs ?? this.opcoes.pausaLimiteMs);
        return;
      case "autenticacao":
        pausar(this.opcoes.pausaAutenticacaoMs);
        return;
      case "tempo":
      case "falha":
      case "requisicao": {
        const n = (this.falhas.get(id) ?? 0) + 1;
        this.falhas.set(id, n);
        if (n >= this.opcoes.limiteFalhas) pausar(this.opcoes.pausaFalhaMs);
        return;
      }
      default:
        return;
    }
  }

  /** Esquece falhas e pausas (usado em testes e por quem quiser forçar nova tentativa). */
  reiniciar() {
    this.falhas.clear();
    this.abertoAte.clear();
  }

  /** Estado para diagnóstico (sem dados sensíveis). */
  estado(agora: number) {
    return [...this.abertoAte.entries()].filter(([, ate]) => ate > agora).map(([provedor, ate]) => ({ provedor, segundos: Math.ceil((ate - agora) / 1000) }));
  }
}
