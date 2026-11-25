/**
 * Vocabulário do produto DECIFRA, compartilhado entre API e interface.
 * Mantém os mesmos rótulos do protótipo original para preservar a identidade.
 */

export const AREAS = {
  dados: { nome: "Análise de dados", tipico: "SQL, Excel ou Google Sheets, Power BI ou Tableau, leitura de indicadores" },
  dev: { nome: "Desenvolvimento", tipico: "HTML, CSS, JavaScript, Git, lógica de programação" },
  ux: { nome: "UX/UI", tipico: "Figma, prototipação, pesquisa com usuários, portfólio com processo" },
  grafico: { nome: "Design gráfico", tipico: "Illustrator, Photoshop, identidade visual, portfólio" },
  suporte: { nome: "Suporte", tipico: "Atendimento técnico, registro de chamados, redes básicas, comunicação" },
  produto: { nome: "Produto", tipico: "Pesquisa com usuários, indicadores, priorização, metodologias ágeis" },
} as const;
export type AreaId = keyof typeof AREAS;
export const AREA_IDS = Object.keys(AREAS) as AreaId[];

export const SITUACOES_ATUAIS = [
  ["trabalha", "Trabalho em outra área"],
  ["estuda", "Só estudo"],
  ["semtrabalho", "Estou sem trabalho"],
] as const;

export const TEMPOS_TRANSICAO = [
  ["0a6", "Menos de 6 meses"],
  ["6a12", "De 6 meses a 1 ano"],
  ["1mais", "Mais de 1 ano"],
] as const;

export const ATRAPALHA = [
  "Não sei por onde começar",
  "Não sei qual área escolher",
  "Vagas pedem experiência que não tenho",
  "Não sei mostrar o que sei",
  "Pouco retorno das empresas",
  "Nervosismo em entrevistas",
  "Currículo desatualizado",
] as const;

export const ETAPAS_TRANSICAO = ["Definindo o caminho", "Construindo a base", "Buscando a vaga"] as const;
export type EtapaTransicao = (typeof ETAPAS_TRANSICAO)[number];

export const TIPOS_EVIDENCIA = ["Projeto", "Curso", "Certificado", "Caso da carreira anterior"] as const;
export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number];

export const TIPOS_REQUISITO = {
  tecnica: "Habilidade técnica",
  formal: "Exigência formal",
  comportamental: "Comportamental",
} as const;
export type TipoRequisito = keyof typeof TIPOS_REQUISITO;

export const KINDS_FORMAL = ["tempo", "diploma", "certificacao"] as const;
export type KindFormal = (typeof KINDS_FORMAL)[number];

export const SITUACOES = {
  comprova: { rotulo: "Você comprova", icone: "✓", cor: "agua" },
  tem_precisa_mostrar: { rotulo: "Você tem, mas precisa mostrar", icone: "!", cor: "ambar" },
  nao_tem: { rotulo: "Ainda não tem", icone: "–", cor: "cinza" },
  formal: { rotulo: "Exigência formal", icone: "–", cor: "cinza" },
} as const;
export type Situacao = keyof typeof SITUACOES;

export const DECISOES = {
  candidate_agora: { rotulo: "Candidate-se agora", icone: "✓", cor: "agua" },
  prepare_evidencias: { rotulo: "Prepare evidências antes", icone: "!", cor: "ambar" },
  busque_compativel: { rotulo: "Busque uma vaga mais compatível", icone: "–", cor: "cinza" },
} as const;
export type Decisao = keyof typeof DECISOES;

export const STATUS_TAREFA = [
  ["a fazer", "A fazer"],
  ["fazendo", "Fazendo"],
  ["feito", "Feito"],
] as const;
export type StatusTarefa = (typeof STATUS_TAREFA)[number][0];

export const TIPOS_TAREFA = ["mini", "doc", "verificar"] as const;
export type TipoTarefa = (typeof TIPOS_TAREFA)[number];

export const ETAPAS_CANDIDATURA = ["Candidatei", "Sem retorno", "Entrevista", "Proposta", "Não avançou"] as const;
export type EtapaCandidatura = (typeof ETAPAS_CANDIDATURA)[number];

export const PERGUNTAS_ENTREVISTA = [
  "Por que você está mudando de área?",
  "Conte sobre um problema que você resolveu.",
  "Fale de uma vez em que trabalhou com pessoas de outras áreas.",
  "Conte sobre um erro seu e o que aprendeu.",
  "Como você aprende algo novo?",
] as const;

export const TRIAGENS = [
  ["", "Não avaliada"],
  ["avancar", "Convidar para conversa"],
  ["nao", "Não avança agora"],
] as const;
export type Triagem = (typeof TRIAGENS)[number][0];

export const ACEITA_FORMAL = [
  ["", "Ainda não decidimos"],
  ["sim", "Sim"],
  ["nao", "Não"],
] as const;

export const PAPEIS = ["candidato", "empresa"] as const;
export type Papel = (typeof PAPEIS)[number];

export const PLANOS = ["gratis", "plus"] as const;
export type Plano = (typeof PLANOS)[number];

/** Limite mensal de Raio-X no plano grátis (regra do protótipo). */
export const LIMITE_RAIO_GRATIS = 3;

/** Origem de um resultado: modelo de IA ou motor de regras determinístico. */
export const FONTES = ["ia", "regras", "empresa"] as const;
export type Fonte = (typeof FONTES)[number];
