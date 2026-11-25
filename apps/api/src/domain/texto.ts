/** Utilitários de texto do motor de análise (portados do protótipo). */

export function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function semPonto(s: string): string {
  return String(s).trim().replace(/[.;,:]+$/, "");
}

export function mai(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function juntar(l: string[]): string {
  return l.length < 2 ? (l[0] ?? "") : `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`;
}

export function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function dataMais(dias: number, base = new Date()): string {
  return new Date(base.getTime() + dias * 864e5).toISOString().slice(0, 10);
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}
