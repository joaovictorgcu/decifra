import { describe, expect, it } from "vitest";
import { dataLocal, inicioDoDia, inicioDoMes, somarDias } from "../src/lib/datas";

const SP = "America/Sao_Paulo";

describe("datas no fuso do produto", () => {
  it("às 22h de Brasília ainda é o mesmo dia (em UTC já seria o dia seguinte)", () => {
    const noite = new Date("2026-11-26T01:00:00Z"); // 25/11 22:00 em São Paulo
    expect(dataLocal(noite, SP)).toBe("2026-11-25");
    expect(dataLocal(noite, "UTC")).toBe("2026-11-26");
  });

  it("início do dia e do mês são a meia-noite local, expressa em UTC", () => {
    const t = new Date("2026-11-26T01:00:00Z");
    expect(inicioDoDia(t, SP).toISOString()).toBe("2026-11-25T03:00:00.000Z");
    expect(inicioDoMes(t, SP).toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(inicioDoDia(t, "UTC").toISOString()).toBe("2026-11-26T00:00:00.000Z");
  });

  it("soma dias atravessando mês e ano pelo calendário local", () => {
    const t = new Date("2026-12-31T23:30:00Z"); // 31/12 20:30 em São Paulo
    expect(somarDias(1, t, SP)).toBe("2027-01-01");
    expect(somarDias(7, new Date("2026-11-28T12:00:00Z"), SP)).toBe("2026-12-05");
  });

  it("funciona em fuso com horário de verão", () => {
    // Nova York: horário de verão terminou em 01/11/2026.
    expect(inicioDoDia(new Date("2026-11-01T15:00:00Z"), "America/New_York").toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(inicioDoDia(new Date("2026-11-02T15:00:00Z"), "America/New_York").toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
});
