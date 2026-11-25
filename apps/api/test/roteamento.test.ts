import { describe, expect, it } from "vitest";
import { z } from "zod";
import { carregarConfigIA } from "../src/ai/config";
import { Disjuntor } from "../src/ai/disjuntor";
import { redigirDadosPessoais } from "../src/ai/privacidade";
import { extrairJSON, paraSchemaEstrito } from "../src/ai/providers/openai-compativel";
import { classificar, permitido } from "../src/ai/roteador";
import { ServicoIA, type RegistroInteracao } from "../src/ai/servico";
import { extrairRequisitosIA } from "../src/ai/tarefas";
import { ErroIA, type IdProvedor, type MetaIA } from "../src/ai/tipos";
import { ProvedorFake, configTeste } from "./helpers";

const Resposta = z.object({ ok: z.boolean() });
const pedido = { sistema: "s", mensagem: "m", schema: Resposta, nomeSchema: "teste" };

function montar(ids: IdProvedor[], extra: Parameters<typeof configTeste>[1] = {}, relogio = { t: 1_000_000 }) {
  const fakes = new Map(ids.map((id) => [id, new ProvedorFake(id)] as const));
  for (const f of fakes.values()) f.respostas.teste = { ok: true };
  const logs: RegistroInteracao[] = [];
  const ia = new ServicoIA(configTeste(ids, extra), new Map(fakes), { registrar: (r) => void logs.push(r), agora: () => relogio.t, disjuntor: new Disjuntor() });
  return { ia, fakes, logs, relogio, f: (id: IdProvedor) => fakes.get(id)! };
}

