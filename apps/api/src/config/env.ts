import { z } from "zod";

/**
 * Configuração validada na inicialização. Variáveis ausentes ou inválidas
 * derrubam o processo com uma mensagem clara, em vez de falhar em produção.
 */
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
  /** Fuso das datas do produto: prazos, "hoje" e a virada das cotas diárias e mensais. */
  APP_TZ: z
    .string()
    .default("America/Sao_Paulo")
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-CA", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Fuso horário inválido (use um nome IANA, ex.: America/Sao_Paulo)."),
  // A configuração de IA é validada em src/ai/config.ts.
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
  const cookieSecure = e.COOKIE_SECURE ? e.COOKIE_SECURE === "true" : isProd;
  return { ...e, cookieSecure, isProd };
}
