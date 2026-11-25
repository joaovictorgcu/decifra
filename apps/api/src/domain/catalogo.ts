import type { KindFormal, TipoRequisito } from "@decifra/shared";

/**
 * Catálogo de competências reconhecidas pelo motor de regras.
 * `re` identifica a competência no texto da vaga (normalizado, sem acentos);
 * `rep` (opcional) é a expressão mais ampla usada para achar a competência
 * nas evidências do candidato.
 */
export interface ItemCatalogo {
  c: string;
  t: Exclude<TipoRequisito, "formal">;
  re: RegExp;
  rep?: RegExp;
}

export const CATALOGO: ItemCatalogo[] = [
  { c: "SQL", t: "tecnica", re: /\bsql\b/ },
  { c: "Power BI", t: "tecnica", re: /power\s?bi\b/ },
  { c: "Excel", t: "tecnica", re: /\bexcel\b/, rep: /\bexcel\b|planilha/ },
  { c: "Google Sheets", t: "tecnica", re: /google sheets/, rep: /google sheets|planilha/ },
  { c: "Python", t: "tecnica", re: /\bpython\b/ },
  { c: "JavaScript", t: "tecnica", re: /javascript|\bjs\b/ },
  { c: "TypeScript", t: "tecnica", re: /typescript/ },
  { c: "HTML", t: "tecnica", re: /\bhtml5?\b/ },
  { c: "CSS", t: "tecnica", re: /\bcss3?\b/ },
  { c: "React", t: "tecnica", re: /\breact\b/ },
  { c: "Node.js", t: "tecnica", re: /\bnode(\.?js)?\b/ },
  { c: "Java", t: "tecnica", re: /\bjava\b/ },
  { c: "Git", t: "tecnica", re: /\bgit(hub|lab)?\b/ },
  { c: "APIs", t: "tecnica", re: /\bapis?\b/ },
  { c: "testes de software", t: "tecnica", re: /testes? (de software|automatizad|unitari)|\bqa\b/ },
  { c: "Figma", t: "tecnica", re: /\bfigma\b/ },
  { c: "prototipação", t: "tecnica", re: /prototip|wireframe/ },
  { c: "pesquisa com usuários", t: "tecnica", re: /pesquisas? (com|de) usuario|ux research|testes? de usabilidade/ },
  { c: "UX Design", t: "tecnica", re: /\bux\b(?! research)|experiencia do usuario/ },
  { c: "UI Design", t: "tecnica", re: /\bui\b|design de interface/ },
  { c: "design system", t: "tecnica", re: /design system|sistema de design/ },
  { c: "Photoshop", t: "tecnica", re: /photoshop/ },
  { c: "Illustrator", t: "tecnica", re: /illustrator/ },
  { c: "Tableau", t: "tecnica", re: /tableau/ },
  { c: "Looker", t: "tecnica", re: /looker/ },
  { c: "ETL", t: "tecnica", re: /\betl\b/ },
  { c: "estatística", t: "tecnica", re: /estatistic/ },
  { c: "análise de indicadores", t: "tecnica", re: /indicador|\bkpis?\b|metricas/, rep: /indicador|\bkpis?\b|metricas|\bmetas?\b/ },
  { c: "metodologias ágeis", t: "tecnica", re: /metodologias? age|\bscrum\b|\bkanban\b/ },
  { c: "Jira", t: "tecnica", re: /\bjira\b/ },
  { c: "Trello", t: "tecnica", re: /\btrello\b/ },
  { c: "inglês", t: "tecnica", re: /\bingles\b/ },
  { c: "comunicação", t: "comportamental", re: /comunicacao|comunicativ/ },
  { c: "trabalho em equipe", t: "comportamental", re: /trabalh\w+ em equipe|colaborativ/, rep: /equipe|colaborativ/ },
  { c: "proatividade", t: "comportamental", re: /proativ/ },
  { c: "organização", t: "comportamental", re: /organizad[ao]\b|senso de organizacao|organizacao e /, rep: /organiz/ },
  { c: "resolução de problemas", t: "comportamental", re: /resolu\w+ de problemas|resolver problemas/, rep: /problemas/ },
  { c: "pensamento analítico", t: "comportamental", re: /pensamento analitico|perfil analitico/, rep: /analitic|analis/ },
  { c: "atenção aos detalhes", t: "comportamental", re: /atencao aos detalhes/, rep: /detalhe/ },
  { c: "autonomia", t: "comportamental", re: /\bautonomia\b|autonom[ao]\b/ },
  { c: "adaptabilidade", t: "comportamental", re: /adaptab|flexibilidade/ },
  { c: "liderança", t: "comportamental", re: /lideranca/, rep: /lider|coorden/ },
];

export const FORMAL: { tipo: KindFormal; re: RegExp }[] = [
  {
    tipo: "tempo",
    re: /\d+\s*\+?\s*(ano|anos|mes|meses)( ou mais)? de (experiencia|atuacao)|experiencia minima|minimo de \d+\s*(ano|anos|mes|meses)/,
  },
  {
    tipo: "diploma",
    re: /graduacao|ensino superior|bacharel|diploma|tecnologo|ensino medio completo|formacao (superior|em)/,
  },
  { tipo: "certificacao", re: /certificac\w+ (obrigatori|exigid)|certificad[oa] (obrigatori|exigid)/ },
];

/** Traduções de tarefas da carreira anterior em competências da nova área. */
export const TROCAS: { re: RegExp; para: string }[] = [
  { re: /\bmetas?\b|indicador|\bkpi/, para: "análise de indicadores e KPIs" },
  { re: /relatorio/, para: "comunicação de dados para quem decide" },
  { re: /planilha/, para: "organização e análise de dados" },
  { re: /atendimento|atendia|cliente|paciente/, para: "escuta de necessidades e pesquisa com usuários" },
  { re: /coorden|lider|gerenci|equipe/, para: "coordenação de pessoas e entregas" },
  { re: /process|fluxo|rotina/, para: "mapeamento e melhoria de processos" },
  { re: /professor|ensin|trein|aula/, para: "explicação clara e documentação" },
  { re: /prazo|projeto|cronograma/, para: "organização de entregas" },
];

/** Mini-projetos sugeridos por competência para produzir evidência em até 1 semana. */
export const MINIS: Record<string, string> = {
  "análise de indicadores": "Monte um dashboard de indicadores com dados públicos do IBGE",
  "Power BI": "Monte um dashboard em Power BI com dados públicos do IBGE ou do Portal da Transparência",
  SQL: "Responda 10 perguntas de negócio com SQL em uma base pública e publique as consultas",
  Python: "Limpe e analise uma base pública com Python e publique o notebook no GitHub",
  Excel: "Monte uma planilha de acompanhamento com tabela dinâmica usando dados públicos",
  Figma: "Redesenhe no Figma uma tela de um serviço público e registre as decisões de design",
  prototipação: "Prototipe o fluxo de agendamento de um serviço local e teste com 3 pessoas",
  "pesquisa com usuários": "Entreviste 5 pessoas sobre um problema real e sintetize os achados em uma página",
  JavaScript: "Construa uma página interativa pequena em JavaScript e publique no GitHub Pages",
  HTML: "Publique uma página acessível em HTML sobre um serviço do seu bairro",
  CSS: "Publique uma página responsiva em CSS e registre como você testou no celular",
  Git: "Versione um projeto seu no GitHub com commits descritivos e um README",
};