describe("cenários de disponibilidade", () => {
  it("1. Groq disponível e Gemini indisponível: usa Groq sem tocar no Gemini", async () => {
    const { ia, f } = montar(["groq", "gemini"]);
    f("gemini").falhar = new ErroIA("falha", "fora do ar");
    const r = await ia.gerarJSON("traduzir", "u1", pedido);
    expect(r.meta.provedor).toBe("groq");
    expect(f("gemini").pedidos).toHaveLength(0);
  });

  it("2. Groq indisponível e Gemini disponível: cai para o Gemini e registra as duas tentativas", async () => {
    const { ia, f, logs } = montar(["groq", "gemini"]);
    f("groq").falhar = new ErroIA("tempo", "timeout");
    const r = await ia.gerarJSON("traduzir", "u1", pedido);
    expect(r.meta.provedor).toBe("gemini");
    expect(logs.map((l) => [l.provedor, l.status, l.tentativa])).toEqual([
      ["groq", "erro", 1],
      ["gemini", "ok", 2],
    ]);
  });

  it("3. Ambos indisponíveis: erro 'indisponivel' e a tarefa cai para o motor de regras", async () => {
    const { ia, f } = montar(["groq", "gemini"]);
    f("groq").falhar = new ErroIA("falha", "500");
    f("gemini").falhar = new ErroIA("falha", "503");
    await expect(ia.gerarJSON("traduzir", "u1", pedido)).rejects.toMatchObject({ motivo: "indisponivel" });
    expect(await extrairRequisitosIA(ia, "u1", "Requisitos: SQL", [])).toBeNull();
  });

  it("4. Nenhuma chave configurada: IA desligada e o produto segue pelas regras", async () => {
    const cfg = carregarConfigIA({}, false);
    expect(cfg.desligada).toBe(true);
    const ia = new ServicoIA(cfg, new Map(), { registrar: () => undefined });
    expect(ia.ativa).toBe(false);
    expect(ia.disponivelPara("mentor")).toBe(false);
    await expect(ia.gerarJSON("traduzir", null, pedido)).rejects.toMatchObject({ motivo: "desativada" });
    expect(await extrairRequisitosIA(ia, null, "Requisitos: SQL", [])).toBeNull();
  });

  it("5. Modelo gratuito no limite (429): pausa pelo Retry-After, pula o provedor e informa o tempo de espera", async () => {
    const { ia, f, relogio } = montar(["groq", "gemini"]);
    f("groq").falhar = new ErroIA("limite", "429", { aposMs: 120_000 });
    expect((await ia.gerarJSON("traduzir", "u1", pedido)).meta.provedor).toBe("gemini");
    // Próxima chamada nem tenta o Groq enquanto ele está em pausa.
    f("groq").pedidos = [];
    expect((await ia.gerarJSON("traduzir", "u1", pedido)).meta.provedor).toBe("gemini");
    expect(f("groq").pedidos).toHaveLength(0);
    // Todos no limite: erro "limite" com a menor espera.
    f("gemini").falhar = new ErroIA("limite", "429", { aposMs: 30_000 });
    relogio.t += 121_000;
    await expect(ia.gerarJSON("traduzir", "u1", pedido)).rejects.toMatchObject({ motivo: "limite", aposMs: 30_000 });
    // Com os dois em pausa, a resposta é imediata, sem chamadas.
    f("groq").pedidos = [];
    await expect(ia.gerarJSON("traduzir", "u1", pedido)).rejects.toMatchObject({ motivo: "indisponivel" });
    expect(f("groq").pedidos).toHaveLength(0);
  });

  it("6. Provedor avançado configurado: tarefas complexas vão para ele; simples ficam no gratuito", () => {
    const cfg = carregarConfigIA({ GROQ_API_KEY: "g", GEMINI_API_KEY: "m", ANTHROPIC_API_KEY: "a", AI_AVANCADO: "anthropic" }, false);
    expect(cfg.rotas.complexa[0]).toEqual({ provedor: "anthropic" });
    expect(cfg.rotas.simples[0]).toEqual({ provedor: "groq" });
    expect(cfg.rotas.simples.at(-1)).toEqual({ provedor: "anthropic" }); // pago só como último recurso
    expect(cfg.provedores.get("anthropic")!.modelos.complexa).toBe("claude-opus-5-5");
    expect(cfg.provedores.get("groq")!.modelos.simples).toBe("openai/gpt-oss-20b");
  });

  it("7. Falha durante o streaming: não troca de provedor e marca a falha como parcial", async () => {
    const { ia, f } = montar(["groq", "ollama"]);
    f("groq").textoChat = "a b c d e";
    f("groq").falharAposTrechos = 2;
    f("groq").falhar = new ErroIA("falha", "queda");
    const recebidos: string[] = [];
    await expect(
      ia.conversar("mentor", "u1", { sistema: "s", mensagens: [{ papel: "user", conteudo: "oi" }] }, { aoReceber: (t) => recebidos.push(t) }),
    ).rejects.toMatchObject({ motivo: "falha", parcial: true });
    expect(recebidos.join("")).toBe("a b ");
    expect(f("ollama").pedidos).toHaveLength(0);
  });

  it("7b. Falha antes do primeiro trecho: o stream segue no próximo provedor", async () => {
    const { ia, f } = montar(["groq", "ollama"]);
    f("groq").falhar = new ErroIA("limite", "429");
    f("ollama").textoChat = "resposta local";
    let meta: MetaIA | null = null;
    const r = await ia.conversar("mentor", "u1", { sistema: "s", mensagens: [{ papel: "user", conteudo: "oi" }] }, { aoReceber: () => undefined, aoIniciar: (m) => (meta = m) });
    expect(r.dados).toBe("resposta local");
    expect(meta!.provedor).toBe("ollama");
  });

  it("8. Resposta estruturada inválida: tenta o próximo; se todos falharem, erro 'invalido'", async () => {
    const { ia, f } = montar(["groq", "gemini"]);
    f("groq").respostas.teste = { ok: "talvez" };
    expect((await ia.gerarJSON("traduzir", "u1", pedido)).meta.provedor).toBe("gemini");
    f("gemini").respostas.teste = { nada: 1 };
    await expect(ia.gerarJSON("traduzir", "u1", pedido)).rejects.toMatchObject({ motivo: "invalido" });
  });

  it("9. Cancelamento pela pessoa: para na hora, sem tentar outro provedor nem pausar o atual", async () => {
    const { ia, f, logs } = montar(["groq", "gemini"]);
    f("groq").atrasoMs = 200;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20);
    await expect(ia.gerarJSON("traduzir", "u1", pedido, {}, ctrl.signal)).rejects.toMatchObject({ motivo: "cancelado" });
    expect(f("gemini").pedidos).toHaveLength(0);
    expect(logs.at(-1)?.status).toBe("cancelado");
    f("groq").atrasoMs = 0;
    expect((await ia.gerarJSON("traduzir", "u1", pedido)).meta.provedor).toBe("groq");
  });

  it("10. Troca de modelo entre tarefa simples e complexa", async () => {
    const { ia, f } = montar(["groq"]);
    const conversa = (conteudo: string, sinais = {}) =>
      ia.conversar("mentor", "u1", { sistema: "s", mensagens: [{ papel: "user", conteudo }] }, { aoReceber: () => undefined }, { mensagem: conteudo, ...sinais });
    expect((await conversa("O que é SQL?")).meta).toMatchObject({ nivel: "simples", modelo: "groq-simples" });
    const r = await conversa("Monte um plano para eu resolver as lacunas das minhas vagas nas próximas semanas", { evidencias: 4, vagas: 3 });
    expect(r.meta).toMatchObject({ nivel: "complexa", modelo: "groq-avancado" });
    expect(f("groq").pedidos.map((p) => p.modelo)).toEqual(["groq-simples", "groq-avancado"]);
  });
});

