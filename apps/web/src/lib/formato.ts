export function dataBR(iso: string): string {
  if (!iso) return "";
  const d = iso.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
}

export function juntar(l: string[]): string {
  return l.length < 2 ? (l[0] ?? "") : `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`;
}

export function mai(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function somarDias(dias: number): string {
  const d = new Date(Date.now() + dias * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}
