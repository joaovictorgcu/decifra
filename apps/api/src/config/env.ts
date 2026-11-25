import { z } from "zod";

/**
 * Configuração validada na inicialização. Variáveis ausentes ou inválidas
 * derrubam o processo com uma mensagem clara, em vez de falhar em produção.
 */
const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  /** Origem pública do app (usada na checagem de CSRF por Origin e nos links públicos). */
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  COOKIE_SECURE: z.string().optional(),
  /** Pasta com o build do frontend, servida pela API em produção. */
  WEB_DIST: z.string().optional(),
  /** Quantos proxies reversos confiáveis existem à frente da API (0 = nenhum). */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  /** "off" desliga o limite de requisições (apenas para testes automatizados). */
  RATE_LIMIT: z.enum(["on", "off"]).default("on"),

  /* ---------- IA ---------- */
  AI_PROVIDER: z.enum(["none", "anthropic", "openai", "openai-compatible", "mock"]).default("none"),
  AI_MODEL: z.string().optional(),
  AI_MODEL_FAST: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(60000),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** "default" ativa o fallback de recusa do lado do servidor para modelos que suportam; "off" desativa. */
  ANTHROPIC_FALLBACKS: z.enum(["default", "off"]).default("default"),
  OPENAI_API_KEY: z.string().optional(),
  /** Para provedores compatíveis com a API da OpenAI (Ollama, LM Studio, vLLM, OpenRouter...). */
  OPENAI_BASE_URL: z.string().url().optional(),
  AI_MENTOR_LIMITE_GRATIS: z.coerce.number().int().min(0).default(20),
  AI_MENTOR_LIMITE_PLUS: z.coerce.number().int().min(0).default(200),
  /** Teto diário de chamadas de IA por usuário (todas as tarefas). Acima dele, as tarefas usam o motor de regras. */
  AI_LIMITE_DIARIO: z.coerce.number().int().min(0).default(150),
});

export type Env = z.infer<typeof schema> & { cookieSecure: boolean; isProd: boolean };

export function carregarEnv(fonte: NodeJS.ProcessEnv = process.env): Env {
  const r = schema.safeParse(fonte);
  if (!r.success) {
    const msgs = r.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuração inválida:\n${msgs}`);
  }
  const e = r.data;
  const isProd = e.NODE_ENV === "production";
  if (e.AI_PROVIDER === "mock" && isProd) {
    throw new Error("AI_PROVIDER=mock é só para testes e não pode ser usado em produção.");
  }
  if (e.AI_PROVIDER === "anthropic" && !e.ANTHROPIC_API_KEY && !fonte.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("AI_PROVIDER=anthropic exige ANTHROPIC_API_KEY.");
  }
  if (e.AI_PROVIDER === "openai" && !e.OPENAI_API_KEY) {
    throw new Error("AI_PROVIDER=openai exige OPENAI_API_KEY.");
  }
  if (e.AI_PROVIDER === "openai-compatible" && !e.OPENAI_BASE_URL) {
    throw new Error("AI_PROVIDER=openai-compatible exige OPENAI_BASE_URL (ex.: http://localhost:11434/v1 para Ollama).");
  }
  if ((e.AI_PROVIDER === "openai-compatible" || e.AI_PROVIDER === "openai") && !e.AI_MODEL) {
    throw new Error(`AI_PROVIDER=${e.AI_PROVIDER} exige AI_MODEL (o nome do modelo no provedor escolhido).`);
  }
  const cookieSecure = e.COOKIE_SECURE ? e.COOKIE_SECURE === "true" : isProd;
  return { ...e, cookieSecure, isProd };
}
