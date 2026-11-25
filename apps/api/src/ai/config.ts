import { z } from "zod";
import { CATALOGO, PROVEDORES_GRATUITOS, PROVEDORES_PAGOS, type DefProvedor } from "./catalogo";
import { NIVEIS, TAREFAS, type IdProvedor, type Nivel, type Privacidade, type TarefaIA } from "./tipos";

/** Um destino de roteamento: provedor e, opcionalmente, um modelo específico. */
export interface Alvo {
  provedor: IdProvedor;
  modelo?: string;
}

export interface ProvedorConfigurado {
  def: DefProvedor;
  apiKey?: string;
  baseURL?: string;
  modelos: Record<Nivel, string>;
  privacidade: Privacidade;
  /** Campos extras no corpo da requisição (ex.: preferências de provedor do OpenRouter). */
  corpoExtra?: Record<string, unknown>;
  cabecalhos?: Record<string, string>;
  /** Fallback de recusa do lado do servidor (Anthropic). */
  anthropicFallbacks?: "default" | "off";
}

export interface ConfigIA {
  desligada: boolean;
  provedores: Map<IdProvedor, ProvedorConfigurado>;
  rotas: Record<Nivel, Alvo[]>;
  rotasTarefa: Partial<Record<TarefaIA, Alvo[]>>;
  privacidade: "padrao" | "estrita" | "aberta";
  /** Quando definido, substitui a classificação de privacidade do catálogo para tarefas sensíveis. */
  confiaveis: Set<IdProvedor> | null;
  timeoutMs: number;
  maxTentativas: number;
  limiteDiario: number;
  limiteDiarioComplexa: number;
  limiteMentorGratis: number;
  limiteMentorPlus: number;
}

const ID = z.enum(["groq", "gemini", "openrouter", "ollama", "anthropic", "openai", "compativel", "mock"]);
const lista = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined));
const vazioIndef = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));
const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  /** Legado e atalhos: none desliga a IA; mock é só para testes; auto (padrão) usa os provedores com chave. */
  AI_PROVIDER: z.enum(["auto", "none", "mock", "anthropic", "openai", "openai-compatible", "groq", "gemini", "openrouter", "ollama"]).default("auto"),
  AI_GRATUITO_PRINCIPAL: ID.default("groq"),
  AI_GRATUITO_SECUNDARIO: ID.default("gemini"),
  AI_AVANCADO: z.union([ID, z.literal("none")]).default("none"),
  AI_ROTA_SIMPLES: lista,
  AI_ROTA_INTERMEDIARIA: lista,
  AI_ROTA_COMPLEXA: lista,
  AI_DESATIVAR: lista,
  AI_PRIVACIDADE: z.enum(["padrao", "estrita", "aberta"]).default("padrao"),
  AI_PROVEDORES_CONFIAVEIS: lista,
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(60000),
  AI_MAX_TENTATIVAS: z.coerce.number().int().min(1).max(6).default(3),
  AI_LIMITE_DIARIO: z.coerce.number().int().min(0).default(150),
  AI_LIMITE_DIARIO_COMPLEXA: z.coerce.number().int().min(0).default(30),
  AI_MENTOR_LIMITE_GRATIS: z.coerce.number().int().min(0).default(20),
  AI_MENTOR_LIMITE_PLUS: z.coerce.number().int().min(0).default(200),

  GROQ_API_KEY: vazioIndef,
  GEMINI_API_KEY: vazioIndef,
  GEMINI_PLANO: z.enum(["gratuito", "pago"]).default("gratuito"),
  OPENROUTER_API_KEY: vazioIndef,
  OPENROUTER_SEM_COLETA: bool,
  OLLAMA_BASE_URL: vazioIndef,
  ANTHROPIC_API_KEY: vazioIndef,
  ANTHROPIC_FALLBACKS: z.enum(["default", "off"]).default("default"),
  OPENAI_API_KEY: vazioIndef,
  COMPAT_BASE_URL: vazioIndef,
  COMPAT_API_KEY: vazioIndef,
  COMPAT_PRIVACIDADE: z.enum(["local", "sem_treino", "pode_treinar"]).default("pode_treinar"),

  // Legado (versão 1): continuam funcionando.
  AI_MODEL: vazioIndef,
  AI_MODEL_FAST: vazioIndef,
  OPENAI_BASE_URL: vazioIndef,
});

const PREFIXO: Record<IdProvedor, string> = {
  groq: "GROQ",
  gemini: "GEMINI",
  openrouter: "OPENROUTER",
  ollama: "OLLAMA",
  anthropic: "ANTHROPIC",
  openai: "OPENAI",
  compativel: "COMPAT",
  mock: "MOCK",
};

/** Lê "groq" ou "groq:modelo" (o modelo pode ter ":" como em "qwen2.5:7b-instruct"). */
export function lerAlvo(txt: string): Alvo {
  const i = txt.indexOf(":");
  const prov = (i < 0 ? txt : txt.slice(0, i)).trim();
  const r = ID.safeParse(prov);
  if (!r.success) throw new Error(`Provedor de IA desconhecido em rota: "${prov}". Use: ${ID.options.join(", ")}.`);
  const modelo = i < 0 ? undefined : txt.slice(i + 1).trim() || undefined;
  return { provedor: r.data, modelo };
}

