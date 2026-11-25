import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ErroIA } from "../src/ai/tipos";
import { Cliente, criarAppTeste, db, limparBanco, novaEmpresa, novoCandidato, VAGA_DADOS, type AppTeste } from "./helpers";

let t: AppTeste;
let tIA: AppTeste;

beforeEach(async () => {
  await limparBanco();
  t ??= await criarAppTeste();
  tIA ??= await criarAppTeste({ ia: true });
  tIA.fake!.respostas = {};
  tIA.fake!.falhar = null;
  tIA.fake!.falharAposTrechos = null;
  tIA.fake!.atrasoMs = 0;
  tIA.fake!.textoChat = "Olá! Comece pelo mini-projeto de SQL.";
  tIA.fake!.pedidos = [];
  tIA.logs.length = 0;
  tIA.disjuntor.reiniciar();
});

afterAll(async () => {
  await t?.app.close();
  await tIA?.app.close();
  await db.$disconnect();
});

function multipart(nome: string, conteudo: string | Buffer, tipo = "text/plain") {
  const b = "----decifra" + Date.now();
  const corpo = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\nContent-Type: ${tipo}\r\n\r\n`),
    Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo),
    Buffer.from(`\r\n--${b}--\r\n`),
  ]);
  return { corpo, tipo: `multipart/form-data; boundary=${b}` };
}

describe("autenticação e segurança", () => {
  it("cadastra, mantém sessão, sai e entra de novo", async () => {
    const c = new Cliente(t.app);
    const r = await c.post("/api/auth/cadastro", { nome: "Ana", email: "Ana@Teste.dev", senha: "senhaforte1", papel: "candidato" });
    expect(r.statusCode).toBe(201);
    expect(r.json().usuario.email).toBe("ana@teste.dev");
    expect(r.headers["set-cookie"]).toMatch(/HttpOnly/i);
    expect(JSON.stringify(r.json())).not.toContain("passwordHash");
    expect((await c.get("/api/auth/sessao")).statusCode).toBe(200);
    await c.post("/api/auth/logout");
    expect((await c.get("/api/auth/sessao")).statusCode).toBe(401);
    const l = await c.post("/api/auth/login", { email: "ana@teste.dev", senha: "senhaforte1" });
    expect(l.statusCode).toBe(200);
  });

  it("rejeita e-mail duplicado, senha errada e dados inválidos", async () => {
    await novoCandidato(t.app);
    const c = new Cliente(t.app);
    const dup = await c.post("/api/auth/cadastro", { nome: "Ana", email: "ana@teste.dev", senha: "senhaforte1", papel: "candidato" });
    expect(dup.statusCode).toBe(409);
    const errada = await c.post("/api/auth/login", { email: "ana@teste.dev", senha: "errada123" });
    expect(errada.statusCode).toBe(401);
    expect(errada.json().erro).toBe("E-mail ou senha incorretos.");
    const inexistente = await c.post("/api/auth/login", { email: "nao@existe.dev", senha: "errada123" });
    expect(inexistente.json().erro).toBe("E-mail ou senha incorretos.");
    const curta = await c.post("/api/auth/cadastro", { nome: "X", email: "x@x.dev", senha: "123", papel: "candidato" });
    expect(curta.statusCode).toBe(400);
    expect(curta.json()).toMatchObject({ codigo: "validacao", campo: "senha" });
  });

  it("bloqueia escrita sem cabeçalho do app ou de outra origem (CSRF)", async () => {
    const sem = await t.app.inject({ method: "POST", url: "/api/auth/login", payload: {} });
    expect(sem.statusCode).toBe(403);
    const outra = await t.app.inject({ method: "POST", url: "/api/auth/login", payload: {}, headers: { "x-decifra": "1", origin: "https://malicioso.example" } });
    expect(outra.statusCode).toBe(403);
  });

  it("exige login e respeita o papel", async () => {
    expect((await new Cliente(t.app).get("/api/evidencias")).statusCode).toBe(401);
    const emp = await novaEmpresa(t.app);
    expect((await emp.get("/api/evidencias")).statusCode).toBe(403);
    const cand = await novoCandidato(t.app);
    expect((await cand.get("/api/empresa/vagas")).statusCode).toBe(403);
  });

  it("limita tentativas de login por minuto", async () => {
    const lim = await criarAppTeste({ limite: true });
    const c = new Cliente(lim.app);
    const status: number[] = [];
    // E-mails diferentes: isola o limite por IP do limite por e-mail.
    for (let i = 0; i < 12; i++) status.push((await c.post("/api/auth/login", { email: `x${i}@x.dev`, senha: "errada123" })).statusCode);
    expect(status.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(status.at(-1)).toBe(429);
    await lim.app.close();
  });

  it("bloqueia o e-mail após 5 senhas erradas, mesmo de IPs diferentes", async () => {
    await novoCandidato(t.app, "alvo@teste.dev");
    const status: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await t.app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "alvo@teste.dev", senha: `errada${i}` },
        headers: { "x-decifra": "1" },
        remoteAddress: `10.0.0.${i}`,
      });
      status.push(r.statusCode);
    }
    expect(status.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(status[5]).toBe(429);
    // Nem a senha certa entra durante o bloqueio; outro e-mail não é afetado.
    const certa = await new Cliente(t.app).post("/api/auth/login", { email: "alvo@teste.dev", senha: "senhaforte1" });
    expect(certa.json().codigo).toBe("tentativas");
    await novoCandidato(t.app, "outro@teste.dev");
    expect((await new Cliente(t.app).post("/api/auth/login", { email: "outro@teste.dev", senha: "senhaforte1" })).statusCode).toBe(200);
  });

  it("não deixa contornar o CSRF com caminho codificado (/%61pi/...)", async () => {
    const r = await t.app.inject({ method: "POST", url: "/%61pi/auth/logout", payload: {} });
    expect(r.statusCode).toBe(403);
  });

  it("não confia em X-Forwarded-For forjado sem proxy configurado", async () => {
    const lim = await criarAppTeste({ limite: true });
    const status: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await lim.app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: `y${i}@x.dev`, senha: "errada123" },
        headers: { "x-decifra": "1", "x-forwarded-for": `6.6.6.${i}` },
      });
      status.push(r.statusCode);
    }
    expect(status.at(-1)).toBe(429);
    await lim.app.close();
  });

  it("envia cabeçalhos de segurança", async () => {
    const r = await t.app.inject({ method: "GET", url: "/api/saude" });
    expect(r.headers["content-security-policy"]).toBeTruthy();
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("diagnóstico e evidências", () => {
  it("classifica a etapa e valida o diagnóstico", async () => {
    const c = await novoCandidato(t.app);
    const s = (await c.get("/api/auth/sessao")).json();
    expect(s.perfil.etapa).toBe("Buscando a vaga");
    const ruim = await c.put("/api/perfil/diagnostico", { destino: "dados", origem: "x", situacao: "trabalha", tempo: "6a12", candidatou: "nao", atrapalha: [] });
    expect(ruim.statusCode).toBe(400);
  });

  it("CRUD de evidências isolado por usuário", async () => {
    const ana = await novoCandidato(t.app);
    const bia = await novoCandidato(t.app, "bia@teste.dev");
    const cr = await ana.post("/api/evidencias", { titulo: "Curso de SQL", tipo: "Curso", concluido: true, competencias: ["SQL"] });
    expect(cr.statusCode).toBe(201);
    const id = cr.json().id;
    expect(cr.json().faltas.length).toBeGreaterThan(0);
    expect((await bia.get(`/api/evidencias/${id}`)).statusCode).toBe(404);
    expect((await bia.del(`/api/evidencias/${id}`)).statusCode).toBe(404);
    const up = await ana.put(`/api/evidencias/${id}`, { titulo: "Curso de SQL", tipo: "Curso", concluido: true, competencias: ["SQL"], problema: "p", fez: "f", ferramentas: "SQL", resultado: "r" });
    expect(up.json().completa).toBe(true);
    expect((await ana.get("/api/evidencias")).json().itens).toHaveLength(1);
    const link = await ana.post("/api/evidencias", { titulo: "X", tipo: "Projeto", link: "javascript:alert(1)" });
    expect(link.statusCode).toBe(400);
    expect((await ana.del(`/api/evidencias/${id}`)).statusCode).toBe(200);
  });
});

describe("Raio-X", () => {
  it("gera Raio-X por regras, persiste e aplica o limite do plano grátis", async () => {
    const c = await novoCandidato(t.app);
    await c.post("/api/evidencias", { titulo: "Curso de SQL", tipo: "Curso", concluido: true, competencias: ["SQL"] });
    const r = await c.post("/api/vagas", { titulo: "Analista de Dados", texto: VAGA_DADOS });
    expect(r.statusCode).toBe(201);
    const v = r.json();
    expect(v.fonte).toBe("regras");
    expect(v.raio.reqs.find((q: { curto: string }) => q.curto === "SQL").situacao).toBe("comprova");
    expect(v.raio.reqs.some((q: { tipo: string }) => q.tipo === "formal")).toBe(true);
    expect((await c.get(`/api/vagas/${v.id}`)).json().decisao).toBe(v.decisao);
    await c.post("/api/vagas", { texto: VAGA_DADOS });
    await c.post("/api/vagas", { texto: VAGA_DADOS });
    const quarta = await c.post("/api/vagas", { texto: VAGA_DADOS });
    expect(quarta.statusCode).toBe(402);
    expect((await c.get("/api/auth/sessao")).json().uso.raioMes).toBe(3);
  });

  it("Plus não tem limite; texto curto e sem requisitos são recusados", async () => {
    const c = await novoCandidato(t.app, "plus@teste.dev", "plus");
    for (let i = 0; i < 4; i++) expect((await c.post("/api/vagas", { texto: VAGA_DADOS })).statusCode).toBe(201);
    expect((await c.post("/api/vagas", { texto: "SQL" })).statusCode).toBe(400);
    const sem = await c.post("/api/vagas", { texto: "Somos uma empresa incrível, com ambiente descontraído e muitas oportunidades para quem gosta de crescer." });
    expect(sem.statusCode).toBe(422);
  });

  it("usa a IA quando disponível e só aceita evidências da própria pessoa", async () => {
    const c = await novoCandidato(tIA.app);
    const ev = (await c.post("/api/evidencias", { titulo: "Painel", tipo: "Projeto", competencias: ["Looker Studio"] })).json();
    tIA.fake!.respostas.requisitos_da_vaga = {
      requisitos: [
        { requisito: "Looker Studio", curto: "Looker Studio", tipo: "tecnica", kind: "", obrig: true, evId: ev.id },
        { requisito: "SQL", curto: "SQL", tipo: "tecnica", kind: "", obrig: true, evId: "id-de-outra-pessoa" },
        { requisito: "2 anos de experiência", curto: "2 anos de experiência", tipo: "formal", kind: "tempo", obrig: true, evId: "" },
      ],
    };
    const r = (await c.post("/api/vagas", { texto: VAGA_DADOS })).json();
    expect(r.fonte).toBe("ia");
    expect(r.raio.reqs[0].evidenciaId).toBe(ev.id);
    expect(r.raio.reqs[1].evId).toBeNull();
    expect(tIA.fake!.pedidos[0]?.mensagem).toContain("<vaga>");
    expect(tIA.logs[0]).toMatchObject({ tarefa: "extrair_requisitos", status: "ok" });
  });

  it("cai para o motor de regras quando a IA falha", async () => {
    const c = await novoCandidato(tIA.app);
    tIA.fake!.falhar = new ErroIA("tempo", "timeout");
    const r = await c.post("/api/vagas", { texto: VAGA_DADOS });
    expect(r.statusCode).toBe(201);
    expect(r.json().fonte).toBe("regras");
    expect(tIA.logs[0]).toMatchObject({ status: "erro" });
  });
});

describe("ajuste e reanálise do Raio-X", () => {
  it("a pessoa corrige peso, remove e adiciona requisitos; a decisão é recalculada", async () => {
    const c = await novoCandidato(t.app);
    const v = (await c.post("/api/vagas", { texto: VAGA_DADOS })).json();
    const pbi = v.raio.reqs.find((q: { curto: string }) => q.curto === "Power BI");
    const p = await c.patch(`/api/vagas/${v.id}/requisitos/${pbi.id}`, { obrig: false });
    expect(p.json().raio.reqs.find((q: { id: string }) => q.id === pbi.id).obrig).toBe(false);
    expect(p.json().ajustada).toBe(true);
    const add = await c.post(`/api/vagas/${v.id}/requisitos`, { nome: "Python", tipo: "tecnica", obrig: false });
    expect(add.statusCode).toBe(201);
    expect(add.json().raio.reqs.some((q: { curto: string; obrig: boolean }) => q.curto === "Python" && !q.obrig)).toBe(true);
    expect((await c.post(`/api/vagas/${v.id}/requisitos`, { nome: "python", tipo: "tecnica", obrig: true })).statusCode).toBe(409);
    expect((await c.post(`/api/vagas/${v.id}/requisitos`, { nome: "Pós", tipo: "formal", obrig: true })).json().campo).toBe("kind");
    const del = await c.del(`/api/vagas/${v.id}/requisitos/${pbi.id}`);
    expect(del.json().raio.reqs.some((q: { id: string }) => q.id === pbi.id)).toBe(false);
    // Outra pessoa não altera a vaga.
    const outra = await novoCandidato(t.app, "bia@teste.dev");
    expect((await outra.patch(`/api/vagas/${v.id}/requisitos/${v.raio.reqs[0].id}`, { obrig: false })).statusCode).toBe(404);
  });

  it("vaga publicada por empresa não pode ser alterada pelo candidato", async () => {
    const emp = await novaEmpresa(t.app);
    const a = (await emp.post("/api/empresa/vagas/analisar", { titulo: "Dados", texto: VAGA_DADOS })).json();
    const pub = (await emp.post("/api/empresa/vagas", { titulo: "Dados", texto: VAGA_DADOS, requisitos: a.requisitos })).json();
    const c = await novoCandidato(t.app);
    const v = (await c.post(`/api/vagas-abertas/${pub.id}/raio`)).json();
    expect((await c.patch(`/api/vagas/${v.id}/requisitos/${v.raio.reqs[0].id}`, { obrig: false })).json().codigo).toBe("vaga_empresa");
    expect((await c.post(`/api/vagas/${v.id}/reanalisar`)).json().codigo).toBe("vaga_empresa");
  });

  it("reanalisar com IA substitui os requisitos e não consome Raio-X do mês", async () => {
    const c = await novoCandidato(tIA.app);
    // Falha comum (não 429): o disjuntor do app de teste é compartilhado e um 429 pausaria o provedor para os próximos testes.
    tIA.fake!.falhar = new ErroIA("falha", "fora do ar");
    const v = (await c.post("/api/vagas", { texto: VAGA_DADOS })).json();
    expect(v.fonte).toBe("regras");
    // IA continua fora: requisitos atuais são mantidos.
    expect((await c.post(`/api/vagas/${v.id}/reanalisar`)).statusCode).toBe(503);
    tIA.fake!.falhar = null;
    tIA.fake!.respostas.requisitos_da_vaga = {
      requisitos: [
        { requisito: "SQL", curto: "SQL", tipo: "tecnica", kind: "", obrig: true, evId: "" },
        { requisito: "Python", curto: "Python", tipo: "tecnica", kind: "", obrig: false, evId: "" },
      ],
    };
    const r = await c.post(`/api/vagas/${v.id}/reanalisar`);
    expect(r.json()).toMatchObject({ fonte: "ia", ajustada: false });
    expect(r.json().ia).toContain("Groq");
    expect(r.json().raio.reqs.map((q: { curto: string }) => q.curto)).toEqual(["SQL", "Python"]);
    expect((await c.get("/api/auth/sessao")).json().uso.raioMes).toBe(1);
  });
});

describe("Plano, candidaturas e radar", () => {
  it("leva ações ao Plano sem duplicar e mini-projeto concluído vira evidência", async () => {
    const c = await novoCandidato(t.app);
    const v = (await c.post("/api/vagas", { texto: VAGA_DADOS })).json();
    expect((await c.post(`/api/vagas/${v.id}/plano`)).json().adicionadas).toBeGreaterThan(0);
    expect((await c.post(`/api/vagas/${v.id}/plano`)).json().adicionadas).toBe(0);
    const ts = (await c.get("/api/tarefas")).json().itens;
    const mini = ts.find((x: { tipo: string }) => x.tipo === "mini");
    expect(mini.vagaTitulo).toBeTruthy();
    const feito = (await c.patch(`/api/tarefas/${mini.id}`, { status: "feito" })).json();
    expect(feito.evidenciaCriadaId).toBeTruthy();
    const denovo = (await c.patch(`/api/tarefas/${mini.id}`, { status: "feito" })).json();
    expect(denovo.evidenciaCriadaId).toBeNull();
    expect((await c.patch(`/api/tarefas/${mini.id}`, { prazo: "31/12/2026" })).statusCode).toBe(400);
    const sug = (await c.get("/api/plano/sugestoes")).json().itens;
    expect(Array.isArray(sug)).toBe(true);
  });

  it("registra candidatura uma vez e move de etapa", async () => {
    const c = await novoCandidato(t.app);
    const v = (await c.post("/api/vagas", { texto: VAGA_DADOS })).json();
    const cand = await c.post("/api/candidaturas", { vagaId: v.id });
    expect(cand.statusCode).toBe(201);
    expect((await c.post("/api/candidaturas", { vagaId: v.id })).statusCode).toBe(409);
    const mv = await c.patch(`/api/candidaturas/${cand.json().id}`, { etapa: "Entrevista" });
    expect(mv.json().etapa).toBe("Entrevista");
    expect((await c.patch(`/api/candidaturas/${cand.json().id}`, { etapa: "Contratado" })).statusCode).toBe(400);
  });

  it("radar e entrevista são exclusivos do Plus", async () => {
    const g = await novoCandidato(t.app);
    expect((await g.get("/api/radar")).statusCode).toBe(402);
    expect((await g.post("/api/entrevista/feedback", { pergunta: "Como você aprende algo novo?", resposta: "Eu aprendo praticando muito todos os dias." })).statusCode).toBe(402);
    const p = await novoCandidato(t.app, "plus@teste.dev", "plus");
    await p.post("/api/vagas", { texto: VAGA_DADOS });
    const r = (await p.get("/api/radar")).json();
    expect(r.totalVagas).toBe(1);
    expect(r.prioridade).toBeTruthy();
  });
});

describe("tradutor e entrevista", () => {
  it("traduz por regras e salva como evidência", async () => {
    const c = await novoCandidato(t.app);
    const r = (await c.post("/api/tradutor", { entrada: "Acompanhava metas de vendas em planilhas" })).json();
    expect(r.fonte).toBe("regras");
    expect(r.itens[0].competencias.length).toBeGreaterThan(0);
    const e = await c.post("/api/tradutor/evidencia", { entrada: r.itens[0].entrada, competencias: r.itens[0].competencias });
    expect(e.json().tipo).toBe("Caso da carreira anterior");
  });

  it("descarta resposta da IA que viola os princípios", async () => {
    const c = await novoCandidato(tIA.app);
    tIA.fake!.respostas.traducao_de_experiencia = {
      itens: [{ entrada: "Atendia clientes", competencias: ["pesquisa com usuários"], curriculo: "Garanto resultados", entrevista: "Você será contratada", falta: "" }],
    };
    const r = (await c.post("/api/tradutor", { entrada: "Atendia clientes no balcão" })).json();
    expect(r.fonte).toBe("regras");
  });

  it("história usa IA só com evidência completa; feedback via IA", async () => {
    const c = await novoCandidato(tIA.app, "plus@teste.dev", "plus");
    const inc = (await c.post("/api/evidencias", { titulo: "Painel", tipo: "Projeto", competencias: ["Power BI"] })).json();
    const h1 = (await c.post("/api/historias", { pergunta: "Conte sobre um problema que você resolveu.", evidenciaId: inc.id })).json();
    expect(h1.fonte).toBe("regras");
    expect(h1.situacao).toContain("[Complete");
    expect(tIA.fake!.pedidos).toHaveLength(0);
    const ok = (await c.post("/api/evidencias", { titulo: "Painel", tipo: "Projeto", competencias: ["Power BI"], problema: "p", fez: "f", ferramentas: "Power BI", resultado: "r", link: "https://x.dev" })).json();
    tIA.fake!.respostas.historia_star = { situacao: "S", tarefa: "T", acao: "A", resultado: "R" };
    const h2 = (await c.post("/api/historias", { pergunta: "Conte sobre um problema que você resolveu.", evidenciaId: ok.id })).json();
    expect(h2).toMatchObject({ fonte: "ia", situacao: "S" });
    tIA.fake!.respostas.feedback_entrevista = { clareza: "Clara.", objetividade: "Objetiva.", sugestoes: ["Feche com o resultado."] };
    const f = (await c.post("/api/entrevista/feedback", { pergunta: "Como você aprende algo novo?", resposta: "Eu aprendo praticando e anotando o que deu certo." })).json();
    expect(f.fonte).toBe("ia");
    expect((await c.get("/api/historias")).json().itens).toHaveLength(2);
  });
});

describe("cota diária de IA", () => {
  it("acima do teto, tarefas usam o motor de regras e a importação responde 429", async () => {
    const semCota = await criarAppTeste({ ia: true, uso: async () => ({ total: 999, complexas: 0 }) });
    const c = await novoCandidato(semCota.app, "cota@teste.dev");
    semCota.fake!.respostas.requisitos_da_vaga = { requisitos: [{ requisito: "SQL", curto: "SQL", tipo: "tecnica", kind: "", obrig: true, evId: "" }] };
    const r = (await c.post("/api/vagas", { texto: VAGA_DADOS })).json();
    expect(r.fonte).toBe("regras");
    expect(semCota.fake!.pedidos).toHaveLength(0);
    const m = multipart("cv.txt", "Ana Souza, analista com experiência em relatórios.");
    expect((await c.req("POST", "/api/evidencias/importar/analisar", m.corpo, { "content-type": m.tipo })).statusCode).toBe(429);
    await semCota.app.close();
  });
});

describe("Mentor (IA conversacional)", () => {
  it("responde 503 quando a IA não está configurada", async () => {
    const c = await novoCandidato(t.app);
    const r = await c.post("/api/mentor/mensagens", { mensagem: "Por onde começo?" });
    expect(r.statusCode).toBe(503);
  });

  it("transmite resposta por SSE, guarda histórico e usa o contexto da pessoa", async () => {
    const c = await novoCandidato(tIA.app);
    await c.post("/api/evidencias", { titulo: "Curso de SQL", tipo: "Curso", concluido: true, competencias: ["SQL"] });
    const r = await c.post("/api/mentor/mensagens", { mensagem: "Por onde começo?" });
    expect(r.headers["content-type"]).toContain("text/event-stream");
    expect(r.body).toContain("event: inicio");
    expect(r.body).toContain("event: trecho");
    expect(r.body).toContain("event: fim");
    expect(tIA.fake!.pedidos[0]?.sistema).toContain("Curso de SQL");
    expect(r.body).toContain("event: meta");
    expect(r.body).toContain("Groq");
    const conversas = (await c.get("/api/mentor/conversas")).json().itens;
    expect(conversas).toHaveLength(1);
    const det = (await c.get(`/api/mentor/conversas/${conversas[0].id}`)).json();
    expect(det.mensagens.map((m: { papel: string }) => m.papel)).toEqual(["user", "assistant"]);
    expect(det.mensagens[1].ia).toContain("Groq");
    expect((await c.get("/api/auth/sessao")).json().uso.mentorHoje).toBe(1);
    const outra = await novoCandidato(tIA.app, "bia@teste.dev");
    expect((await outra.get(`/api/mentor/conversas/${conversas[0].id}`)).statusCode).toBe(404);
  });

  it("informa erro no stream quando a IA falha", async () => {
    const c = await novoCandidato(tIA.app);
    tIA.fake!.falhar = new ErroIA("falha", "x");
    const r = await c.post("/api/mentor/mensagens", { mensagem: "Oi" });
    expect(r.body).toContain("event: erro");
    // Nada é gravado e a cota não é consumida quando não há resposta.
    expect((await c.get("/api/mentor/conversas")).json().itens).toHaveLength(0);
    expect((await c.get("/api/auth/sessao")).json().uso.mentorHoje).toBe(0);
  });

  it("guarda a resposta parcial marcada quando o stream cai no meio", async () => {
    const c = await novoCandidato(tIA.app);
    tIA.fake!.textoChat = "um dois tres quatro cinco seis";
    tIA.fake!.falharAposTrechos = 3;
    tIA.fake!.falhar = new ErroIA("falha", "queda");
    const r = await c.post("/api/mentor/mensagens", { mensagem: "Me ajude com meu plano" });
    expect(r.body).toContain("event: erro");
    expect(r.body).toContain("interrompida");
    const conv = (await c.get("/api/mentor/conversas")).json().itens[0];
    const det = (await c.get(`/api/mentor/conversas/${conv.id}`)).json();
    expect(det.mensagens[1]).toMatchObject({ papel: "assistant", interrompida: true, conteudo: "um dois tres " });
    tIA.fake!.falharAposTrechos = null;
    tIA.fake!.textoChat = "Olá! Comece pelo mini-projeto de SQL.";
  });

  it("ações sugeridas ficam fora do texto e só entram no Plano com confirmação", async () => {
    const c = await novoCandidato(tIA.app);
    tIA.fake!.textoChat = 'Documente seu painel. <acoes>[{"tipo":"tarefa","titulo":"Documentar o painel de vendas no GitHub","prazoDias":5},{"tipo":"mini","competencia":"Power BI"}]</acoes>';
    const r = await c.post("/api/mentor/mensagens", { mensagem: "O que eu faço esta semana?" });
    // O bloco de ações nunca é enviado como texto visível.
    expect(r.body).not.toContain("<acoes>");
    expect(r.body).toContain("event: fim");
    const conv = (await c.get("/api/mentor/conversas")).json().itens[0];
    const msg = (await c.get(`/api/mentor/conversas/${conv.id}`)).json().mensagens[1];
    expect(msg.conteudo).toBe("Documente seu painel.");
    expect(msg.acoes).toHaveLength(2);
    // Nada foi criado ainda.
    expect((await c.get("/api/tarefas")).json().itens).toHaveLength(0);
    const ok = await c.post("/api/mentor/acoes", { mensagemId: msg.id, indice: 0 });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().tarefa).toMatchObject({ tipo: "mentor", titulo: "Documentar o painel de vendas no GitHub" });
    expect((await c.post("/api/mentor/acoes", { mensagemId: msg.id, indice: 0 })).statusCode).toBe(409);
    expect((await c.post("/api/mentor/acoes", { mensagemId: msg.id, indice: 1 })).json().tarefa.tipo).toBe("mini");
    expect((await c.get("/api/tarefas")).json().itens).toHaveLength(2);
    // Outra pessoa não executa ações desta mensagem.
    const outra = await novoCandidato(tIA.app, "bia@teste.dev");
    expect((await outra.post("/api/mentor/acoes", { mensagemId: msg.id, indice: 1 })).statusCode).toBe(404);
  });

  it("sugere perguntas conforme a etapa e os dados da pessoa", async () => {
    const c = await novoCandidato(tIA.app);
    const s = (await c.get("/api/mentor/sugestoes")).json().itens;
    expect(s.length).toBeGreaterThan(1);
    expect(s[0]).toContain("retorno das empresas");
  });
});

describe("importação de currículo e arquivos", () => {
  it("propõe evidências sem inventar links e salva as escolhidas", async () => {
    const c = await novoCandidato(tIA.app);
    tIA.fake!.respostas.evidencias_do_documento = {
      evidencias: [
        { titulo: "Dashboard de vendas", tipo: "Projeto", concluido: false, link: "https://inventado.dev", competencias: ["Power BI", "Power BI"], problema: "", fez: "Montei um painel", ferramentas: "Power BI", resultado: "" },
        { titulo: "Portfólio", tipo: "Projeto", concluido: false, link: "https://github.com/ana", competencias: [], problema: "", fez: "", ferramentas: "", resultado: "" },
      ],
    };
    const m = multipart("cv.txt", "Ana Souza\nMontei um dashboard de vendas em Power BI.\nPortfólio: https://github.com/ana\n");
    const r = await c.req("POST", "/api/evidencias/importar/analisar", m.corpo, { "content-type": m.tipo });
    expect(r.statusCode).toBe(200);
    const { rascunhos } = r.json();
    expect(rascunhos[0].link).toBe("");
    expect(rascunhos[0].competencias).toEqual(["Power BI"]);
    expect(rascunhos[1].link).toBe("https://github.com/ana");
    const s = await c.post("/api/evidencias/importar", { evidencias: [rascunhos[0]] });
    expect(s.statusCode).toBe(201);
  });

  it("recusa arquivo de tipo não suportado e exige IA para importar", async () => {
    const c = await novoCandidato(tIA.app);
    const m = multipart("foto.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), "image/png");
    expect((await c.req("POST", "/api/arquivos/texto", m.corpo, { "content-type": m.tipo })).statusCode).toBe(415);
    const sem = await novoCandidato(t.app, "sem-ia@teste.dev");
    const m2 = multipart("cv.txt", "texto de currículo suficientemente longo para análise");
    expect((await sem.req("POST", "/api/evidencias/importar/analisar", m2.corpo, { "content-type": m2.tipo })).statusCode).toBe(503);
    const txt = await sem.req("POST", "/api/arquivos/texto", m2.corpo, { "content-type": m2.tipo });
    expect(txt.json().texto).toContain("currículo");
  });
});

describe("empresa, desafios e perfil público", () => {
  it("publica vaga revisada com selo e candidato faz Raio-X com os pesos da empresa", async () => {
    const emp = await novaEmpresa(t.app);
    const a = (await emp.post("/api/empresa/vagas/analisar", { titulo: "Analista de Dados", texto: VAGA_DADOS })).json();
    const reqs = a.requisitos.map((q: { tipo: string }) => ({ ...q, aceita: q.tipo === "formal" ? "sim" : "" }));
    const pub = await emp.post("/api/empresa/vagas", { titulo: a.titulo, texto: a.texto, requisitos: reqs });
    expect(pub.statusCode).toBe(201);
    expect(pub.json().selo).toBe(true);
    const semSelo = await emp.post("/api/empresa/vagas", { titulo: "Outra", texto: a.texto, requisitos: a.requisitos.map((q: object) => ({ ...q, aceita: "" })) });
    expect(semSelo.json().selo).toBe(false);

    const c = await novoCandidato(t.app);
    const abertas = (await c.get("/api/vagas-abertas")).json().itens;
    expect(abertas).toHaveLength(2);
    const r = await c.post(`/api/vagas-abertas/${pub.json().id}/raio`);
    expect(r.json().fonte).toBe("empresa");
    expect(r.json().raio.reqs.find((q: { tipo: string }) => q.tipo === "formal").nota).toContain("empresa informou");
    const de_novo = await c.post(`/api/vagas-abertas/${pub.json().id}/raio`);
    expect(de_novo.json().id).toBe(r.json().id);
    expect((await c.get("/api/auth/sessao")).json().uso.raioMes).toBe(1);

    await emp.patch(`/api/empresa/vagas/${pub.json().id}`, { publicada: false });
    expect((await c.get("/api/vagas-abertas")).json().itens).toHaveLength(1);
  });

  it("desafio: entrega vira evidência, só uma por pessoa, triagem só pela dona", async () => {
    const emp = await novaEmpresa(t.app);
    const outra = await novaEmpresa(t.app, "outra@empresa.dev");
    const prazo = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    expect((await emp.post("/api/empresa/desafios", { titulo: "Painel", descricao: "Monte um painel", competencia: "Power BI", prazo: "2000-01-01" })).statusCode).toBe(400);
    const d = (await emp.post("/api/empresa/desafios", { titulo: "Painel", descricao: "Monte um painel", competencia: "Power BI", prazo })).json();
    const c = await novoCandidato(t.app);
    expect((await c.get("/api/desafios")).json().itens).toHaveLength(1);
    expect((await c.post(`/api/desafios/${d.id}/entregas`, { link: "nao-e-link" })).statusCode).toBe(400);
    const e = await c.post(`/api/desafios/${d.id}/entregas`, { link: "https://github.com/ana/painel" });
    expect(e.statusCode).toBe(201);
    expect((await c.post(`/api/desafios/${d.id}/entregas`, { link: "https://github.com/ana/painel" })).statusCode).toBe(409);
    expect((await c.get("/api/evidencias")).json().itens[0].titulo).toContain("Desafio:");
    const entrega = (await emp.get("/api/empresa/desafios")).json().itens[0].entregas[0];
    expect((await outra.patch(`/api/empresa/entregas/${entrega.id}`, { triagem: "avancar" })).statusCode).toBe(404);
    expect((await emp.patch(`/api/empresa/entregas/${entrega.id}`, { triagem: "avancar" })).statusCode).toBe(200);
    expect((await c.get("/api/desafios")).json().itens[0].minhaEntrega.triagem).toBe("avancar");
  });

  it("perfil só fica visível e buscável quando a pessoa publica", async () => {
    const c = await novoCandidato(t.app);
    await c.post("/api/evidencias", { titulo: "Curso de SQL", tipo: "Curso", concluido: true, competencias: ["SQL"] });
    const slug = (await c.get("/api/auth/sessao")).json().perfil.slug;
    const anon = new Cliente(t.app);
    expect((await anon.get(`/api/publico/perfis/${slug}`)).statusCode).toBe(404);
    expect((await c.get(`/api/publico/perfis/${slug}`)).statusCode).toBe(200);
    const emp = await novaEmpresa(t.app);
    expect((await emp.get("/api/empresa/candidatos?q=sql")).json().itens).toHaveLength(0);
    await c.patch("/api/perfil/publico", { publico: true });
    const pub = (await anon.get(`/api/publico/perfis/${slug}`)).json();
    expect(pub.competencias[0]).toMatchObject({ competencia: "SQL", comprovada: true });
    expect(JSON.stringify(pub)).not.toContain("ana@teste.dev");
    expect((await emp.get("/api/empresa/candidatos?q=sql")).json().itens).toHaveLength(1);
    expect((await emp.get("/api/empresa/candidatos?q=figma")).json().itens).toHaveLength(0);
  });
});

describe("validação: feedback e métricas", () => {
  it("feedback do Raio-X e do Mentor: só no que é seu, pode ser trocado e volta no detalhe", async () => {
    const c = await novoCandidato(tIA.app);
    const v = (await c.post("/api/vagas", { texto: VAGA_DADOS })).json();
    expect(v.feedback).toBeNull();
    expect((await c.post("/api/feedback", { alvo: "raio", refId: v.id, util: false, comentario: "Faltou Python" })).statusCode).toBe(200);
    expect((await c.get(`/api/vagas/${v.id}`)).json().feedback).toBe(false);
    await c.post("/api/feedback", { alvo: "raio", refId: v.id, util: true });
    expect((await c.get(`/api/vagas/${v.id}`)).json().feedback).toBe(true);
    expect(await db.feedback.count()).toBe(1);

    await c.post("/api/mentor/mensagens", { mensagem: "Por onde começo?" });
    const conv = (await c.get("/api/mentor/conversas")).json().itens[0];
    const msg = (await c.get(`/api/mentor/conversas/${conv.id}`)).json().mensagens[1];
    await c.post("/api/feedback", { alvo: "mentor", refId: msg.id, util: true });
    expect((await c.get(`/api/mentor/conversas/${conv.id}`)).json().mensagens[1].feedback).toBe(true);

    const outra = await novoCandidato(tIA.app, "bia@teste.dev");
    expect((await outra.post("/api/feedback", { alvo: "raio", refId: v.id, util: true })).statusCode).toBe(404);
    expect((await outra.post("/api/feedback", { alvo: "mentor", refId: msg.id, util: true })).statusCode).toBe(404);
  });

  it("métricas por hipótese a partir dos dados reais", async () => {
    const { calcularMetricas } = await import("../src/lib/metricas");
    const c = await novoCandidato(t.app);
    const v = (await c.post("/api/vagas", { texto: VAGA_DADOS })).json();
    await c.post("/api/feedback", { alvo: "raio", refId: v.id, util: true });
    await c.post(`/api/vagas/${v.id}/plano`);
    const tarefa = (await c.get("/api/tarefas")).json().itens[0];
    await c.patch(`/api/tarefas/${tarefa.id}`, { status: "feito" });
    const r = await calcularMetricas(db, 30);
    const h = Object.fromEntries(r.hipoteses.map((x) => [x.id, x]));
    expect(h.H1).toMatchObject({ valor: 1, n: 1, status: "amostra insuficiente" });
    expect(h.H2).toMatchObject({ valor: 1, n: 1 });
    expect(h.H3).toMatchObject({ valor: 1, n: 1 });
    expect(r.volume).toMatchObject({ candidatosCadastrados: 1, candidatosAtivos: 1, raioX: 1 });
  });
});

describe("conta (LGPD)", () => {
  it("exporta dados, troca senha e exclui a conta", async () => {
    const c = await novoCandidato(t.app);
    await c.post("/api/evidencias", { titulo: "Curso", tipo: "Curso" });
    const ex = await c.get("/api/conta/exportar");
    expect(ex.headers["content-disposition"]).toContain("attachment");
    expect(ex.json().evidencias).toHaveLength(1);
    expect(Array.isArray(ex.json().usoIA)).toBe(true);
    expect(JSON.stringify(ex.json())).not.toContain("passwordHash");
    expect((await c.post("/api/conta/senha", { senhaAtual: "errada", novaSenha: "outrasenha1" })).statusCode).toBe(400);
    const antes = c.cookie;
    expect((await c.post("/api/conta/senha", { senhaAtual: "senhaforte1", novaSenha: "outrasenha1" })).statusCode).toBe(200);
    expect(c.cookie).not.toBe(antes);
    expect((await c.get("/api/auth/sessao")).statusCode).toBe(200);
    expect((await c.del("/api/conta", { senha: "senhaforte1" })).statusCode).toBe(400);
    expect((await c.del("/api/conta", { senha: "outrasenha1" })).statusCode).toBe(200);
    expect(await db.evidence.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
  });
});

describe("leitura de PDF", () => {
  /** Monta um PDF mínimo válido (com tabela xref correta) contendo o texto informado. */
  function pdfCom(texto: string): Buffer {
    const conteudo = `BT /F1 12 Tf 72 720 Td (${texto}) Tj ET`;
    const objs = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
      `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let out = "%PDF-1.4\n";
    const offs: number[] = [];
    objs.forEach((o, i) => {
      offs.push(out.length);
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(out, "latin1");
  }

  it("extrai o texto de um PDF enviado", async () => {
    const c = await novoCandidato(t.app);
    const m = multipart("vaga.pdf", pdfCom("Requisitos: SQL e Power BI para analista de dados junior"), "application/pdf");
    const r = await c.req("POST", "/api/arquivos/texto", m.corpo, { "content-type": m.tipo });
    expect(r.statusCode).toBe(200);
    expect(r.json().texto).toContain("Power BI");
  });

  it("recusa PDF corrompido com mensagem clara", async () => {
    const c = await novoCandidato(t.app);
    const m = multipart("ruim.pdf", Buffer.from("%PDF-1.4 lixo sem estrutura"), "application/pdf");
    const r = await c.req("POST", "/api/arquivos/texto", m.corpo, { "content-type": m.tipo });
    expect([422]).toContain(r.statusCode);
  });
});
