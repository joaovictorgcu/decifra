import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { PrismaClient } from "@prisma/client";
import { criarApp } from "../src/app";
import { CATALOGO } from "../src/ai/catalogo";
import type { ConfigIA, ProvedorConfigurado } from "../src/ai/config";
import { ServicoIA, type RegistroInteracao } from "../src/ai/servico";
import { ErroIA, type IdProvedor, type PedidoConversa, type PedidoJSON, type ProvedorIA, type RespostaIA } from "../src/ai/tipos";
import { carregarEnv } from "../src/config/env";

process.env.DATABASE_URL = "file:./test-suite.db";
export const db = new PrismaClient();

/** Provedor de IA fake: responde por nome de schema; permite simular falhas e streaming. */
export class ProvedorFake implements ProvedorIA {
  respostas: Record<string, unknown> = {};
  falhar: ErroIA | null = null;
  /** Falha depois de N trechos de streaming (simula queda no meio da resposta). */
  falharAposTrechos: number | null = null;
  pedidos: { nomeSchema?: string; mensagem?: string; sistema: string; modelo: string }[] = [];
  textoChat = "Olá! Comece pelo mini-projeto de SQL.";
  atrasoMs = 0;

  constructor(readonly id: IdProvedor = "groq") {}

  async gerarJSON<T>(req: PedidoJSON<T>): Promise<RespostaIA<T>> {
    this.pedidos.push({ nomeSchema: req.nomeSchema, mensagem: req.mensagem, sistema: req.sistema, modelo: req.modelo });
    if (this.falhar) throw this.falhar;
    if (this.atrasoMs) await esperar(this.atrasoMs, req.signal);
    const r = req.schema.safeParse(this.respostas[req.nomeSchema]);
    if (!r.success) throw new ErroIA("invalido", "fake: fora do schema");
    return { dados: r.data, uso: { entrada: 10, saida: 5 }, modelo: req.modelo };
  }

  async conversar(req: PedidoConversa, aoReceber: (t: string) => void): Promise<RespostaIA<string>> {
    this.pedidos.push({ sistema: req.sistema, mensagem: req.mensagens.at(-1)?.conteudo, modelo: req.modelo });
    if (this.falhar && this.falharAposTrechos === null) throw this.falhar;
    for (const [i, parte] of this.textoChat.split(" ").entries()) {
      if (this.falharAposTrechos !== null && i === this.falharAposTrechos) throw this.falhar ?? new ErroIA("falha", "queda");
      if (this.atrasoMs) await esperar(this.atrasoMs, req.signal);
      aoReceber(`${parte} `);
    }
    return { dados: this.textoChat, uso: { entrada: 10, saida: 5 }, modelo: req.modelo };
  }
}

function esperar(ms: number, signal: AbortSignal) {
  return new Promise<void>((ok, falha) => {
    const t = setTimeout(ok, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), falha(new ErroIA("tempo", "abortado"))), { once: true });
  });
}

/** Configuração de IA para testes, com os provedores na ordem dada em todos os níveis. */
export function configTeste(ids: IdProvedor[], extra: Partial<ConfigIA> = {}): ConfigIA {
  const provedores = new Map<IdProvedor, ProvedorConfigurado>();
  for (const id of ids) {
    const def = CATALOGO[id];
    provedores.set(id, {
      def,
      modelos: { simples: `${id}-simples`, intermediaria: `${id}-intermediario`, complexa: `${id}-avancado` },
      privacidade: def.privacidade,
    });
  }
  const alvos = ids.map((provedor) => ({ provedor }));
  return {
    desligada: ids.length === 0,
    provedores,
    rotas: { simples: alvos, intermediaria: alvos, complexa: alvos },
    rotasTarefa: {},
    privacidade: "padrao",
    confiaveis: null,
    timeoutMs: 5000,
    maxTentativas: 3,
    limiteDiario: 150,
    limiteDiarioComplexa: 30,
    limiteMentorGratis: 20,
    limiteMentorPlus: 200,
    ...extra,
  };
}

