import { feedbackSchema } from "@decifra/shared";
import type { FastifyInstance } from "fastify";
import { naoEncontrado, validar } from "../lib/erros";
import { exigirCandidato } from "../plugins/auth";

/**
 * Feedback de validação dentro do produto. Alimenta as hipóteses H1 (a decisão
 * do Raio-X é útil) e H5 (o Mentor ajuda). Uma resposta por item; pode ser trocada.
 */
export async function rotasFeedback(app: FastifyInstance) {
  const { db } = app.ctx;

  app.post("/feedback", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const u = exigirCandidato(req);
    const d = validar(feedbackSchema, req.body);
    // Só é possível avaliar a própria vaga ou uma resposta da própria conversa.
    const dono =
      d.alvo === "raio"
        ? await db.job.findFirst({ where: { id: d.refId, userId: u.id }, select: { id: true } })
        : await db.message.findFirst({ where: { id: d.refId, papel: "assistant", conversation: { userId: u.id } }, select: { id: true } });
    if (!dono) throw naoEncontrado(d.alvo === "raio" ? "Vaga" : "Mensagem");
    await db.feedback.upsert({
      where: { userId_alvo_refId: { userId: u.id, alvo: d.alvo, refId: d.refId } },
      create: { userId: u.id, alvo: d.alvo, refId: d.refId, util: d.util, comentario: d.comentario },
      update: { util: d.util, comentario: d.comentario },
    });
    return { ok: true, util: d.util };
  });
}
