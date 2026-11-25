import { describe, expect, it } from "vitest";
import { extrairEventosSSE } from "./cliente";

describe("parser SSE do Mentor", () => {
  it("separa vários eventos completos", () => {
    const r = extrairEventosSSE('event: meta\ndata: {"ia":"Groq"}\n\nevent: trecho\ndata: {"t":"Olá"}\n\n');
    expect(r.eventos).toEqual([
      { evento: "meta", dados: '{"ia":"Groq"}' },
      { evento: "trecho", dados: '{"t":"Olá"}' },
    ]);
    expect(r.resto).toBe("");
  });

  it("guarda o pedaço incompleto para a próxima leitura", () => {
    const a = extrairEventosSSE('event: trecho\ndata: {"t":"um"}\n\nevent: tre');
    expect(a.eventos).toHaveLength(1);
    const b = extrairEventosSSE(a.resto + 'cho\ndata: {"t":"dois"}\n\n');
    expect(b.eventos).toEqual([{ evento: "trecho", dados: '{"t":"dois"}' }]);
  });

  it("aceita CRLF e dados em várias linhas", () => {
    const r = extrairEventosSSE("event: erro\r\ndata: linha1\r\ndata: linha2\r\n\r\n");
    expect(r.eventos).toEqual([{ evento: "erro", dados: "linha1\nlinha2" }]);
  });
});