describe("limite de tentativas, disjuntor e cotas", () => {
  it("respeita AI_MAX_TENTATIVAS", async () => {
    const { ia, f } = montar(["groq", "gemini", "ollama"], { maxTentativas: 2 });
    for (const id of ["groq", "gemini", "ollama"] as const) f(id).falhar = new ErroIA("falha", "x");
    await expect(ia.gerarJSON("traduzir", "u1", pedido)).rejects.toMatchObject({ motivo: "indisponivel" });
    expect(f("ollama").pedidos).toHaveLength(0);
  });

  it("credencial inválida pausa o provedor por 15 minutos", () => {
    const d = new Disjuntor();
    d.falha("groq", "autenticacao", 0);
    expect(d.pausadoAte("groq", 14 * 60_000)).toBe(15 * 60_000);
    expect(d.pausadoAte("groq", 15 * 60_000 + 1)).toBeNull();
  });

  it("abre após 3 falhas transitórias seguidas e fecha com sucesso", () => {
    const d = new Disjuntor();
    d.falha("gemini", "tempo", 0);
    d.falha("gemini", "falha", 0);
    expect(d.pausadoAte("gemini", 0)).toBeNull();
    d.falha("gemini", "tempo", 0);
    expect(d.pausadoAte("gemini", 1)).toBe(30_000);
    d.sucesso("gemini");
    expect(d.pausadoAte("gemini", 1)).toBeNull();
    // Resposta inválida não pausa o provedor.
    for (let i = 0; i < 5; i++) d.falha("groq", "invalido", 0);
    expect(d.pausadoAte("groq", 0)).toBeNull();
  });

  it("cota diária do usuário e rebaixamento de tarefas complexas", async () => {
    const fake = new ProvedorFake("groq");
    fake.textoChat = "ok";
    let uso = { total: 0, complexas: 99 };
    const ia = new ServicoIA(configTeste(["groq"]), new Map([["groq", fake]]), { registrar: () => undefined, usoHoje: async () => uso });
    const r = await ia.conversar("mentor", "u1", { sistema: "s", mensagens: [{ papel: "user", conteudo: "x" }] }, { aoReceber: () => undefined }, { mensagem: "Monte um plano de transição para as minhas vagas", vagas: 3 });
    expect(r.meta.nivel).toBe("intermediaria");
    uso = { total: 150, complexas: 0 };
    await expect(ia.gerarJSON("traduzir", "u1", pedido)).rejects.toMatchObject({ motivo: "cota" });
  });
});