/**
 * Monta a configuração de IA a partir do ambiente. Falha com mensagem clara
 * quando algo está inconsistente (ex.: rota para provedor sem chave).
 */
export function carregarConfigIA(fonte: NodeJS.ProcessEnv, isProd: boolean, origemApp = "http://localhost:5173"): ConfigIA {
  const r = schema.safeParse(fonte);
  if (!r.success) {
    throw new Error(`Configuração de IA inválida:\n${r.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const e = r.data;
  const modo = e.AI_PROVIDER;
  const v = (nome: string) => {
    const x = fonte[nome];
    return x && x.trim() ? x.trim() : undefined;
  };

  if (modo === "mock" && isProd) throw new Error("AI_PROVIDER=mock é só para testes e não pode ser usado em produção.");

  const base: Omit<ConfigIA, "provedores" | "rotas" | "rotasTarefa" | "desligada"> = {
    privacidade: e.AI_PRIVACIDADE,
    confiaveis: e.AI_PROVEDORES_CONFIAVEIS ? new Set(e.AI_PROVEDORES_CONFIAVEIS.map((x) => lerAlvo(x).provedor)) : null,
    timeoutMs: e.AI_TIMEOUT_MS,
    maxTentativas: e.AI_MAX_TENTATIVAS,
    limiteDiario: e.AI_LIMITE_DIARIO,
    limiteDiarioComplexa: e.AI_LIMITE_DIARIO_COMPLEXA,
    limiteMentorGratis: e.AI_MENTOR_LIMITE_GRATIS,
    limiteMentorPlus: e.AI_MENTOR_LIMITE_PLUS,
  };
  const vazio = { simples: [], intermediaria: [], complexa: [] };
  if (modo === "none") return { ...base, desligada: true, provedores: new Map(), rotas: vazio, rotasTarefa: {} };

  // Compatibilidade com a configuração da versão 1 (um provedor para tudo).
  const legado: IdProvedor | null =
    modo === "anthropic" ? "anthropic" : modo === "openai" ? "openai" : modo === "openai-compatible" ? "compativel" : null;

  /* ---------- Provedores habilitados ---------- */
  const desativados = new Set((e.AI_DESATIVAR ?? []).map((x) => lerAlvo(x).provedor));
  const provedores = new Map<IdProvedor, ProvedorConfigurado>();

  const modelosDe = (id: IdProvedor): Record<Nivel, string> | null => {
    const def = CATALOGO[id];
    const geral = v(`${PREFIXO[id]}_MODEL`) ?? (legado === id ? e.AI_MODEL : undefined);
    const rapido = legado === id ? e.AI_MODEL_FAST : undefined;
    const out = {} as Record<Nivel, string>;
    for (const n of NIVEIS) {
      const especifico = v(`${PREFIXO[id]}_MODEL_${n.toUpperCase()}`);
      const m = especifico ?? (n !== "complexa" ? rapido : undefined) ?? geral ?? def.modelos[n];
      if (!m) return null;
      out[n] = m;
    }
    return out;
  };

  const adicionar = (id: IdProvedor, p: Omit<ProvedorConfigurado, "def" | "modelos" | "privacidade"> & { privacidade?: Privacidade }) => {
    if (desativados.has(id)) return;
    const modelos = modelosDe(id);
    if (!modelos) throw new Error(`Provedor ${CATALOGO[id].rotulo} habilitado sem modelo: defina ${PREFIXO[id]}_MODEL.`);
    provedores.set(id, { def: CATALOGO[id], modelos, privacidade: p.privacidade ?? CATALOGO[id].privacidade, ...p });
  };

  if (modo === "mock") {
    adicionar("mock", {});
  } else {
    if (e.GROQ_API_KEY) adicionar("groq", { apiKey: e.GROQ_API_KEY });
    if (e.GEMINI_API_KEY) adicionar("gemini", { apiKey: e.GEMINI_API_KEY, privacidade: e.GEMINI_PLANO === "pago" ? "sem_treino" : "pode_treinar" });
    if (e.OPENROUTER_API_KEY) {
      adicionar("openrouter", {
        apiKey: e.OPENROUTER_API_KEY,
        cabecalhos: { "HTTP-Referer": origemApp, "X-OpenRouter-Title": "DECIFRA" },
        corpoExtra: e.OPENROUTER_SEM_COLETA ? { provider: { data_collection: "deny" } } : undefined,
        privacidade: e.OPENROUTER_SEM_COLETA ? "sem_treino" : "pode_treinar",
      });
    }
    if (v("OLLAMA_MODEL") || e.OLLAMA_BASE_URL) adicionar("ollama", { baseURL: e.OLLAMA_BASE_URL ?? CATALOGO.ollama.baseURL, apiKey: "ollama" });
    if (e.ANTHROPIC_API_KEY || fonte.ANTHROPIC_AUTH_TOKEN) adicionar("anthropic", { apiKey: e.ANTHROPIC_API_KEY, anthropicFallbacks: e.ANTHROPIC_FALLBACKS });
    // Na v1, OPENAI_API_KEY + openai-compatible apontava para o servidor compatível.
    if (e.OPENAI_API_KEY && legado !== "compativel") adicionar("openai", { apiKey: e.OPENAI_API_KEY });
    const compatURL = e.COMPAT_BASE_URL ?? (legado === "compativel" ? e.OPENAI_BASE_URL : undefined);
    if (compatURL) {
      adicionar("compativel", {
        baseURL: compatURL,
        apiKey: e.COMPAT_API_KEY ?? (legado === "compativel" ? e.OPENAI_API_KEY : undefined) ?? "nao-necessaria",
        privacidade: e.COMPAT_PRIVACIDADE,
      });
    }
  }

  if (legado && !provedores.has(legado)) {
    throw new Error(`AI_PROVIDER=${modo} exige a chave/URL desse provedor (${CATALOGO[legado].ambiente}).`);
  }
  const forcado: IdProvedor | null =
    legado ?? (["groq", "gemini", "openrouter", "ollama"].includes(modo) ? (modo as IdProvedor) : null);
  if (forcado && !provedores.has(forcado)) throw new Error(`AI_PROVIDER=${modo} exige ${CATALOGO[forcado].ambiente}.`);

  /* ---------- Rotas ---------- */
  const conferir = (alvos: Alvo[], origem: string) => {
    for (const a of alvos) {
      if (!desativados.has(a.provedor) && !provedores.has(a.provedor) && a.provedor !== "mock") {
        throw new Error(`${origem} usa "${a.provedor}", que não está habilitado (${CATALOGO[a.provedor].ambiente}).`);
      }
    }
    return alvos.filter((a) => provedores.has(a.provedor));
  };
  const unicos = (ids: (IdProvedor | "none")[]) => [...new Set(ids.filter((x): x is IdProvedor => x !== "none" && provedores.has(x as IdProvedor)))];
  const gratuitos = PROVEDORES_GRATUITOS.filter((x) => provedores.has(x));
  const pagos = PROVEDORES_PAGOS.filter((x) => provedores.has(x));
  const p1 = e.AI_GRATUITO_PRINCIPAL;
  const p2 = e.AI_GRATUITO_SECUNDARIO;
  const av = e.AI_AVANCADO;
  if (av !== "none" && !provedores.has(av) && !desativados.has(av)) {
    throw new Error(`AI_AVANCADO=${av}, mas o provedor não está habilitado (${CATALOGO[av].ambiente}).`);
  }

  const padrao: Record<Nivel, IdProvedor[]> = forcado
    ? { simples: [forcado], intermediaria: [forcado], complexa: [forcado] }
    : provedores.has("mock")
      ? { simples: ["mock"], intermediaria: ["mock"], complexa: ["mock"] }
      : {
          // Tarefas simples e intermediárias: provedores gratuitos primeiro; pagos ficam como último recurso.
          simples: unicos([p1, p2, ...gratuitos, ...pagos]),
          intermediaria: unicos([p1, p2, ...gratuitos, ...pagos]),
          // Tarefas complexas: o provedor avançado (se houver) vem antes dos gratuitos.
          complexa: unicos([av, p2, p1, ...gratuitos, ...pagos]),
        };
  const doAmbiente: Record<Nivel, string[] | undefined> = {
    simples: e.AI_ROTA_SIMPLES,
    intermediaria: e.AI_ROTA_INTERMEDIARIA,
    complexa: e.AI_ROTA_COMPLEXA,
  };
  const rotas = {} as Record<Nivel, Alvo[]>;
  for (const n of NIVEIS) {
    const lista = doAmbiente[n];
    rotas[n] = lista ? conferir(lista.map(lerAlvo), `AI_ROTA_${n.toUpperCase()}`) : padrao[n].map((p) => ({ provedor: p }));
  }

  const rotasTarefa: Partial<Record<TarefaIA, Alvo[]>> = {};
  for (const t of TAREFAS) {
    const bruto = v(`AI_ROTA_${t.toUpperCase()}`);
    if (bruto) rotasTarefa[t] = conferir(bruto.split(",").map((s) => lerAlvo(s.trim())), `AI_ROTA_${t.toUpperCase()}`);
    // Legado: AI_MODEL_<TAREFA> trocava só o modelo do provedor único.
    const leg = v(`AI_MODEL_${t.toUpperCase()}`);
    if (!bruto && leg && legado) rotasTarefa[t] = [{ provedor: legado, modelo: leg }];
  }

  return { ...base, desligada: provedores.size === 0, provedores, rotas, rotasTarefa };
}

/** Resumo seguro (sem chaves) para logs de inicialização. */
export function resumoConfig(c: ConfigIA) {
  if (c.desligada) return { ia: "desligada (motor de regras)" };
  return {
    provedores: [...c.provedores.values()].map((p) => `${p.def.id}(${p.privacidade})`),
    rotas: Object.fromEntries(NIVEIS.map((n) => [n, c.rotas[n].map((a) => a.provedor).join(">")])),
    privacidade: c.privacidade,
  };
}
