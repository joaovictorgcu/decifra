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
  } catch (e) {
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
      let fimBloco: number;
      while ((fimBloco = buffer.indexOf("\n\n")) >= 0) {
        const bloco = buffer.slice(0, fimBloco);
        buffer = buffer.slice(fimBloco + 2);
        let evento = "message";
        let dados = "";
        for (const linha of bloco.split("\n")) {
          if (linha.startsWith("event: ")) evento = linha.slice(7);
          else if (linha.startsWith("data: ")) dados += linha.slice(6);
        }
        const json = dados ? JSON.parse(dados) : {};
        if (evento === "meta") ev.meta?.(json.ia);
        else if (evento === "trecho") ev.trecho(json.t);
        else if (evento === "fim") ev.fim?.(json);
        else if (evento === "erro") ev.erro?.(json.erro, json.codigo);
      }
    }
  } catch (e) {
    // Cancelado pela pessoa: o servidor guarda o que já foi gerado.
    if (signal?.aborted) return;
    throw new ErroRequisicao(0, "rede", "A conexão caiu durante a resposta.");
  }
}