describe("privacidade", () => {
  it("tarefas com dados pessoais não vão para provedores que podem treinar (Gemini gratuito)", async () => {
    const { ia, f } = montar(["gemini", "groq"]);
    f("groq").textoChat = "ok";
    const r = await ia.conversar("mentor", "u1", { sistema: "s", mensagens: [{ papel: "user", conteudo: "x" }] }, { aoReceber: () => undefined });
    expect(r.meta.provedor).toBe("groq");
    expect(f("gemini").pedidos).toHaveLength(0);
    // Tarefa de baixa sensibilidade (vaga) pode usar o Gemini.
    expect((await ia.gerarJSON("extrair_requisitos", "u1", pedido)).meta.provedor).toBe("gemini");
  });

  it("só Gemini gratuito configurado: Mentor e importação ficam indisponíveis por privacidade", async () => {
    const { ia } = montar(["gemini"]);
    expect(ia.disponivelPara("mentor")).toBe(false);
    expect(ia.disponivelPara("importar_cv")).toBe(false);
    expect(ia.disponivelPara("extrair_requisitos")).toBe(true);
    await expect(ia.gerarJSON("importar_cv", "u1", pedido)).rejects.toMatchObject({ motivo: "privacidade" });
  });

  it("política: estrita restringe também sensibilidade média; aberta libera tudo; GEMINI_PLANO=pago muda a classificação", () => {
    const base = configTeste(["gemini"]);
    expect(permitido({ ...base, privacidade: "padrao" }, "gemini", "media")).toBe(true);
    expect(permitido({ ...base, privacidade: "estrita" }, "gemini", "media")).toBe(false);
    expect(permitido({ ...base, privacidade: "aberta" }, "gemini", "alta")).toBe(true);
    const pago = carregarConfigIA({ GEMINI_API_KEY: "x", GEMINI_PLANO: "pago" }, false);
    expect(permitido(pago, "gemini", "alta")).toBe(true);
    const lista = carregarConfigIA({ GEMINI_API_KEY: "x", GROQ_API_KEY: "y", AI_PROVEDORES_CONFIAVEIS: "gemini" }, false);
    expect(permitido(lista, "gemini", "alta")).toBe(true);
    expect(permitido(lista, "groq", "alta")).toBe(false);
  });

  it("remove e-mail, telefone e CPF e preserva links", () => {
    const t = redigirDadosPessoais("Ana, ana.souza@gmail.com, (11) 91234-5678, CPF 123.456.789-09, github.com/ana e https://ana.dev/portfolio");
    expect(t).not.toMatch(/gmail|91234|456\.789/);
    expect(t).toContain("github.com/ana");
    expect(t).toContain("https://ana.dev/portfolio");
  });
});

describe("classificação determinística", () => {
  it("considera tarefa, volume de contexto e impacto, não só tamanho", () => {
    expect(classificar("traduzir", { itens: 2, tamanho: 120 })).toBe("simples");
    expect(classificar("traduzir", { itens: 12, tamanho: 900 })).toBe("intermediaria");
    // Extração alimenta a decisão do Raio-X: nunca usa o nível simples.
    expect(classificar("extrair_requisitos", { tamanho: 300 })).toBe("intermediaria");
    expect(classificar("extrair_requisitos", { tamanho: 7000 })).toBe("complexa");
    expect(classificar("extrair_requisitos", { tamanho: 3000, evidencias: 20 })).toBe("complexa");
    expect(classificar("importar_cv", { tamanho: 8000 })).toBe("complexa");
    expect(classificar("mentor", { mensagem: "Obrigado!" })).toBe("simples");
    // Pedido de plano com pouco contexto e mensagem curta não sobe para complexo.
    expect(classificar("mentor", { mensagem: "Qual o próximo passo?", evidencias: 0, vagas: 0 })).toBe("intermediaria");
    expect(classificar("mentor", { mensagem: "Qual o próximo passo?", evidencias: 5, vagas: 2 })).toBe("complexa");
  });
});

