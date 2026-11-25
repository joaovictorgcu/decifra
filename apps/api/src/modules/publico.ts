import { AREAS, type AreaId, type CompetenciaPerfil, type PerfilPublico } from "@decifra/shared";
import type { FastifyInstance } from "fastify";
import { grau } from "../domain/raio";
import { naoEncontrado } from "../lib/erros";
import { evidenciaDom } from "../lib/mapear";
import type { EvidenciaDom } from "../domain/tipos";

/** Monta a página de competências com as evidências de cada uma. */
export function montarPerfilPublico(nome: string, destino: string | null, evs: EvidenciaDom[]): PerfilPublico {
  const m = new Map<string, EvidenciaDom[]>();
  for (const e of evs) for (const k of e.competencias) m.set(k, [...(m.get(k) ?? []), e]);
  const competencias: CompetenciaPerfil[] = [...m.entries()].map(([competencia, lista]) => ({
    competencia,
    comprovada: lista.some((e) => grau(e) >= 3),
    evidencias: lista.map((e) => ({ id: e.id, titulo: e.titulo, tipo: e.tipo as CompetenciaPerfil["evidencias"][number]["tipo"], problema: e.problema, fez: e.fez, resultado: e.resultado, link: e.link })),
  }));
  competencias.sort((a, b) => Number(b.comprovada) - Number(a.comprovada) || b.evidencias.length - a.evidencias.length);
  return { nome, area: destino ? (AREAS[destino as AreaId]?.nome ?? null) : null, competencias };
}

/** Perfil de Evidências público: acessível sem login, só quando a pessoa escolheu publicar. */
export async function rotasPublico(app: FastifyInstance) {
  const { db } = app.ctx;

  app.get<{ Params: { slug: string } }>("/publico/perfis/:slug", async (req) => {
    const p = await db.candidateProfile.findUnique({ where: { slug: String(req.params.slug).slice(0, 80) }, include: { user: { include: { evidencias: { orderBy: { createdAt: "asc" } } } } } });
    const dono = req.usuario?.id === p?.userId;
    // Perfil privado só é visível para o próprio dono (pré-visualização).
    if (!p || (!p.publico && !dono)) throw naoEncontrado("Perfil");
    return { ...montarPerfilPublico(p.user.nome, p.destino, p.user.evidencias.map(evidenciaDom)), publico: p.publico };
  });
}
