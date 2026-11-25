import { criarApp } from "./app";
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

  await app.listen({ host: ctx.env.HOST, port: ctx.env.PORT });
  app.log.info({ ia: ctx.ia.nomeProvedor, modelo: ctx.ia.ativa ? ctx.ia.modeloDe("mentor") : null }, "DECIFRA API pronta");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
