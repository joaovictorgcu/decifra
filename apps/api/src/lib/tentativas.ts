/**
 * Limite de tentativas de login por e-mail (complementa o limite por IP).
 * Protege uma conta específica contra adivinhação de senha distribuída
 * entre vários IPs. Em memória: com várias instâncias, use um armazenamento
 * compartilhado (ver docs/PROXIMOS_PASSOS.md).
 */
export class LimiteTentativas {
  private registros = new Map<string, { falhas: number; inicio: number; bloqueadoAte: number }>();

  constructor(
    private readonly maxFalhas = 5,
    private readonly janelaMs = 15 * 60_000,
    private readonly bloqueioMs = 15 * 60_000,
    private readonly agora: () => number = Date.now,
  ) {}

  /** Milissegundos restantes de bloqueio para a chave (0 = liberada). */
  bloqueio(chave: string): number {
    const r = this.registros.get(chave);
    if (!r) return 0;
    const t = this.agora();
    if (r.bloqueadoAte > t) return r.bloqueadoAte - t;
    if (t - r.inicio > this.janelaMs) this.registros.delete(chave);
    return 0;
  }

  falha(chave: string) {
    const t = this.agora();
    this.limpar(t);
    const r = this.registros.get(chave);
    if (!r || t - r.inicio > this.janelaMs) {
      this.registros.set(chave, { falhas: 1, inicio: t, bloqueadoAte: 0 });
      return;
    }
    r.falhas++;
    if (r.falhas >= this.maxFalhas) r.bloqueadoAte = t + this.bloqueioMs;
  }

  sucesso(chave: string) {
    this.registros.delete(chave);
  }

  private limpar(t: number) {
    if (this.registros.size < 10_000) return;
    for (const [k, r] of this.registros) if (r.bloqueadoAte <= t && t - r.inicio > this.janelaMs) this.registros.delete(k);
  }
}
