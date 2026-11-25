import type {
  Evidence,
  Job,
  JobRequirement,
  CompanyJob,
  CompanyJobRequirement,
  Task,
  User,
  CandidateProfile,
} from "../../generated/prisma/client";
import type {
  Evidencia,
  EtapaTransicao,
  KindFormal,
  Perfil,
  Requisito,
  StatusTarefa,
  Tarefa,
  TipoEvidencia,
  TipoRequisito,
  TipoTarefa,
  Usuario,
  VagaEmpresa,
  Papel,
  Plano,
} from "@decifra/shared";
import { completa, faltas } from "../domain/raio";
import type { EvidenciaDom, RequisitoDom, VagaDom } from "../domain/tipos";
import { lerLista } from "./json";

/** Conversões entre linhas do banco, entidades de domínio e contratos da API. */

export function usuarioDto(u: User): Usuario {
  return { id: u.id, nome: u.nome, email: u.email, papel: u.papel as Papel, plano: u.plano as Plano, criadoEm: u.createdAt.toISOString() };
}

export function perfilDto(p: CandidateProfile): Perfil {
  return {
    destino: p.destino,
    origem: p.origem,
    situacao: p.situacao,
    tempo: p.tempo,
    candidatou: p.candidatou,
    atrapalha: lerLista(p.atrapalha),
    etapa: p.etapa as EtapaTransicao,
    publico: p.publico,
    slug: p.slug,
  };
}

export function evidenciaDom(e: Evidence): EvidenciaDom {
  return {
    id: e.id,
    titulo: e.titulo,
    tipo: e.tipo,
    concluido: e.concluido,
    link: e.link,
    competencias: lerLista(e.competencias),
    problema: e.problema,
    fez: e.fez,
    ferramentas: e.ferramentas,
    resultado: e.resultado,
  };
}

export function evidenciaDto(e: Evidence): Evidencia {
  const d = evidenciaDom(e);
  return { ...d, tipo: d.tipo as TipoEvidencia, completa: completa(d), faltas: faltas(d), criadaEm: e.createdAt.toISOString() };
}

export function requisitoDom(r: JobRequirement | CompanyJobRequirement): RequisitoDom {
  return {
    id: r.id,
    requisito: r.requisito,
    curto: r.curto,
    tipo: r.tipo as TipoRequisito,
    kind: (r.kind as KindFormal | null) ?? null,
    obrig: r.obrig,
    evId: "evId" in r ? r.evId : null,
    aceita: (r.aceita as RequisitoDom["aceita"]) || "",
  };
}

export function requisitoDto(r: JobRequirement | CompanyJobRequirement): Requisito {
  return requisitoDom(r);
}

export function vagaDom(j: Job & { requisitos: JobRequirement[] }): VagaDom {
  return { id: j.id, titulo: j.titulo, reqs: [...j.requisitos].sort((a, b) => a.ordem - b.ordem).map(requisitoDom) };
}

export function tarefaDto(t: Task & { job?: Pick<Job, "titulo"> | null }): Tarefa {
  return {
    id: t.id,
    vagaId: t.jobId,
    vagaTitulo: t.job?.titulo ?? null,
    titulo: t.titulo,
    prazo: t.prazo,
    status: t.status as StatusTarefa,
    tipo: t.tipo as TipoTarefa,
    comp: t.comp,
    evId: t.evId,
  };
}

export function vagaEmpresaDto(v: CompanyJob & { requisitos: CompanyJobRequirement[]; company: Pick<User, "nome"> }): VagaEmpresa {
  return {
    id: v.id,
    titulo: v.titulo,
    texto: v.texto,
    selo: v.selo,
    requisitos: [...v.requisitos].sort((a, b) => a.ordem - b.ordem).map(requisitoDto),
    empresa: v.company.nome,
    criadaEm: v.createdAt.toISOString(),
  };
}
