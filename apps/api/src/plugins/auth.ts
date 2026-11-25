import type { User } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ErroApp } from "../lib/erros";
import { hashToken, novoToken } from "../lib/tokens";

export const COOKIE_SESSAO = "decifra_sessao";

declare module "fastify" {
  interface FastifyRequest {
    usuario: User | null;
    sessaoId: string | null;
  }
}

/**
 * Sessões opacas guardadas no banco (revogáveis), com token aleatório em
 * cookie httpOnly. O banco guarda só o hash SHA-256 do token.
 */
export default fp(async (app: FastifyInstance) => {
  app.decorateRequest("usuario", null);
  app.decorateRequest("sessaoId", null);

  app.addHook("onRequest", async (req) => {
    const token = req.cookies[COOKIE_SESSAO];
    if (!token) return;
    const sessao = await app.ctx.db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!sessao) return;
    if (sessao.expiresAt.getTime() < Date.now()) {
      await app.ctx.db.session.delete({ where: { id: sessao.id } }).catch(() => undefined);
      return;
    }
    req.usuario = sessao.user;
    req.sessaoId = sessao.id;
  });
});

export async function iniciarSessao(app: FastifyInstance, reply: FastifyReply, req: FastifyRequest, userId: string) {
  const token = novoToken();
  const dias = app.ctx.env.SESSION_TTL_DAYS;
  await app.ctx.db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + dias * 864e5),
      userAgent: String(req.headers["user-agent"] ?? "").slice(0, 200),
    },
  });
  reply.setCookie(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: app.ctx.env.cookieSecure,
    path: "/",
    maxAge: dias * 86400,
  });
}

export async function encerrarSessao(app: FastifyInstance, reply: FastifyReply, req: FastifyRequest) {
  if (req.sessaoId) await app.ctx.db.session.delete({ where: { id: req.sessaoId } }).catch(() => undefined);
  reply.clearCookie(COOKIE_SESSAO, { path: "/" });
}

/* ---------- Guardas de acesso ---------- */

export function exigirLogin(req: FastifyRequest): User {
  if (!req.usuario) throw new ErroApp(401, "nao_autenticado", "Entre na sua conta para continuar.");
  return req.usuario;
}

export function exigirCandidato(req: FastifyRequest): User {
  const u = exigirLogin(req);
  if (u.papel !== "candidato") throw new ErroApp(403, "papel", "Esta área é exclusiva para candidatos.");
  return u;
}

export function exigirEmpresa(req: FastifyRequest): User {
  const u = exigirLogin(req);
  if (u.papel !== "empresa") throw new ErroApp(403, "papel", "Esta área é exclusiva para empresas.");
  return u;
}

export function exigirPlus(u: User, recurso: string): void {
  if (u.plano !== "plus") throw new ErroApp(402, "plano", `${recurso} faz parte do Candidato Plus.`);
}
