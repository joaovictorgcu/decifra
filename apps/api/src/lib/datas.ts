/**
 * Datas de calendário no fuso do produto (APP_TZ, padrão America/Sao_Paulo).
 * Prazos, "hoje" e a virada das cotas diárias/mensais seguem esse fuso, e não
 * o do servidor (que em produção costuma ser UTC): sem isso, depois das 21h no
 * Brasil um prazo "de hoje" já seria tratado como vencido.
 */
export const FUSO_PADRAO = "America/Sao_Paulo";

let fuso = FUSO_PADRAO;

export function definirFuso(tz: string) {
  // Lança RangeError se o fuso não existir.
  new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  fuso = tz;
}

export function fusoAtual(): string {
  return fuso;
}

function partes(d: Date, tz = fuso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { a: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), min: Number(p.minute), s: Number(p.second) };
}

/** AAAA-MM-DD no fuso do produto. */
export function dataLocal(d = new Date(), tz = fuso): string {
  const p = partes(d, tz);
  return `${p.a}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Diferença (ms) entre o relógio local do fuso e UTC naquele instante. */
function deslocamento(d: Date, tz: string): number {
  const p = partes(d, tz);
  return Date.UTC(p.a, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(d.getTime() / 1000) * 1000;
}

/** Instante (UTC) da meia-noite local de uma data do calendário no fuso. */
function meiaNoite(a: number, m: number, dia: number, tz: string): Date {
  const palpite = Date.UTC(a, m - 1, dia);
  // Duas iterações cobrem mudanças de horário de verão.
  let t = palpite - deslocamento(new Date(palpite), tz);
  t = palpite - deslocamento(new Date(t), tz);
  return new Date(t);
}

export function inicioDoDia(d = new Date(), tz = fuso): Date {
  const p = partes(d, tz);
  return meiaNoite(p.a, p.m, p.d, tz);
}

export function inicioDoMes(d = new Date(), tz = fuso): Date {
  const p = partes(d, tz);
  return meiaNoite(p.a, p.m, 1, tz);
}

/** Data do calendário somando dias (AAAA-MM-DD). */
export function somarDias(dias: number, base = new Date(), tz = fuso): string {
  const [a, m, d] = dataLocal(base, tz).split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}
