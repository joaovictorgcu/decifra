import type { ErroApi, MensagemMentor } from "@decifra/shared";

/** Erro de API com mensagem pronta para o usuário e código estável. */
export class ErroRequisicao extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly campo?: string,
  ) {
    super(mensagem);
    this.name = "ErroRequisicao";
  }
}

const CABECALHOS = { "x-decifra": "1" };

async function tratar<T>(r: Response): Promise<T> {
  const tipo = r.headers.get("content-type") ?? "";
  const corpo: unknown = tipo.includes("application/json") ? await r.json().catch(() => null) : null;
  if (!r.ok) {
    const e = (corpo ?? {}) as Partial<ErroApi>;
    throw new ErroRequisicao(r.status, e.codigo ?? "http", e.erro ?? "Não foi possível concluir. Tente de novo.", e.campo);
  }
  return corpo as T;
}

async function requisitar<T>(metodo: string, url: string, corpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api${url}`, {
      method: metodo,
      credentials: "same-origin",
      headers: corpo === undefined ? CABECALHOS : { ...CABECALHOS, "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroRequisicao(0, "rede", "Sem conexão com o servidor. Verifique sua internet e tente de novo.");
  }
  return tratar<T>(r);
}

export const api = {
  get: <T>(url: string) => requisitar<T>("GET", url),
  post: <T>(url: string, corpo: unknown = {}) => requisitar<T>("POST", url, corpo),
  put: <T>(url: string, corpo: unknown) => requisitar<T>("PUT", url, corpo),
  patch: <T>(url: string, corpo: unknown) => requisitar<T>("PATCH", url, corpo),
  del: <T>(url: string, corpo?: unknown) => requisitar<T>("DELETE", url, corpo),

  async enviarArquivo<T>(url: string, arquivo: File): Promise<T> {
    const form = new FormData();
    form.append("arquivo", arquivo);
    let r: Response;
    try {
      r = await fetch(`/api${url}`, { method: "POST", credentials: "same-origin", headers: CABECALHOS, body: form });
    } catch {
      throw new ErroRequisicao(0, "rede", "Sem conexão com o servidor. Verifique sua internet e tente de novo.");
    }
    return tratar<T>(r);
  },
};

/**
 * Separa eventos completos de um buffer SSE ("event: x\ndata: y\n\n").
 * Devolve os eventos prontos e o resto ainda incompleto (chegará no próximo pedaço).
 */
export function extrairEventosSSE(buffer: string): { eventos: { evento: string; dados: string }[]; resto: string } {
  const eventos: { evento: string; dados: string }[] = [];
  let resto = buffer.replace(/\r\n/g, "\n");
  let fim: number;
  while ((fim = resto.indexOf("\n\n")) >= 0) {
    const bloco = resto.slice(0, fim);
    resto = resto.slice(fim + 2);
    let evento = "message";
    const dados: string[] = [];
    for (const linha of bloco.split("\n")) {
      if (linha.startsWith("event:")) evento = linha.slice(6).trim();
      else if (linha.startsWith("data:")) dados.push(linha.slice(5).replace(/^ /, ""));
    }
    if (dados.length || evento !== "message") eventos.push({ evento, dados: dados.join("\n") });
  }
  return { eventos, resto };
}

export interface EventosMentor {
  /** Provedor e modelo que estão respondendo (ex.: "Groq · gpt-oss-120b"). */
  meta?: (ia: string) => void;
  trecho: (t: string) => void;
  fim?: (d: { conversaId: string; titulo: string; mensagem: MensagemMentor }) => void;
  erro?: (mensagem: string, codigo?: string) => void;
}

/** Envia uma mensagem ao Mentor e lê a resposta em streaming (Server-Sent Events via fetch). */
export async function conversarComMentor(corpo: { conversaId?: string; mensagem: string }, ev: EventosMentor, signal?: AbortSignal) {
  let r: Response;
  try {
    r = await fetch("/api/mentor/mensagens", {
      method: "POST",
      credentials: "same-origin",
      headers: { ...CABECALHOS, "content-type": "application/json" },
      body: JSON.stringify(corpo),
      signal,
    });
  } catch {
    if (signal?.aborted) return;
    throw new ErroRequisicao(0, "rede", "Sem conexão com o servidor.");
  }
  if (!r.ok || !r.body) {
    await tratar(r);
    return;
  }
  const leitor = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += value;
      const lido = extrairEventosSSE(buffer);
      buffer = lido.resto;
      for (const { evento, dados } of lido.eventos) {
        const json = (dados ? JSON.parse(dados) : {}) as Record<string, unknown>;
        if (evento === "meta") ev.meta?.(json.ia as string);
        else if (evento === "trecho") ev.trecho(json.t as string);
        else if (evento === "fim") ev.fim?.(json as unknown as Parameters<NonNullable<EventosMentor["fim"]>>[0]);
        else if (evento === "erro") ev.erro?.(json.erro as string, json.codigo as string | undefined);
      }
    }
  } catch {
    // Cancelado pela pessoa: o servidor guarda o que já foi gerado.
    if (signal?.aborted) return;
    throw new ErroRequisicao(0, "rede", "A conexão caiu durante a resposta.");
  }
}
