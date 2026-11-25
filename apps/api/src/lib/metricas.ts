import type { Db } from "./db";
import { completa, raio } from "../domain/raio";
import { evidenciaDom, vagaDom } from "./mapear";

/**
 * Métricas de validação das hipóteses do negócio (ver
 * docs/negocio/04-experimentacao-e-validacao.md). Tudo é calculado a partir
 * dos dados reais do produto; nenhuma métrica usa conteúdo de texto das pessoas.
 */
export interface MetricaHipotese {
  id: string;
  hipotese: string;
  metrica: string;
  valor: number | null; // proporção 0–1 ou contagem, conforme `formato`
  formato: "percentual" | "numero";
  meta: number;
  /** Tamanho da amostra usada no cálculo. */
  n: number;
  /** Amostra mínima para a leitura ser considerada. */
  nMinimo: number;
  status: "atingida" | "abaixo da meta" | "amostra insuficiente";
}

const prop = (a: number, b: number) => (b > 0 ? a / b : null);

function avaliar(m: Omit<MetricaHipotese, "status">): MetricaHipotese {
  const status = m.n < m.nMinimo || m.valor === null ? "amostra insuficiente" : m.valor >= m.meta ? "atingida" : "abaixo da meta";
  return { ...m, status };
}

export async function calcularMetricas(db: Db, dias = 30, agora = new Date()): Promise<{ periodo: { de: string; ate: string }; hipoteses: MetricaHipotese[]; volume: Record<string, number> }> {
  const desde = new Date(agora.getTime() - dias * 864e5);
  const candidatos = await db.user.findMany({
    where: { papel: "candidato", createdAt: { gte: desde } },
    select: {
      id: true,
      createdAt: true,
      plano: true,
      perfil: { select: { publico: true } },
      vagas: { select: { createdAt: true, fonte: true } },
      tarefas: { select: { status: true, tipo: true, virou: true, createdAt: true, updatedAt: true } },
      candidaturas: { select: { etapa: true } },
    },
  });
  const ativos = candidatos.filter((c) => c.vagas.length > 0);

  // H1: a decisão do Raio-X faz sentido para a pessoa.
  const fbRaio = await db.feedback.findMany({ where: { alvo: "raio", createdAt: { gte: desde } }, select: { util: true } });
  // H5: o Mentor ajuda; ações sugeridas são aceitas.
  const fbMentor = await db.feedback.findMany({ where: { alvo: "mentor", createdAt: { gte: desde } }, select: { util: true } });
  const msgs = await db.message.findMany({ where: { papel: "assistant", createdAt: { gte: desde }, acoes: { not: null } }, select: { acoes: true } });
  let sugeridas = 0;
  let aceitas = 0;
  for (const m of msgs) {
    try {
      const a = JSON.parse(m.acoes ?? "[]") as { executada?: boolean }[];
      sugeridas += a.length;
      aceitas += a.filter((x) => x.executada).length;
    } catch {
      /* ignora registro inválido */
    }
  }

  // H2: ativação em até 7 dias (diagnóstico + primeiro Raio-X).
  const ativados7 = candidatos.filter((c) => c.perfil && c.vagas.some((v) => v.createdAt.getTime() - c.createdAt.getTime() <= 7 * 864e5)).length;

  // H3: quem gera Raio-X executa o plano (conclui ao menos 1 tarefa).
  const comTarefa = ativos.filter((c) => c.tarefas.length > 0);
  const concluiram = comTarefa.filter((c) => c.tarefas.some((t) => t.status === "feito")).length;
  const minis = ativos.flatMap((c) => c.tarefas.filter((t) => t.tipo === "mini"));
  const minisViraram = minis.filter((t) => t.virou).length;

  // Evidências bem documentadas (qualidade da prova).
  const evs = await db.evidence.findMany({ where: { createdAt: { gte: desde }, user: { papel: "candidato" } } });
  const completas = evs.filter((e) => completa(evidenciaDom(e))).length;

  // H4: candidaturas de quem tem perfil público chegam mais à entrevista.
  const etapasAvanco = new Set(["Entrevista", "Proposta"]);
  const cand = (publico: boolean) => candidatos.filter((c) => !!c.perfil?.publico === publico).flatMap((c) => c.candidaturas);
  const comPerfil = cand(true);
  const semPerfil = cand(false);
  const taxaCom = prop(comPerfil.filter((x) => etapasAvanco.has(x.etapa)).length, comPerfil.length);
  const taxaSem = prop(semPerfil.filter((x) => etapasAvanco.has(x.etapa)).length, semPerfil.length);

  // H6: empresas abrem vagas para transição (selo) e recebem entregas em desafios.
  const vagasEmp = await db.companyJob.findMany({ where: { createdAt: { gte: desde } }, select: { selo: true } });
  const desafios = await db.challenge.findMany({ where: { createdAt: { gte: desde } }, select: { _count: { select: { entregas: true } } } });

  // H7: viabilidade da IA gratuita: chamadas atendidas por IA (sem cair nas regras).
  const ia = await db.aiInteraction.findMany({ where: { createdAt: { gte: desde }, tentativa: { gte: 1 } }, select: { status: true, provedor: true } });
  const iaOk = ia.filter((x) => x.status === "ok").length;
  const iaPagas = ia.filter((x) => x.status === "ok" && (x.provedor === "anthropic" || x.provedor === "openai")).length;

  // Decisões dos Raio-X gerados no período (distribuição, para leitura qualitativa).
  const jobs = await db.job.findMany({ where: { createdAt: { gte: desde } }, include: { requisitos: true, user: { include: { evidencias: true } } } });
  const decisoes: Record<string, number> = { candidate_agora: 0, prepare_evidencias: 0, busque_compativel: 0 };
  for (const j of jobs) decisoes[raio(vagaDom(j), j.user.evidencias.map(evidenciaDom)).decisao]!++;

  const hipoteses = [
    avaliar({ id: "H1", hipotese: "A decisão do Raio-X faz sentido para a pessoa", metrica: "Respostas \"fez sentido\" / total de respostas", valor: prop(fbRaio.filter((f) => f.util).length, fbRaio.length), formato: "percentual", meta: 0.7, n: fbRaio.length, nMinimo: 20 }),
    avaliar({ id: "H2", hipotese: "Quem se cadastra chega ao primeiro Raio-X", metrica: "Cadastrados com diagnóstico e 1º Raio-X em até 7 dias / cadastrados", valor: prop(ativados7, candidatos.length), formato: "percentual", meta: 0.6, n: candidatos.length, nMinimo: 20 }),
    avaliar({ id: "H3", hipotese: "Quem tem plano executa ações (produz prova)", metrica: "Pessoas com ao menos 1 tarefa concluída / pessoas com tarefas", valor: prop(concluiram, comTarefa.length), formato: "percentual", meta: 0.4, n: comTarefa.length, nMinimo: 15 }),
    avaliar({ id: "H3b", hipotese: "Mini-projetos viram evidência", metrica: "Mini-projetos concluídos (viraram evidência) / mini-projetos no plano", valor: prop(minisViraram, minis.length), formato: "percentual", meta: 0.3, n: minis.length, nMinimo: 15 }),
    avaliar({ id: "H4", hipotese: "Perfil de evidências aumenta entrevistas", metrica: "Diferença (pontos percentuais) na taxa de entrevista: com perfil público − sem", valor: taxaCom !== null && taxaSem !== null ? taxaCom - taxaSem : null, formato: "percentual", meta: 0.1, n: Math.min(comPerfil.length, semPerfil.length), nMinimo: 15 }),
    avaliar({ id: "H5", hipotese: "O Mentor ajuda", metrica: "Respostas avaliadas como úteis / respostas avaliadas", valor: prop(fbMentor.filter((f) => f.util).length, fbMentor.length), formato: "percentual", meta: 0.6, n: fbMentor.length, nMinimo: 20 }),
    avaliar({ id: "H5b", hipotese: "Sugestões do Mentor viram ação", metrica: "Ações sugeridas adicionadas ao Plano / ações sugeridas", valor: prop(aceitas, sugeridas), formato: "percentual", meta: 0.25, n: sugeridas, nMinimo: 20 }),
    avaliar({ id: "H6", hipotese: "Empresas abrem vagas para transição", metrica: "Vagas publicadas com selo \"Aberta a transição\" / vagas publicadas", valor: prop(vagasEmp.filter((v) => v.selo).length, vagasEmp.length), formato: "percentual", meta: 0.5, n: vagasEmp.length, nMinimo: 5 }),
    avaliar({ id: "H7", hipotese: "IA gratuita sustenta o produto", metrica: "Chamadas de IA atendidas com sucesso / tentativas", valor: prop(iaOk, ia.length), formato: "percentual", meta: 0.8, n: ia.length, nMinimo: 50 }),
  ];
  return {
    periodo: { de: desde.toISOString().slice(0, 10), ate: agora.toISOString().slice(0, 10) },
    hipoteses,
    volume: {
      candidatosCadastrados: candidatos.length,
      candidatosAtivos: ativos.length,
      raioX: jobs.length,
      ...Object.fromEntries(Object.entries(decisoes).map(([k, v]) => [`decisao_${k}`, v])),
      evidencias: evs.length,
      evidenciasBemDocumentadas: completas,
      candidaturas: comPerfil.length + semPerfil.length,
      plus: candidatos.filter((c) => c.plano === "plus").length,
      perfisPublicos: candidatos.filter((c) => c.perfil?.publico).length,
      desafios: desafios.length,
      entregasEmDesafios: desafios.reduce((s, d) => s + d._count.entregas, 0),
      chamadasIAComProvedorPago: iaPagas,
    },
  };
}
