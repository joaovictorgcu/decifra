import { z } from "zod";
import {
  AREA_IDS,
  ATRAPALHA,
  ETAPAS_CANDIDATURA,
  KINDS_FORMAL,
  PAPEIS,
  PERGUNTAS_ENTREVISTA,
  SITUACOES_ATUAIS,
  STATUS_TAREFA,
  TEMPOS_TRANSICAO,
  TIPOS_EVIDENCIA,
} from "./constants";

/** Schemas de entrada da API. A mesma validação roda no formulário e no servidor. */

const texto = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
const obrigatorio = (max: number, msg: string) => texto(max).min(1, msg);
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data válida.");
const linkHttp = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), "Cole um link completo, começando com https://");

export const emailSchema = z.string().trim().toLowerCase().email("Digite um e-mail válido, como nome@exemplo.com").max(200);
export const senhaSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(128, "A senha pode ter no máximo 128 caracteres.");

export const cadastroSchema = z.object({
  nome: obrigatorio(80, "Informe seu nome ou o nome da empresa."),
  email: emailSchema,
  senha: senhaSchema,
  papel: z.enum(PAPEIS),
});
export type CadastroInput = z.infer<typeof cadastroSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, "Informe sua senha.").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const contaSchema = z.object({ nome: obrigatorio(80, "Informe seu nome.") });
export const trocaSenhaSchema = z.object({ senhaAtual: z.string().min(1, "Informe a senha atual."), novaSenha: senhaSchema });
export const excluirContaSchema = z.object({ senha: z.string().min(1, "Confirme com sua senha.") });

export const diagnosticoSchema = z.object({
  destino: z.enum(AREA_IDS as [string, ...string[]], { message: "Escolha a área de destino." }),
  origem: obrigatorio(120, "Conte de qual área você vem."),
  situacao: z.enum(SITUACOES_ATUAIS.map((s) => s[0]) as [string, ...string[]], { message: "Escolha sua situação atual." }),
  tempo: z.enum(TEMPOS_TRANSICAO.map((s) => s[0]) as [string, ...string[]], { message: "Diga há quanto tempo está em transição." }),
  candidatou: z.enum(["sim", "nao"], { message: "Diga se já se candidatou." }),
  atrapalha: z
    .array(z.enum(ATRAPALHA))
    .min(1, "Escolha pelo menos uma opção na pergunta 6.")
    .max(3, "Escolha até 3 opções na pergunta 6."),
});
export type DiagnosticoInput = z.infer<typeof diagnosticoSchema>;

export const perfilPublicoSchema = z.object({ publico: z.boolean() });

export const evidenciaSchema = z.object({
  titulo: obrigatorio(140, "Dê um título para a evidência."),
  tipo: z.enum(TIPOS_EVIDENCIA),
  concluido: z.boolean().default(false),
  link: linkHttp.default(""),
  competencias: z.array(texto(60).min(1)).max(15, "Use até 15 competências.").default([]),
  problema: texto(2000).default(""),
  fez: texto(2000).default(""),
  ferramentas: texto(300).default(""),
  resultado: texto(2000).default(""),
});
export type EvidenciaInput = z.infer<typeof evidenciaSchema>;

export const vagaCandidatoSchema = z.object({
  titulo: texto(140).default(""),
  texto: z
    .string()
    .trim()
    .min(80, "Cole a descrição completa da vaga, com os requisitos.")
    .max(20000, "A descrição está muito longa. Cole só a parte com os requisitos."),
});
export type VagaCandidatoInput = z.infer<typeof vagaCandidatoSchema>;

export const tarefaUpdateSchema = z
  .object({
    status: z.enum(STATUS_TAREFA.map((s) => s[0]) as [string, ...string[]]).optional(),
    prazo: dataISO.optional(),
  })
  .refine((v) => v.status !== undefined || v.prazo !== undefined, "Nada para atualizar.");

export const miniProjetoSchema = z.object({ competencia: obrigatorio(60, "Informe a competência.") });

export const candidaturaSchema = z.object({ vagaId: z.string().min(1) });
export const candidaturaUpdateSchema = z.object({ etapa: z.enum(ETAPAS_CANDIDATURA) });

export const traducaoSchema = z.object({
  entrada: z.string().trim().min(10, "Descreva pelo menos uma função ou tarefa.").max(4000, "Use no máximo 4000 caracteres."),
});

export const traducaoParaEvidenciaSchema = z.object({
  entrada: obrigatorio(300, "Informe a experiência."),
  competencias: z.array(texto(80).min(1)).min(1).max(10),
});

export const historiaSchema = z.object({
  pergunta: z.enum(PERGUNTAS_ENTREVISTA),
  evidenciaId: z.string().min(1, "Escolha uma evidência."),
});

export const treinoSchema = z.object({
  pergunta: z.enum(PERGUNTAS_ENTREVISTA),
  resposta: z.string().trim().min(20, "Escreva sua resposta para receber feedback.").max(3000, "Use no máximo 3000 caracteres."),
});

export const requisitoSchema = z.object({
  requisito: obrigatorio(300, "Requisito vazio."),
  curto: obrigatorio(80, "Requisito sem nome curto."),
  tipo: z.enum(["tecnica", "formal", "comportamental"]),
  kind: z.enum(KINDS_FORMAL).nullable().optional(),
  obrig: z.boolean(),
});

export const vagaEmpresaAnaliseSchema = z.object({
  titulo: obrigatorio(140, "Informe o nome da vaga."),
  texto: z.string().trim().min(80, "Cole a descrição completa da vaga.").max(20000),
});

export const vagaEmpresaPublicarSchema = z.object({
  titulo: obrigatorio(140, "Informe o nome da vaga."),
  texto: z.string().trim().min(80).max(20000),
  requisitos: z
    .array(requisitoSchema.extend({ aceita: z.enum(["", "sim", "nao"]).default("") }))
    .min(1, "A vaga precisa de pelo menos um requisito.")
    .max(40),
});

export const desafioSchema = z.object({
  titulo: obrigatorio(140, "Informe o título do desafio."),
  vaga: texto(140).default(""),
  competencia: texto(80).default(""),
  descricao: obrigatorio(3000, "Informe o que a pessoa deve entregar."),
  prazo: dataISO,
});

export const entregaSchema = z.object({
  link: z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), "Cole um link completo, começando com https://"),
});

export const triagemSchema = z.object({ triagem: z.enum(["", "avancar", "nao"]) });

export const mensagemMentorSchema = z.object({
  conversaId: z.string().optional(),
  mensagem: z.string().trim().min(1, "Escreva sua mensagem.").max(4000, "Use no máximo 4000 caracteres."),
});

export const importarEvidenciasSchema = z.object({
  evidencias: z.array(evidenciaSchema).min(1, "Escolha pelo menos uma evidência.").max(20),
});

/** Formata o primeiro erro de validação em uma frase para o usuário. */
export function primeiroErro(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Dados inválidos.";
}
