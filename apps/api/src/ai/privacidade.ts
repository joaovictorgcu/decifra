/**
 * Minimização de dados: remove contatos e documentos pessoais antes de enviar
 * texto a qualquer provedor. Nenhuma tarefa da DECIFRA precisa deles, e links
 * (portfólio, GitHub) são preservados.
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
// Telefones brasileiros: (11) 91234-5678, +55 11 912345678, 11 3456-7890...
const TELEFONE = /(?:\+?55[\s.-]?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;

export function redigirDadosPessoais(texto: string): string {
  return texto.replace(EMAIL, "[e-mail removido]").replace(CPF, "[documento removido]").replace(TELEFONE, "[telefone removido]");
}
