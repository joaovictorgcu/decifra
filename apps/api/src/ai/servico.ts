import type { z } from "zod";
import { CATALOGO } from "./catalogo";
import type { ConfigIA } from "./config";
import { Disjuntor } from "./disjuntor";
import { ProvedorAnthropic } from "./providers/anthropic";
import { ProvedorMock } from "./providers/mock";
import { ProvedorCompativel } from "./providers/openai-compativel";
import { classificar, PERFIS, permitido, planejar, type Sinais } from "./roteador";
import { ErroIA, type IdProvedor, type MensagemIA, type MetaIA, type Nivel, type ProvedorIA, type TarefaIA, type UsoIA } from "./tipos";

export interface RegistroInteracao {
  userId: string | null;
  tarefa: TarefaIA;
  nivel: Nivel;
  provedor: string;
  modelo: string;
  tentativa: number;
  status: "ok" | "invalido" | "erro" | "recusa" | "limite" | "cancelado" | "descartado";
  latenciaMs: number;
  tokensEntrada: number;
  tokensSaida: number;
  erro: string;
}

export interface Dependencias {
  registrar: (r: RegistroInteracao) => Promise<void> | void;
  /** Uso de IA do usuário hoje: total de chamadas e quantas foram de nível complexo. */
  usoHoje?: (userId: string) => Promise<{ total: number; complexas: number }>;
  agora?: () => number;
  disjuntor?: Disjuntor;
}

export interface Resultado<T> {
  dados: T;
  meta: MetaIA;
}

/**
 * Ponto único de acesso à IA. Recebe a tarefa e sinais objetivos, escolhe o
 * nível e a ordem de provedores (roteador.ts), tenta cada um respeitando
 * privacidade, disjuntor, cotas e limite de tentativas, e registra tudo.
 * As rotas HTTP não sabem qual provedor existe.
 */
export class ServicoIA {
  private readonly disjuntor: Disjuntor;
  private readonly agora: () => number;

  constructor(
    readonly cfg: ConfigIA,
    private readonly provedores: Map<IdProvedor, ProvedorIA>,
    private readonly deps: Dependencias,
  ) {
    this.disjuntor = deps.disjuntor ?? new Disjuntor();
    this.agora = deps.agora ?? Date.now;
  }

  get ativa(): boolean {
    return !this.cfg.desligada && this.provedores.size > 0;
  }

  /** Para a interface: a tarefa tem algum provedor configurado e permitido pela política de privacidade? */
  disponivelPara(tarefa: TarefaIA): boolean {
    if (!this.ativa) return false;
    const sens = PERFIS[tarefa].sensibilidade;
    const rotas = this.cfg.rotasTarefa[tarefa] ?? [...this.cfg.rotas.simples, ...this.cfg.rotas.intermediaria, ...this.cfg.rotas.complexa];
    return rotas.some((a) => this.provedores.has(a.provedor) && permitido(this.cfg, a.provedor, sens));
  }

  /** Nomes amigáveis dos provedores ativos. */
  get rotulos(): string[] {
    return [...this.provedores.keys()].map((id) => CATALOGO[id].rotulo);
  }

  async gerarJSON<T>(
    tarefa: TarefaIA,
    userId: string | null,
    p: { sistema: string; mensagem: string; schema: z.ZodType<T>; nomeSchema: string },
    sinais: Sinais = {},
    sinalExterno?: AbortSignal,
  ): Promise<Resultado<T>> {
    return this.executar(tarefa, userId, sinais, sinalExterno, async (prov, modelo, nivel, signal) => {
      const perfil = PERFIS[tarefa];
      const r = await prov.gerarJSON({ ...p, modelo, esforco: perfil.esforco[nivel], maxTokens: perfil.maxTokens, signal });
      return { valor: r.dados, uso: r.uso, modelo: r.modelo };
    });
  }