export interface AppTeste {
  app: FastifyInstance;
  fake: ProvedorFake | null;
  logs: RegistroInteracao[];
}

export async function criarAppTeste(
  opcoes: { ia?: boolean; limite?: boolean; uso?: () => Promise<{ total: number; complexas: number }> } = {},
): Promise<AppTeste> {
  const env = carregarEnv({ ...process.env, NODE_ENV: "test", RATE_LIMIT: opcoes.limite ? "on" : "off", DATABASE_URL: "file:./test-suite.db", APP_ORIGIN: "http://localhost:5173" });
  const fake = opcoes.ia ? new ProvedorFake("groq") : null;
  const logs: RegistroInteracao[] = [];
  const cfg = configTeste(fake ? ["groq"] : []);
  const ia = new ServicoIA(cfg, new Map(fake ? [["groq", fake]] : []), { registrar: (r) => void logs.push(r), usoHoje: opcoes.uso });
  const app = await criarApp({ env, db, ia });
  await app.ready();
  return { app, fake, logs };
}

export async function limparBanco() {
  await db.aiInteraction.deleteMany();
  await db.user.deleteMany();
}

/** Cliente HTTP de teste que mantém o cookie de sessão, como um navegador. */
export class Cliente {
  cookie = "";
  constructor(private readonly app: FastifyInstance) {}

  async req(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, body?: unknown, extra: Record<string, string> = {}): Promise<LightMyRequestResponse> {
    const r = await this.app.inject({
      method,
      url,
      payload: body === undefined ? undefined : (body as object),
      headers: { "x-decifra": "1", origin: "http://localhost:5173", ...(this.cookie ? { cookie: this.cookie } : {}), ...extra },
    });
    const sc = r.headers["set-cookie"];
    const lista = Array.isArray(sc) ? sc : sc ? [sc] : [];
    for (const c of lista) {
      const par = c.split(";")[0]!;
      this.cookie = par.endsWith("=") ? "" : par;
    }
    return r;
  }
  get = (u: string) => this.req("GET", u);
  post = (u: string, b?: unknown) => this.req("POST", u, b ?? {});
  put = (u: string, b?: unknown) => this.req("PUT", u, b ?? {});
  patch = (u: string, b?: unknown) => this.req("PATCH", u, b ?? {});
  del = (u: string, b?: unknown) => this.req("DELETE", u, b);
}

export const DIAG = {
  destino: "dados",
  origem: "Assistente administrativa há 4 anos",
  situacao: "trabalha",
  tempo: "6a12",
  candidatou: "sim",
  atrapalha: ["Pouco retorno das empresas", "Vagas pedem experiência que não tenho"],
};

export const VAGA_DADOS = `Vaga: Analista de Dados Júnior

Requisitos:
- SQL
- Power BI
- Análise de indicadores
- 1 ano de experiência na área

Benefícios:
- Vale refeição`;

export async function novoCandidato(app: FastifyInstance, email = "ana@teste.dev", plano: "gratis" | "plus" = "gratis") {
  const c = new Cliente(app);
  const r = await c.post("/api/auth/cadastro", { nome: "Ana", email, senha: "senhaforte1", papel: "candidato" });
  if (r.statusCode !== 201) throw new Error(r.body);
  await c.put("/api/perfil/diagnostico", DIAG);
  if (plano === "plus") await db.user.update({ where: { email }, data: { plano: "plus" } });
  return c;
}

export async function novaEmpresa(app: FastifyInstance, email = "rh@empresa.dev") {
  const c = new Cliente(app);
  const r = await c.post("/api/auth/cadastro", { nome: "Empresa Teste", email, senha: "senhaforte1", papel: "empresa" });
  if (r.statusCode !== 201) throw new Error(r.body);
  return c;
}
