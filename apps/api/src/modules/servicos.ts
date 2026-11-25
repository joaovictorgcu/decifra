import type { User } from "@prisma/client";
import { LIMITE_RAIO_GRATIS, type Sessao } from "@decifra/shared";
import type { Contexto } from "../app";
import type { Db } from "../lib/db";
import { evidenciaDom, perfilDto, usuarioDto, vagaDom } from "../lib/mapear";
import type { EvidenciaDom, VagaDom } from "../domain/tipos";

/** Consultas e regras compartilhadas entre módulos. */

export function inicioDoMes(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function inicioDoDia(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function contarUso(db: Db, userId: string, tipo: "raio_x" | "mentor", desde: Date): Promise<number> {
  return db.usageEvent.count({ where: { userId, tipo, createdAt: { gte: desde } } });
}

export function limiteMentor(ctx: Contexto, u: User): number {
  return u.plano === "plus" ? ctx.env.AI_MENTOR_LIMITE_PLUS : ctx.env.AI_MENTOR_LIMITE_GRATIS;
}

export async function montarSessao(ctx: Contexto, u: User): Promise<Sessao> {
  const perfil = u.papel === "candidato" ? await ctx.db.candidateProfile.findUnique({ where: { userId: u.id } }) : null;
  const [raioMes, mentorHoje] =
    u.papel === "candidato"
      ? await Promise.all([contarUso(ctx.db, u.id, "raio_x", inicioDoMes()), contarUso(ctx.db, u.id, "mentor", inicioDoDia())])
      : [0, 0];
  return {
    usuario: usuarioDto(u),
    perfil: perfil ? perfilDto(perfil) : null,
    uso: {
      raioMes,
      limiteRaio: u.plano === "plus" ? null : LIMITE_RAIO_GRATIS,
      mentorHoje,
      limiteMentor: limiteMentor(ctx, u),
    },
    ia: { ativa: ctx.ia.ativa, provedor: ctx.ia.nomeProvedor },
  };
}

export async function evidenciasDe(db: Db, userId: string): Promise<EvidenciaDom[]> {
  const evs = await db.evidence.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return evs.map(evidenciaDom);
}

export async function vagasDe(db: Db, userId: string): Promise<(VagaDom & { empresa: string; fonte: string; criadaEm: Date; companyJobId: string | null })[]> {
  const vagas = await db.job.findMany({ where: { userId }, include: { requisitos: true }, orderBy: { createdAt: "desc" } });
  return vagas.map((v) => ({ ...vagaDom(v), empresa: v.empresa, fonte: v.fonte, criadaEm: v.createdAt, companyJobId: v.companyJobId }));
}
