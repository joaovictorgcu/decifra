import { expect, test } from "@playwright/test";
import { cadastrarCandidato, irPara, VAGA } from "./ajuda";

test.describe("jornada do candidato", () => {
  test("cadastro, diagnóstico, evidência, Raio-X, Plano e candidatura", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Prove o que você sabe fazer");
    await cadastrarCandidato(page);
    await expect(page.getByText("Etapa atual: Buscando a vaga")).toBeVisible();

    // Evidência: validação e cadastro
    await irPara(page, "Evidências");
    await expect(page.getByText("Você ainda não registrou evidências")).toBeVisible();
    await page.getByRole("link", { name: "Nova evidência" }).click();
    await page.getByRole("button", { name: "Salvar evidência" }).click();
    await expect(page.getByText("Dê um título para a evidência.")).toBeVisible();
    await page.getByLabel("Título").fill("Curso de SQL");
    await page.getByLabel("Tipo").selectOption("Curso");
    await page.getByLabel("Curso ou certificado concluído").check();
    await page.getByLabel("Competências que comprova").fill("SQL");
    await page.getByRole("button", { name: "Salvar evidência" }).click();
    await expect(page.getByRole("heading", { name: "Curso de SQL" })).toBeVisible();

    // Raio-X
    await irPara(page, "Raio-X");
    await page.getByRole("button", { name: "Gerar Raio-X" }).click();
    await expect(page.getByText("Cole a descrição completa da vaga, com os requisitos.")).toBeVisible();
    await page.getByLabel("Nome da vaga").fill("Analista de Dados Júnior");
    await page.getByLabel("Cole aqui a descrição da vaga").fill(VAGA);
    await page.getByRole("button", { name: "Gerar Raio-X" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Analista de Dados Júnior" })).toBeVisible();
    const decisao = page.getByRole("region", { name: "Decisão" });
    await expect(decisao).toContainText("Busque uma vaga mais compatível");
    await expect(decisao).toContainText("motor de regras");
    await expect(page.getByRole("cell", { name: "SQL", exact: true }).or(page.getByText("SQL", { exact: true }).first())).toBeVisible();
    await expect(page.getByText("Você comprova").first()).toBeVisible();

    // Plano: ações sem duplicar; mini-projeto concluído vira evidência
    await page.getByRole("button", { name: "Levar ações para o Plano" }).click();
    await expect(page.locator("#avisos")).toContainText("ação(ões) no Plano");
    await page.getByRole("button", { name: "Atualizar o Plano" }).click();
    await expect(page.locator("#avisos")).toContainText("As ações já estavam no Plano");

    await page.getByRole("button", { name: "Registrar candidatura" }).click();
    await expect(page.getByRole("link", { name: "Ver candidatura" })).toBeVisible();

    await irPara(page, "Plano");
    const status = page.getByLabel("Status").first();
    await status.selectOption("feito");
    await expect(page.getByRole("heading", { level: 1, name: "Editar evidência" })).toBeVisible();
    await expect(page.getByLabel("Título")).toHaveValue(/Mini-projeto/);

    // Candidaturas
    await irPara(page, "Candidaturas");
    await expect(page.getByRole("heading", { name: "Candidatei (1)" })).toBeVisible();
    await page.getByLabel("Etapa").selectOption("Entrevista");
    await expect(page.getByRole("heading", { name: "Entrevista (1)" })).toBeVisible();

    // Persistência: recarregar mantém os dados
    await page.reload();
    await expect(page.getByRole("heading", { name: "Entrevista (1)" })).toBeVisible();
  });

  test("tradutor, perfil público e recursos Plus bloqueados", async ({ page, browser }) => {
    await cadastrarCandidato(page);
    await page.goto("/tradutor");
    await page.getByLabel("O que você fazia na carreira anterior").fill("Acompanhava metas de vendas em planilhas");
    await page.getByRole("button", { name: /Traduzir para/ }).click();
    await expect(page.getByText("análise de indicadores", { exact: false }).first()).toBeVisible();
    await page.getByRole("button", { name: "Salvar como evidência" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Editar evidência" })).toBeVisible();

    await page.goto("/radar");
    await expect(page.getByText("O Radar de Vagas faz parte do Plus")).toBeVisible();
    await page.goto("/entrevista");
    await expect(page.getByText("A Preparação para Entrevista faz parte do Plus")).toBeVisible();

    await irPara(page, "Meu Perfil");
    await expect(page.getByRole("heading", { name: "Seu perfil está privado" })).toBeVisible();
    await page.getByRole("button", { name: "Publicar perfil" }).click();
    await expect(page.getByRole("heading", { name: "Seu perfil está público" })).toBeVisible();
    const href = await page.getByRole("link", { name: "Ver como recrutador" }).getAttribute("href");

    // Visitante sem login vê o perfil público, sem e-mail
    const anon = await browser.newContext();
    const p2 = await anon.newPage();
    await p2.goto(href!);
    await expect(p2.getByRole("heading", { level: 1, name: "Ana" })).toBeVisible();
    await expect(p2.getByText("@e2e.dev")).toHaveCount(0);
    await anon.close();

    await page.getByRole("button", { name: "Tornar privado" }).click();
    const anon2 = await browser.newContext();
    const p3 = await anon2.newPage();
    await p3.goto(href!);
    await expect(p3.getByRole("heading", { name: "Perfil não encontrado" })).toBeVisible();
    await anon2.close();
  });

  test("Mentor: cancelamento, falha antes da resposta e queda no meio do stream", async ({ page }) => {
    await cadastrarCandidato(page);
    await irPara(page, "Mentor");
    const caixa = page.getByLabel("Sua mensagem");

    // Falha antes de responder: erro claro, pergunta devolvida ao campo e nada gravado.
    await caixa.fill("Pergunta que vai falhar #falhar");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByRole("alert")).toContainText("A IA está indisponível agora");
    await expect(caixa).toHaveValue("Pergunta que vai falhar #falhar");
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();

    // Cancelamento durante o stream: a resposta parcial fica marcada como interrompida.
    await caixa.fill("Resposta longa #lento");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Resposta de teste")).toBeVisible();
    await page.getByRole("button", { name: "Parar" }).click();
    await expect(page.getByText("Resposta interrompida.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Parar" })).toBeHidden();

    // Queda no meio do stream: mantém o que chegou, marca e avisa.
    await page.getByRole("link", { name: "Nova conversa" }).click();
    await caixa.fill("Vai cair no meio #cortar");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByRole("alert")).toContainText("A resposta foi interrompida");
    await expect(page.getByText("Resposta interrompida.").last()).toBeVisible();
  });

  test("Mentor responde em streaming e guarda o histórico", async ({ page }) => {
    await cadastrarCandidato(page);
    await irPara(page, "Mentor");
    await page.getByLabel("Sua mensagem").fill("Por onde eu começo?");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Resposta de teste do Mentor para:")).toBeVisible();
    await expect(page.getByText("Gerado por IA · Simulador de testes")).toBeVisible();
    await expect(page).toHaveURL(/\/mentor\/.+/);
    await expect(page.getByRole("complementary", { name: "Conversas" }).getByRole("link", { name: "Por onde eu começo?" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Resposta de teste do Mentor para:")).toBeVisible();
    await expect(page.getByText(/mensagens restantes hoje/)).toBeVisible();
  });

  test("Raio-X: ajustar requisitos recalcula a decisão; reanálise sem IA mantém os requisitos", async ({ page }) => {
    await cadastrarCandidato(page);
    await page.goto("/raio-x");
    await page.getByLabel("Cole aqui a descrição da vaga").fill(VAGA);
    await page.getByRole("button", { name: "Gerar Raio-X" }).click();
    await expect(page.getByRole("region", { name: "Decisão" })).toContainText("Busque uma vaga mais compatível");

    // Instrumento de validação (H1): a resposta fica salva.
    const fb = page.getByRole("group", { name: "Esta decisão fez sentido para você?" });
    await fb.getByRole("button", { name: "Não" }).click();
    await fb.getByPlaceholder("O que não funcionou? (opcional)").fill("Python também é pedido");
    await fb.getByRole("button", { name: "Enviar" }).click();
    await expect(fb.getByText("Obrigado!")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("group", { name: "Esta decisão fez sentido para você?" }).getByRole("button", { name: "Não" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Ajustar requisitos" }).click();
    await page.getByLabel("Peso de Power BI").selectOption("0");
    await page.getByLabel("Peso de Análise de indicadores").selectOption("0");
    // Justificativa recalculada: agora só SQL é lacuna obrigatória.
    await expect(page.getByRole("region", { name: "Decisão" })).toContainText("SQL ainda não aparece nas suas evidências");
    await page.getByLabel("Requisito", { exact: true }).fill("Python");
    await page.getByLabel("Peso na vaga").selectOption("0");
    await page.getByRole("button", { name: "Adicionar requisito" }).click();
    await expect(page.getByRole("button", { name: "Remover Python" })).toBeVisible();
    await page.getByRole("button", { name: "Concluir" }).click();
    await expect(page.getByText("Requisitos ajustados por você")).toBeVisible();

    // O simulador de testes não extrai requisitos: a reanálise falha e nada muda.
    await page.getByRole("button", { name: "Reanalisar com IA" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reanalisar" }).click();
    await expect(page.locator("#avisos")).toContainText("Seus requisitos atuais foram mantidos");
    await expect(page.getByText("Requisitos ajustados por você")).toBeVisible();
  });

  test("Mentor: ações sugeridas só entram no Plano com confirmação", async ({ page }) => {
    await cadastrarCandidato(page);
    await irPara(page, "Mentor");
    await page.getByLabel("Sua mensagem").fill("O que faço esta semana? #acoes");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Sugestões para o seu Plano")).toBeVisible();
    await expect(page.getByText("<acoes>")).toHaveCount(0);
    await page.getByRole("button", { name: "Adicionar ao Plano" }).first().click();
    await expect(page.getByRole("link", { name: "✓ No seu Plano" })).toBeVisible();
    await irPara(page, "Plano");
    await expect(page.getByText("Documentar o painel de vendas com problema, dados e resultado")).toBeVisible();
    await expect(page.getByText("Sugestão do Mentor")).toBeVisible();
    // A segunda sugestão não foi aceita, então não está no Plano.
    await expect(page.getByText("Monte um dashboard em Power BI")).toHaveCount(0);
  });

  test("login com senha errada mostra erro e sessão protege rotas", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/entrar/);
    await page.getByLabel("E-mail").fill("ninguem@e2e.dev");
    await page.getByLabel("Senha").fill("errada123");
    await page.locator("form").getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("E-mail ou senha incorretos.");
  });
});
