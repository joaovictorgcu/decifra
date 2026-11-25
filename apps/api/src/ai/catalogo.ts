import type { IdProvedor, Nivel, Privacidade } from "./tipos";

/**
 * Catálogo de provedores. Os modelos padrão foram conferidos na documentação
 * oficial de cada fornecedor em 25/11/2026 (ver docs/IA.md). Todos podem ser
 * trocados por variável de ambiente sem mudar código: <PROVEDOR>_MODEL ou
 * <PROVEDOR>_MODEL_SIMPLES / _INTERMEDIARIA / _COMPLEXA.
 */
export interface DefProvedor {
  id: IdProvedor;
  /** Nome mostrado ao usuário. */
  rotulo: string;
  tipo: "anthropic" | "openai" | "mock";
  /** Sem custo por chamada no uso típico (plano gratuito ou execução local). */
  gratuito: boolean;
  privacidade: Privacidade;
  baseURL?: string;
  /** Nome do parâmetro de limite de saída na API compatível com OpenAI. */
  paramLimite: "max_tokens" | "max_completion_tokens";
  /** Formato de saída estruturada preferido. Se o servidor recusar json_schema, cai para json_object. */
  formatoJson: "json_schema" | "json_object";
  /** Envia reasoning_effort (só onde a documentação confirma o parâmetro). */
  enviaEsforco: boolean;
  modelos: Partial<Record<Nivel, string>>;
  /** Variáveis de ambiente que habilitam o provedor. */
  ambiente: string;
}

export const CATALOGO: Record<IdProvedor, DefProvedor> = {
  groq: {
    id: "groq",
    rotulo: "Groq",
    tipo: "openai",
    gratuito: true,
    // Termos: não treina com entradas/saídas; por padrão não retém dados de inferência (logs de abuso por até 30 dias, ZDR opcional).
    privacidade: "sem_treino",
    baseURL: "https://api.groq.com/openai/v1",
    paramLimite: "max_completion_tokens",
    formatoJson: "json_schema", // strict: GPT-OSS 20B/120B
    enviaEsforco: false,
    modelos: { simples: "openai/gpt-oss-20b", intermediaria: "openai/gpt-oss-120b", complexa: "openai/gpt-oss-120b" },
    ambiente: "GROQ_API_KEY",
  },
  gemini: {
    id: "gemini",
    rotulo: "Google Gemini",
    tipo: "openai",
    gratuito: true,
    // Plano gratuito: o Google usa entradas e saídas para melhorar produtos e pode haver revisão humana. GEMINI_PLANO=pago muda para sem_treino.
    privacidade: "pode_treinar",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    paramLimite: "max_tokens",
    formatoJson: "json_schema",
    enviaEsforco: true,
    modelos: { simples: "gemini-3.5-flash-lite", intermediaria: "gemini-3.8-flash", complexa: "gemini-4-hydrogen" },
    ambiente: "GEMINI_API_KEY",
  },
  openrouter: {
    id: "openrouter",
    rotulo: "OpenRouter",
    tipo: "openai",
    gratuito: true,
    // Depende do provedor que atende o modelo; endpoints gratuitos podem registrar/treinar. OPENROUTER_SEM_COLETA=true pede data_collection: deny.
    privacidade: "pode_treinar",
    baseURL: "https://openrouter.ai/api/v1",
    paramLimite: "max_tokens",
    formatoJson: "json_schema",
    enviaEsforco: false,
    modelos: {}, // o catálogo de modelos ":free" muda com frequência: escolha em OPENROUTER_MODEL
    ambiente: "OPENROUTER_API_KEY + OPENROUTER_MODEL",
  },
  ollama: {
    id: "ollama",
    rotulo: "Ollama (local)",
    tipo: "openai",
    gratuito: true,
    privacidade: "local",
    baseURL: "http://localhost:11434/v1",
    paramLimite: "max_tokens",
    formatoJson: "json_object",
    enviaEsforco: false,
    modelos: {}, // depende do que foi baixado (ollama pull): defina OLLAMA_MODEL
    ambiente: "OLLAMA_MODEL",
  },
  anthropic: {
    id: "anthropic",
    rotulo: "Anthropic Claude",
    tipo: "anthropic",
    gratuito: false,
    privacidade: "sem_treino",
    paramLimite: "max_tokens",
    formatoJson: "json_schema",
    enviaEsforco: true,
    modelos: { simples: "claude-haiku-5-5", intermediaria: "claude-sonnet-5-5", complexa: "claude-opus-5-5" },
    ambiente: "ANTHROPIC_API_KEY",
  },
  openai: {
    id: "openai",
    rotulo: "OpenAI",
    tipo: "openai",
    gratuito: false,
    privacidade: "sem_treino",
    paramLimite: "max_completion_tokens",
    formatoJson: "json_schema",
    enviaEsforco: false,
    modelos: { simples: "gpt-6-luna", intermediaria: "gpt-6.1-terra", complexa: "gpt-6.2-sol" },
    ambiente: "OPENAI_API_KEY",
  },
  compativel: {
    id: "compativel",
    rotulo: "Servidor compatível",
    tipo: "openai",
    gratuito: true,
    privacidade: "pode_treinar", // desconhecido por padrão; ajuste com COMPAT_PRIVACIDADE
    paramLimite: "max_tokens",
    formatoJson: "json_object",
    enviaEsforco: false,
    modelos: {},
    ambiente: "COMPAT_BASE_URL + COMPAT_MODEL",
  },
  mock: {
    id: "mock",
    rotulo: "Simulador de testes",
    tipo: "mock",
    gratuito: true,
    privacidade: "local",
    paramLimite: "max_tokens",
    formatoJson: "json_object",
    enviaEsforco: false,
    modelos: { simples: "mock-simples", intermediaria: "mock-intermediario", complexa: "mock-avancado" },
    ambiente: "AI_PROVIDER=mock",
  },
};

export const PROVEDORES_GRATUITOS: IdProvedor[] = ["groq", "gemini", "openrouter", "ollama", "compativel"];
export const PROVEDORES_PAGOS: IdProvedor[] = ["anthropic", "openai"];