  /**
   * Conversa em streaming. Se um provedor falhar antes do primeiro trecho, tenta
   * o próximo; depois que o texto começou a chegar, não troca de provedor (para
   * não misturar respostas) e a falha é informada como parcial.
   */
  async conversar(
    tarefa: TarefaIA,
    userId: string | null,
    p: { sistema: string; mensagens: MensagemIA[] },
    ev: { aoReceber: (trecho: string) => void; aoIniciar?: (meta: MetaIA) => void },
    sinais: Sinais = {},
    sinalExterno?: AbortSignal,
  ): Promise<Resultado<string>> {
    return this.executar(tarefa, userId, sinais, sinalExterno, async (prov, modelo, nivel, signal, meta) => {
      const perfil = PERFIS[tarefa];
      let iniciou = false;
      try {
        const r = await prov.conversar({ ...p, modelo, esforco: perfil.esforco[nivel], maxTokens: perfil.maxTokens, signal }, (t) => {
          if (!iniciou) {
            iniciou = true;
            ev.aoIniciar?.(meta);
          }
          ev.aoReceber(t);
        });
        return { valor: r.dados, uso: r.uso, modelo: r.modelo };
      } catch (e) {
        if (iniciou) {
          const x = e instanceof ErroIA ? e : new ErroIA("falha", "Falha no stream", { causa: e });
          throw new ErroIA(x.motivo, x.message, { causa: x.causa, aposMs: x.aposMs, parcial: true });
        }
        throw e;
      }
    });
  }

  private async executar<R>(
    tarefa: TarefaIA,
    userId: string | null,
    sinais: Sinais,
    sinalExterno: AbortSignal | undefined,
    fn: (prov: ProvedorIA, modelo: string, nivel: Nivel, signal: AbortSignal, meta: MetaIA) => Promise<{ valor: R; uso: UsoIA; modelo: string }>,
  ): Promise<Resultado<R>> {
    if (!this.ativa) throw new ErroIA("desativada", "Nenhum provedor de IA configurado.");
    let nivel = classificar(tarefa, sinais);

    // Cotas por usuário: teto diário geral e teto de chamadas complexas (que usam modelos mais caros).
    if (userId && this.deps.usoHoje) {
      const uso = await this.deps.usoHoje(userId);
      if (uso.total >= this.cfg.limiteDiario) throw new ErroIA("cota", "Limite diário de uso da IA atingido.");
      if (nivel === "complexa" && uso.complexas >= this.cfg.limiteDiarioComplexa) nivel = "intermediaria";
    }

    const plano = planejar(this.cfg, tarefa, nivel, this.disjuntor, this.agora());
    if (!plano.alvos.length) {
      if (plano.emPausa.length) {
        const ate = Math.min(...plano.emPausa.map((x) => x.ate));
        throw new ErroIA("indisponivel", "Os provedores de IA estão temporariamente indisponíveis.", { aposMs: ate - this.agora() });
      }
      throw new ErroIA(plano.vetadosPrivacidade.length ? "privacidade" : "desativada", "Nenhum provedor permitido para esta tarefa.");
    }

    let ultimo: ErroIA | null = null;
    let soLimite = true;
    let menorEspera: number | undefined;
    const tentativas = plano.alvos.slice(0, this.cfg.maxTentativas);
    for (const [i, alvo] of tentativas.entries()) {
      const prov = this.provedores.get(alvo.provedor)!;
      const meta: MetaIA = { provedor: alvo.provedor, rotulo: CATALOGO[alvo.provedor].rotulo, modelo: alvo.modelo, nivel };
      const inicio = this.agora();
      const sinais_ = [AbortSignal.timeout(this.cfg.timeoutMs)];
      if (sinalExterno) sinais_.push(sinalExterno);
      const signal = AbortSignal.any(sinais_);
      try {
        if (sinalExterno?.aborted) throw new ErroIA("cancelado", "Cancelado.");
        const r = await fn(prov, alvo.modelo, nivel, signal, meta);
        this.disjuntor.sucesso(alvo.provedor);
        const modelo = r.modelo || alvo.modelo;
        await this.log({ userId, tarefa, nivel, provedor: alvo.provedor, modelo, tentativa: i + 1, status: "ok", inicio, uso: r.uso, erro: "" });
        return { dados: r.valor, meta: { ...meta, modelo } };
      } catch (e) {
        let erro = e instanceof ErroIA ? e : new ErroIA("falha", e instanceof Error ? e.message : "Falha na IA", { causa: e });
        if (sinalExterno?.aborted) erro = new ErroIA("cancelado", "Cancelado pela pessoa.", { parcial: erro.parcial });
        const status: RegistroInteracao["status"] =
          erro.motivo === "cancelado" ? "cancelado" : erro.motivo === "recusa" ? "recusa" : erro.motivo === "invalido" ? "invalido" : erro.motivo === "limite" ? "limite" : "erro";
        await this.log({ userId, tarefa, nivel, provedor: alvo.provedor, modelo: alvo.modelo, tentativa: i + 1, status, inicio, uso: { entrada: 0, saida: 0 }, erro: `${erro.motivo}: ${erro.message}` });
        if (erro.motivo === "cancelado") throw erro;
        this.disjuntor.falha(alvo.provedor, erro.motivo, this.agora(), erro.aposMs);
        // Depois de parte da resposta enviada, não dá para trocar de provedor sem confundir quem lê.
        if (erro.parcial) throw erro;
        ultimo = erro;
        if (erro.motivo !== "limite") soLimite = false;
        else if (erro.aposMs !== undefined) menorEspera = Math.min(menorEspera ?? Infinity, erro.aposMs);
      }
    }
    if (ultimo && soLimite) throw new ErroIA("limite", "Os provedores de IA atingiram o limite de uso.", { aposMs: menorEspera ?? 60_000 });
    if (ultimo?.motivo === "invalido" || ultimo?.motivo === "recusa") throw ultimo;
    throw new ErroIA("indisponivel", "Os provedores de IA não responderam.", { causa: ultimo });
  }

