import { criarApp } from "./app";
import { resumoConfig } from "./ai/config";
import { criarContexto } from "./contexto";

async function main() {
  const ctx = criarContexto();
  const app = await criarApp(ctx);

  const encerrar = async (sinal: string) => {
    app.log.info({ sinal }, "encerrando");
    await app.close();
    await ctx.db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void encerrar("SIGINT"));
  process.on("SIGTERM", () => void encerrar("SIGTERM"));

  // Remove sessões expiradas a cada hora (o login já ignora as vencidas; isto só evita acúmulo).
  const limpeza = setInterval(() => {
    ctx.db.session
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .then((r) => r.count && app.log.info({ removidas: r.count }, "sessões expiradas removidas"))
      .catch((e) => app.log.warn({ err: e }, "falha ao limpar sessões"));
  }, 60 * 60_000);
  limpeza.unref();
  app.addHook("onClose", async () => clearInterval(limpeza));

  await app.listen({ host: ctx.env.HOST, port: ctx.env.PORT });
  app.log.info(resumoConfig(ctx.ia.cfg), "DECIFRA API pronta");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
