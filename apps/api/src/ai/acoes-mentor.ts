import type { AcaoMentor } from "@decifra/shared";
import { z } from "zod";
import { violaPrincipios } from "../domain/regras";
import { norm } from "../domain/texto";

/**
 * Ações que o Mentor pode sugerir no fim da resposta, num bloco
 * <acoes>[...]</acoes>. O bloco é retirado do texto mostrado, validado e
 * guardado; nada é criado sem a pessoa clicar para confirmar.
 * Funciona com qualquer provedor (não depende de tool use).
 */
export const ABRE = "<acoes>";
export const FECHA = "</acoes>";

const Acao = z.union([
  z.object({ tipo: z.literal("tarefa"), titulo: z.string(), prazoDias: z.number().optional() }),
  z.object({ tipo: z.literal("mini"), competencia: z.string() }),
]);

/** Valida e normaliza as ações extraídas do bloco (no máximo 3, sem repetição). */
export function lerAcoes(bruto: string): AcaoMentor[] {
  let json: unknown;
  try {
    json = JSON.parse(bruto.trim().replace(/^```(?:json)?|```$/g, "").trim());
  } catch {
    return [];
  }
  if (!Array.isArray(json)) return [];
  const out: AcaoMentor[] = [];
  const vistos = new Set<string>();
  for (const item of json.slice(0, 6)) {
    const r = Acao.safeParse(item);
    if (!r.success) continue;
    if (r.data.tipo === "tarefa") {
      const titulo = r.data.titulo.replace(/\s+/g, " ").trim().slice(0, 200);
      if (titulo.length < 8 || /https?:\/\//i.test(titulo)) continue;
      // O Plano é de provas, não de estudo genérico: "faça/assista um curso" não vira tarefa.
      if (/\b(curso|cursos|bootcamp|videoaula|tutoria(l|is))\b/.test(norm(titulo)) || violaPrincipios([titulo])) continue;
      const chave = `t:${titulo.toLowerCase()}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const prazo = Math.round(r.data.prazoDias ?? 7);
      out.push({ tipo: "tarefa", titulo, prazoDias: Math.min(30, Math.max(1, Number.isFinite(prazo) ? prazo : 7)), executada: false });
    } else {
      const competencia = r.data.competencia.trim().slice(0, 60);
      if (competencia.length < 2) continue;
      const chave = `m:${competencia.toLowerCase()}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      out.push({ tipo: "mini", competencia, executada: false });
    }
    if (out.length >= 3) break;
  }
  return out;
}

/** Lê ações gravadas em Message.acoes (JSON). */
export function acoesGravadas(v: string | null): AcaoMentor[] {
  if (!v) return [];
  try {
    const x: unknown = JSON.parse(v);
    return Array.isArray(x) ? (x as AcaoMentor[]) : [];
  } catch {
    return [];
  }
}

/**
 * Filtro de streaming: repassa o texto e segura tudo a partir de "<acoes>",
 * inclusive quando a marcação chega partida entre dois trechos.
 */
export class FiltroAcoes {
  private resto = "";
  private capturando = false;
  private capturado = "";

  processar(trecho: string): string {
    if (this.capturando) {
      this.capturado += trecho;
      return "";
    }
    const t = this.resto + trecho;
    this.resto = "";
    const i = t.indexOf(ABRE);
    if (i >= 0) {
      this.capturando = true;
      this.capturado = t.slice(i + ABRE.length);
      return t.slice(0, i);
    }
    // Possível início da marcação cortado no fim do trecho.
    const p = t.lastIndexOf("<");
    if (p >= 0 && ABRE.startsWith(t.slice(p))) {
      this.resto = t.slice(p);
      return t.slice(0, p);
    }
    return t;
  }

  /** Texto pendente (se a marcação nunca se completou) e o conteúdo do bloco. */
  finalizar(): { pendente: string; bloco: string | null } {
    if (!this.capturando) return { pendente: this.resto, bloco: null };
    const f = this.capturado.indexOf(FECHA);
    return { pendente: "", bloco: f >= 0 ? this.capturado.slice(0, f) : this.capturado };
  }
}

/** Remove o bloco de ações de um texto completo (para gravar só o que a pessoa leu). */
export function separarAcoes(texto: string): { texto: string; acoes: AcaoMentor[] } {
  const i = texto.indexOf(ABRE);
  if (i < 0) return { texto: texto.trim(), acoes: [] };
  const f = texto.indexOf(FECHA, i);
  const bloco = texto.slice(i + ABRE.length, f >= 0 ? f : undefined);
  return { texto: texto.slice(0, i).trim(), acoes: lerAcoes(bloco) };
}
