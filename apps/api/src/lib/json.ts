/** Listas guardadas como JSON em texto (portável entre SQLite e PostgreSQL). */
export function lerLista(v: string | null | undefined): string[] {
  if (!v) return [];
  try {
    const x: unknown = JSON.parse(v);
    return Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : [];
  } catch {
    return [];
  }
}

export function gravarLista(l: string[]): string {
  return JSON.stringify(l);
}