describe("configuração", () => {
  it("modelo por tarefa e provedor:modelo nas rotas", () => {
    const cfg = carregarConfigIA({ OLLAMA_MODEL: "qwen2.5:7b-instruct", GROQ_API_KEY: "g", AI_ROTA_MENTOR: "ollama:qwen2.5:3b-instruct,groq" }, false);
    expect(cfg.rotasTarefa.mentor).toEqual([{ provedor: "ollama", modelo: "qwen2.5:3b-instruct" }, { provedor: "groq", modelo: undefined }]);
    expect(cfg.provedores.get("ollama")!.modelos.complexa).toBe("qwen2.5:7b-instruct");
  });

  it("compatível com a configuração da versão 1", () => {
    const cfg = carregarConfigIA({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a", AI_MODEL: "claude-opus-5-5", AI_MODEL_FAST: "claude-haiku-5-5" }, false);
    expect(cfg.rotas.simples).toEqual([{ provedor: "anthropic" }]);
    expect(cfg.provedores.get("anthropic")!.modelos).toEqual({ simples: "claude-haiku-5-5", intermediaria: "claude-haiku-5-5", complexa: "claude-opus-5-5" });
    const compat = carregarConfigIA({ AI_PROVIDER: "openai-compatible", OPENAI_BASE_URL: "http://localhost:11434/v1", AI_MODEL: "llama" }, false);
    expect(compat.provedores.has("compativel")).toBe(true);
    expect(compat.provedores.has("openai")).toBe(false);
  });

  it("recusa configurações inconsistentes com mensagem clara", () => {
    expect(() => carregarConfigIA({ AI_PROVIDER: "mock" }, true)).toThrow(/produção/);
    expect(() => carregarConfigIA({ OPENROUTER_API_KEY: "x" }, false)).toThrow(/OPENROUTER_MODEL/);
    expect(() => carregarConfigIA({ GROQ_API_KEY: "x", AI_ROTA_SIMPLES: "gemini" }, false)).toThrow(/não está habilitado/);
    expect(() => carregarConfigIA({ GROQ_API_KEY: "x", AI_ROTA_SIMPLES: "chatgpt" }, false)).toThrow(/desconhecido/);
    expect(() => carregarConfigIA({ AI_AVANCADO: "anthropic" }, false)).toThrow(/AI_AVANCADO/);
  });

  it("OLLAMA_BASE_URL sem OLLAMA_MODEL não liga o Ollama (nem derruba a inicialização)", () => {
    const cfg = carregarConfigIA({ OLLAMA_BASE_URL: "http://host.docker.internal:11434/v1" }, true);
    expect(cfg.desligada).toBe(true);
  });

  it("AI_DESATIVAR desliga um provedor mesmo com chave", () => {
    const cfg = carregarConfigIA({ GROQ_API_KEY: "g", GEMINI_API_KEY: "m", AI_DESATIVAR: "groq" }, false);
    expect([...cfg.provedores.keys()]).toEqual(["gemini"]);
  });
});

describe("saída estruturada", () => {
  it("schema estrito: tudo obrigatório e sem propriedades extras", () => {
    const js = paraSchemaEstrito(z.object({ a: z.string(), b: z.array(z.object({ c: z.boolean() })) })) as {
      required: string[];
      additionalProperties: boolean;
      properties: { b: { items: { additionalProperties: boolean; required: string[] } } };
      $schema?: string;
    };
    expect(js.required).toEqual(["a", "b"]);
    expect(js.additionalProperties).toBe(false);
    expect(js.properties.b.items).toMatchObject({ additionalProperties: false, required: ["c"] });
    expect(js.$schema).toBeUndefined();
  });

  it("extrai JSON de cercas de código e ignora raciocínio <think>", () => {
    expect(extrairJSON('<think>hmm {"x":0}</think>\n```json\n{"ok": true}\n```')).toEqual({ ok: true });
    expect(extrairJSON('Aqui está: {"ok": false} fim')).toEqual({ ok: false });
    expect(extrairJSON("sem json")).toBeUndefined();
  });
});
