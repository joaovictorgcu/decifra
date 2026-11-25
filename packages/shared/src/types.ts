import type {
  Decisao,
  EtapaCandidatura,
  EtapaTransicao,
  Fonte,
  KindFormal,
  Papel,
  Plano,
  Situacao,
  StatusTarefa,
  TipoEvidencia,
  TipoRequisito,
  TipoTarefa,
  Triagem,
} from "./constants";

/** Contratos de resposta da API (JSON). */

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  plano: Plano;
  criadoEm: string;
}

export interface Perfil {
  destino: string;
  origem: string;
  situacao: string;
  tempo: string;
  candidatou: string;
  atrapalha: string[];
  etapa: EtapaTransicao;
  publico: boolean;
  slug: string;
}

export interface Sessao {
  usuario: Usuario;
  perfil: Perfil | null;
  uso: { raioMes: number; limiteRaio: number | null; mentorHoje: number; limiteMentor: number };
  ia: { ativa: boolean; provedor: string };
}

export interface Evidencia {
  id: string;
  titulo: string;
  tipo: TipoEvidencia;
  concluido: boolean;
  link: string;
  competencias: string[];
  problema: string;
  fez: string;
  ferramentas: string;
  resultado: string;
  completa: boolean;
  faltas: string[];
  criadaEm: string;
}

export interface Requisito {
  id: string;
  requisito: string;
  curto: string;
  tipo: TipoRequisito;
  kind: KindFormal | null;
  obrig: boolean;
  evId: string | null;
  aceita: "" | "sim" | "nao";
}

export interface RequisitoAvaliado extends Requisito {
  situacao: Situacao;
  evidencia: string;
  evidenciaId: string | null;
  nota: string;
}

export interface Acao {
  texto: string;
  tipo: TipoTarefa;
  comp: string;
  evId: string;
}

export interface RaioX {
  reqs: RequisitoAvaliado[];
  decisao: Decisao;
  justificativa: [string, string];
  acoes: Acao[];
}

export interface VagaResumo {
  id: string;
  titulo: string;
  empresa: string;
  decisao: Decisao;
  fonte: Fonte;
  vagaEmpresaId: string | null;
  criadaEm: string;
}

export interface VagaDetalhe extends VagaResumo {
  texto: string;
  raio: RaioX;
  noPlano: boolean;
  candidaturaId: string | null;
}

export interface Tarefa {
  id: string;
  vagaId: string | null;
  vagaTitulo: string | null;
  titulo: string;
  prazo: string;
  status: StatusTarefa;
  tipo: TipoTarefa;
  comp: string;
  evId: string | null;
}

export interface ItemRadar {
  curto: string;
  tipo: TipoRequisito;
  vagas: number;
  obrig: number;
  situacao: Situacao;
  nomes: string[];
  ganho: number;
}

export interface Candidatura {
  id: string;
  vagaId: string;
  vagaTitulo: string;
  etapa: EtapaCandidatura;
  atualizadaEm: string;
}

export interface Traducao {
  entrada: string;
  competencias: string[];
  curriculo: string;
  entrevista: string;
  falta: string;
}

export interface Historia {
  id: string;
  pergunta: string;
  evidencia: string;
  situacao: string;
  tarefa: string;
  acao: string;
  resultado: string;
  fonte: Fonte;
}

export interface Feedback {
  clareza: string;
  objetividade: string;
  sugestoes: string[];
  fonte: Fonte;
}

export interface VagaEmpresa {
  id: string;
  titulo: string;
  texto: string;
  selo: boolean;
  requisitos: Requisito[];
  empresa: string;
  criadaEm: string;
}

export interface Entrega {
  id: string;
  candidatoNome: string;
  candidatoSlug: string | null;
  link: string;
  triagem: Triagem;
  criadaEm: string;
}

export interface Desafio {
  id: string;
  empresa: string;
  titulo: string;
  vaga: string;
  competencia: string;
  descricao: string;
  prazo: string;
  entregas?: Entrega[];
  minhaEntrega?: { link: string; triagem: Triagem } | null;
}

export interface CompetenciaPerfil {
  competencia: string;
  comprovada: boolean;
  evidencias: Pick<Evidencia, "id" | "titulo" | "tipo" | "problema" | "fez" | "resultado" | "link">[];
}

export interface PerfilPublico {
  nome: string;
  area: string | null;
  competencias: CompetenciaPerfil[];
}

export interface CandidatoBusca {
  slug: string;
  nome: string;
  area: string | null;
  competencias: { nome: string; evidencias: number }[];
}

export interface Conversa {
  id: string;
  titulo: string;
  atualizadaEm: string;
}

export interface MensagemMentor {
  id: string;
  papel: "user" | "assistant";
  conteudo: string;
  criadaEm: string;
}

export interface Paginado<T> {
  itens: T[];
}

export interface ErroApi {
  erro: string;
  codigo: string;
  campo?: string;
}
