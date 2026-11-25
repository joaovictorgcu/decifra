import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import path from "node:path";
import { ErroIA } from "./ai/tipos";
import type { ServicoIA } from "./ai/servico";
import type { Env } from "./config/env";
import type { Db } from "./lib/db";
import { ErroApp } from "./lib/erros";
import { respostaErroIA } from "./lib/mensagens-ia";
import auth from "./plugins/auth";
import { rotasAuth } from "./modules/auth";
import { rotasPerfil } from "./modules/perfil";
import { rotasEvidencias } from "./modules/evidencias";
import { rotasVagas } from "./modules/vagas";
import { rotasPlano } from "./modules/plano";
import { rotasCandidaturas } from "./modules/candidaturas";
import { rotasTradutor } from "./modules/tradutor";
import { rotasEntrevista } from "./modules/entrevista";
import { rotasMentor } from "./modules/mentor";
import { rotasEmpresa } from "./modules/empresa";
import { rotasDesafios } from "./modules/desafios";
import { rotasPublico } from "./modules/publico";
import { rotasArquivos } from "./modules/arquivos";

export interface Contexto {
  env: Env;
  db: Db;
  ia: ServicoIA;
}

declare module "fastify" {
  interface FastifyInstance {
    ctx: Contexto;
  }
}

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function criarApp(ctx: Contexto): Promise<FastifyInstance> {
  const { env } = ctx;
  const app = Fastify({
    // Número de proxies confiáveis à frente da API (0 = nenhum). Nunca confiar na cadeia inteira de X-Forwarded-For.
    trustProxy: env.TRUST_PROXY > 0 ? (_endereco: string, salto: number) => salto < env.TRUST_PROXY : false,
    bodyLimit: 1024 * 1024,
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
            level: env.LOG_LEVEL,
            // Nunca registrar credenciais, cookies ou conteúdo de senha.
            redact: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]', "body.senha", "body.novaSenha", "body.senhaAtual"],
            transport: env.isProd ? undefined : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
          },
  });
  app.decorate("ctx", ctx);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: env.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    allowList: env.RATE_LIMIT === "off" ? () => true : undefined,
    errorResponseBuilder: () => ({ statusCode: 429, erro: "Muitas requisições. Aguarde um instante e tente de novo.", codigo: "limite" }),
  });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 } });
  await app.register(auth);

  /*
   * Proteção contra CSRF: requisições que alteram dados precisam do cabeçalho
   * x-decifra (que força preflight CORS, nunca liberado para outras origens) e,
   * quando o navegador envia Origin, ela precisa ser a do próprio app.
   * Vale para qualquer caminho: o roteador decodifica a URL (ex.: /%61pi/...),
   * então filtrar por prefixo de req.url permitiria contornar a checagem.
   */
  const origens = new Set([new URL(env.APP_ORIGIN).origin]);
  app.addHook("onRequest", async (req) => {
    if (METODOS_SEGUROS.has(req.method)) return;
    const origem = req.headers.origin;
    if (origem && !origens.has(origem)) throw new ErroApp(403, "origem", "Origem da requisição não permitida.");
    if (req.headers["x-decifra"] !== "1") throw new ErroApp(403, "csrf", "Requisição sem o cabeçalho de segurança do app.");
  });

  app.setErrorHandler((erro, req, reply) => {
    if (erro instanceof ErroApp) {
      return reply.status(erro.status).send({ erro: erro.message, codigo: erro.codigo, campo: erro.campo });
    }
    if (erro instanceof ErroIA) {
      req.log.warn({ motivo: erro.motivo }, "falha na IA");
      const r = respostaErroIA(erro);
      return reply.status(r.status).send({ erro: r.erro, codigo: r.codigo });
    }
    const e = erro as { statusCode?: number; code?: string; message?: string };
    if (e.statusCode === 429) return reply.status(429).send({ erro: "Muitas requisições. Aguarde um instante e tente de novo.", codigo: "limite" });
    if (e.code === "FST_REQ_FILE_TOO_LARGE") return reply.status(413).send({ erro: "Arquivo maior que 5 MB.", codigo: "arquivo_grande" });
    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
      return reply.status(e.statusCode).send({ erro: "Requisição inválida.", codigo: e.code ?? "requisicao" });
    }
    req.log.error({ err: erro }, "erro inesperado");
    return reply.status(500).send({ erro: "Algo deu errado do nosso lado. Tente de novo.", codigo: "interno" });
  });

  app.get("/api/saude", async () => {
    await ctx.db.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  await app.register(
    async (api) => {
      await api.register(rotasAuth);
      await api.register(rotasPerfil);
      await api.register(rotasEvidencias);
      await api.register(rotasVagas);
      await api.register(rotasPlano);
      await api.register(rotasCandidaturas);
      await api.register(rotasTradutor);
      await api.register(rotasEntrevista);
      await api.register(rotasMentor);
      await api.register(rotasEmpresa);
      await api.register(rotasDesafios);
      await api.register(rotasPublico);
      await api.register(rotasArquivos);
    },
    { prefix: "/api" },
  );

  // Em produção, a própria API serve o build do frontend (SPA).
  const webDist = env.WEB_DIST ? path.resolve(env.WEB_DIST) : null;
  const servirWeb = !!webDist && existsSync(path.join(webDist, "index.html"));
  if (servirWeb && webDist) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false, index: ["index.html"] });
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) return reply.status(404).send({ erro: "Rota não encontrada.", codigo: "rota" });
    if (servirWeb && (req.method === "GET" || req.method === "HEAD")) return reply.type("text/html").sendFile("index.html");
    return reply.status(404).send({ erro: "Não encontrado.", codigo: "rota" });
  });

  return app;
}
