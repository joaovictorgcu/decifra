import { cadastroSchema, contaSchema, excluirContaSchema, loginSchema, trocaSenhaSchema } from "@decifra/shared";
import type { FastifyInstance } from "fastify";
import { ErroApp, validar } from "../lib/erros";
import { evidenciaDto, perfilDto, usuarioDto } from "../lib/mapear";
import { HASH_FICTICIO, conferirSenha, gerarHash } from "../lib/senha";
import { LimiteTentativas } from "../lib/tentativas";
import { encerrarSessao, exigirLogin, iniciarSessao } from "../plugins/auth";
import { montarSessao } from "./servicos";

/** Cadastro, login, sessão e gestão da própria conta (inclui exportação e exclusão, LGPD). */
export async function rotasAuth(app: FastifyInstance) {
  const { db } = app.ctx;
  const limiteAuth = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };
  const tentativas = new LimiteTentativas();

  app.post("/auth/cadastro", limiteAuth, async (req, reply) => {
    const d = validar(cadastroSchema, req.body);
    const existe = await db.user.findUnique({ where: { email: d.email } });
    if (existe) throw new ErroApp(409, "email_em_uso", "Já existe uma conta com este e-mail. Entre com sua senha.", "email");
    const u = await db.user.create({ data: { email: d.email, nome: d.nome, papel: d.papel, passwordHash: await gerarHash(d.senha) } });
    await iniciarSessao(app, reply, req, u.id);
    req.log.info({ userId: u.id, papel: u.papel }, "conta criada");
    return reply.status(201).send(await montarSessao(app.ctx, u));
  });

  app.post("/auth/login", limiteAuth, async (req, reply) => {
    const d = validar(loginSchema, req.body);
    const espera = tentativas.bloqueio(d.email);
    if (espera) {
      const min = Math.ceil(espera / 60_000);
      throw new ErroApp(429, "tentativas", `Muitas tentativas para este e-mail. Tente de novo em ${min} minuto${min > 1 ? "s" : ""}.`);
    }
    const u = await db.user.findUnique({ where: { email: d.email } });
    // Confere um hash mesmo quando o e-mail não existe, para não revelar contas pelo tempo de resposta.
    const ok = await conferirSenha(d.senha, u?.passwordHash ?? HASH_FICTICIO);
    if (!u || !ok) {
      tentativas.falha(d.email);
      throw new ErroApp(401, "credenciais", "E-mail ou senha incorretos.");
    }
    tentativas.sucesso(d.email);
    await iniciarSessao(app, reply, req, u.id);
    return montarSessao(app.ctx, u);
  });

  app.post("/auth/logout", async (req, reply) => {
    await encerrarSessao(app, reply, req);
    return { ok: true };
  });

  app.get("/auth/sessao", async (req) => {
    const u = exigirLogin(req);
    return montarSessao(app.ctx, u);
  });

  app.patch("/conta", async (req) => {
    const u = exigirLogin(req);
    const d = validar(contaSchema, req.body);
    const novo = await db.user.update({ where: { id: u.id }, data: { nome: d.nome } });
    return montarSessao(app.ctx, novo);
  });

  app.post("/conta/senha", limiteAuth, async (req, reply) => {
    const u = exigirLogin(req);
    const d = validar(trocaSenhaSchema, req.body);
    if (!(await conferirSenha(d.senhaAtual, u.passwordHash))) throw new ErroApp(400, "senha", "A senha atual está incorreta.", "senhaAtual");
    await db.user.update({ where: { id: u.id }, data: { passwordHash: await gerarHash(d.novaSenha) } });
    // Encerra todas as sessões (inclusive a atual) e emite um token novo para este dispositivo.
    await db.session.deleteMany({ where: { userId: u.id } });
    await iniciarSessao(app, reply, req, u.id);
    return { ok: true };
  });

  app.get("/conta/exportar", async (req, reply) => {
    const u = exigirLogin(req);
    const [perfil, evidencias, vagas, tarefas, candidaturas, historias, conversas, vagasEmpresa, desafios, usoIA] = await Promise.all([
      db.candidateProfile.findUnique({ where: { userId: u.id } }),
      db.evidence.findMany({ where: { userId: u.id } }),
      db.job.findMany({ where: { userId: u.id }, include: { requisitos: true } }),
      db.task.findMany({ where: { userId: u.id } }),
      db.application.findMany({ where: { userId: u.id } }),
      db.interviewStory.findMany({ where: { userId: u.id } }),
      db.conversation.findMany({ where: { userId: u.id }, include: { mensagens: true } }),
      db.companyJob.findMany({ where: { companyId: u.id }, include: { requisitos: true } }),
      db.challenge.findMany({ where: { companyId: u.id }, include: { entregas: true } }),
      // Só metadados: a DECIFRA não guarda o conteúdo enviado à IA.
      db.aiInteraction.findMany({
        where: { userId: u.id },
        select: { tarefa: true, nivel: true, provedor: true, modelo: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    ]);
    const dados = {
      exportadoEm: new Date().toISOString(),
      conta: usuarioDto(u),
      perfil: perfil ? perfilDto(perfil) : null,
      evidencias: evidencias.map(evidenciaDto),
      vagas,
      tarefas,
      candidaturas,
      historias,
      conversas,
      vagasEmpresa,
      desafios,
      usoIA,
    };
    reply.header("content-disposition", 'attachment; filename="decifra-meus-dados.json"');
    return dados;
  });

  app.delete("/conta", limiteAuth, async (req, reply) => {
    const u = exigirLogin(req);
    const d = validar(excluirContaSchema, req.body);
    if (!(await conferirSenha(d.senha, u.passwordHash))) throw new ErroApp(400, "senha", "Senha incorreta.", "senha");
    await db.user.delete({ where: { id: u.id } });
    reply.clearCookie("decifra_sessao", { path: "/" });
    req.log.info({ userId: u.id }, "conta excluída");
    return { ok: true };
  });
}
