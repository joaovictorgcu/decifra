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

/** O que a interface precisa saber sobre a IA (sem detalhes técnicos nem chaves). */
export interface StatusIA {
  ativa: boolean;
  /** Nomes amigáveis dos provedores ativos, ex.: ["Groq", "Google Gemini"]. */
  provedores: string[];
  /** Há provedor permitido (inclusive pela política de privacidade) para o Mentor e para a importação de currículo? */
  mentor: boolean;
  importacao: boolean;
}

export interface Sessao {
  usuario: Usuario;
  perfil: Perfil | null;
  uso: { raioMes: number; limiteRaio: number | null; mentorHoje: number; limiteMentor: number };
  ia: StatusIA;
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
  /** Provedor e modelo de IA, quando fonte = "ia" (ex.: "Groq · gpt-oss-120b"). */
  ia: string | null;
  vagaEmpresaId: string | null;
  criadaEm: string;
}

export interface VagaDetalhe extends VagaResumo {
  texto: string;
  raio: RaioX;
  noPlano: boolean;
  candidaturaId: string | null;
  /** A pessoa corrigiu requisitos manualmente. */
  ajustada: boolean;
  /** Resposta da pessoa a "a decisão fez sentido?" (null = ainda não respondeu). */
  feedback: boolean | null;
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
  ia: string | null;
}

export interface Feedback {
  clareza: string;
  objetividade: string;
  sugestoes: string[];
  fonte: Fonte;
  ia: string | null;
}

export interface ResultadoTraducao {
  itens: Traducao[];
  fonte: Fonte;
  ia: string | null;
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
  /** Quem gerou a resposta (ex.: "Groq · gpt-oss-120b"). */
  ia: string | null;
  /** A pessoa interrompeu a geração: o texto está incompleto. */
  interrompida: boolean;
  /** Ações sugeridas pelo Mentor; só são executadas quando a pessoa confirma. */
  acoes: AcaoMentor[];
  /** Resposta da pessoa a "esta resposta ajudou?" (null = ainda não respondeu). */
  feedback: boolean | null;
  criadaEm: string;
}

export type AcaoMentor =
  | { tipo: "tarefa"; titulo: string; prazoDias: number; executada: boolean }
  | { tipo: "mini"; competencia: string; executada: boolean };

export interface Paginado<T> {
  itens: T[];
}

export interface ErroApi {
  erro: string;
  codigo: string;
  campo?: string;
}