  private async log(r: {
    userId: string | null;
    tarefa: TarefaIA;
    nivel: Nivel;
    provedor: string;
    modelo: string;
    tentativa: number;
    status: RegistroInteracao["status"];
    inicio: number;
    uso: UsoIA;
    erro: string;
  }) {
    try {
      await this.deps.registrar({
        userId: r.userId,
        tarefa: r.tarefa,
        nivel: r.nivel,
        provedor: r.provedor,
        modelo: r.modelo,
        tentativa: r.tentativa,
        status: r.status,
        latenciaMs: Math.max(0, this.agora() - r.inicio),
        tokensEntrada: r.uso.entrada,
        tokensSaida: r.uso.saida,
        erro: r.erro.slice(0, 300),
      });
    } catch {
      /* O registro nunca deve derrubar a resposta ao usuário. */
    }
  }

  /**
   * Registra que uma resposta válida no formato foi descartada pela validação de
   * domínio ou pelos princípios (ex.: prometeu contratação). Ajuda a medir a
   * qualidade de cada modelo.
   */
  async registrarDescarte(tarefa: TarefaIA, userId: string | null, meta: MetaIA, motivo: string) {
    await this.log({ userId, tarefa, nivel: meta.nivel, provedor: meta.provedor, modelo: meta.modelo, tentativa: 0, status: "descartado", inicio: this.agora(), uso: { entrada: 0, saida: 0 }, erro: motivo });
  }

  /** Estado do disjuntor (sem dados sensíveis), para diagnóstico. */
  estado() {
    return this.disjuntor.estado(this.agora());
  }
}

/** Cria os clientes dos provedores habilitados na configuração. */
export function criarProvedores(cfg: ConfigIA): Map<IdProvedor, ProvedorIA> {
  const m = new Map<IdProvedor, ProvedorIA>();
  for (const [id, p] of cfg.provedores) {
    if (p.def.tipo === "anthropic") m.set(id, new ProvedorAnthropic(p));
    else if (p.def.tipo === "mock") m.set(id, new ProvedorMock());
    else m.set(id, new ProvedorCompativel(p));
  }
  return m;
}
