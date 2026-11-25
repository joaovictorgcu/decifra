import type { z } from "zod";
import { primeiroErro } from "@decifra/shared";

/** Erro de negócio com status HTTP e código estável para o frontend. */
export class ErroApp extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly campo?: string,
  ) {
    super(mensagem);
    this.name = "ErroApp";
  }
}

export const naoEncontrado = (o = "Registro") => new ErroApp(404, "nao_encontrado", `${o} não encontrado.`);
export const proibido = (m = "Você não tem acesso a este recurso.") => new ErroApp(403, "proibido", m);
export const conflito = (m: string) => new ErroApp(409, "conflito", m);

/** Valida uma entrada com Zod e converte a falha em ErroApp 400 com mensagem amigável. */
export function validar<S extends z.ZodType>(schema: S, dados: unknown): z.infer<S> {
  const r = schema.safeParse(dados ?? {});
  if (!r.success) {
    const campo = r.error.issues[0]?.path.join(".") || undefined;
    throw new ErroApp(400, "validacao", primeiroErro(r.error), campo);
  }
  return r.data;
}
