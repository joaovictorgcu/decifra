import { expect, test } from "@playwright/test";
import { cadastrar, cadastrarCandidato, emailUnico, irPara, VAGA } from "./ajuda";

test("empresa publica vaga e desafio; candidato faz Raio-X e entrega; empresa faz triagem", async ({ page, browser }) => {
  const nomeEmpresa = `Empresa ${Date.now()}`;
  await cadastrar(page, "empresa", nomeEmpresa, emailUnico("rh"));
  await expect(page.getByRole("heading", { level: 1, name: "Vagas Decifradas" })).toBeVisible();

  await page.getByLabel("Nome da vaga").fill("Analista de Dados Júnior");
  await page.getByLabel("Descrição da vaga").fill(VAGA);
  await page.getByRole("button", { name: "Analisar vaga" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Revise:/ })).toBeVisible();
  await expect(page.getByText("Hoje esta vaga ficaria sem selo.")).toBeVisible();
  await page.getByLabel("Sua empresa aceita experiência aplicada no lugar desta exigência?").selectOption("sim");
  await expect(page.getByText("Esta vaga receberá o selo.")).toBeVisible();
  await page.getByRole("button", { name: "Publicar vaga" }).click();
  await expect(page.getByText("Aberta a transição de carreira")).toBeVisible();

  await irPara(page, "Desafios");
  await page.getByLabel("Título do desafio").fill("Painel de vendas");
  await page.getByLabel("Competência avaliada").fill("Power BI");
  await page.getByLabel("O que a pessoa deve entregar").fill("Monte um painel com 3 indicadores.");
  await page.getByRole("button", { name: "Publicar desafio" }).click();
  await expect(page.getByRole("heading", { name: "Painel de vendas" })).toBeVisible();

  // Candidato
  const ctx = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  const c = await ctx.newPage();
  await cadastrarCandidato(c);
  await irPara(c, "Raio-X");
  const linha = c.getByRole("listitem").filter({ hasText: nomeEmpresa });
  await linha.getByRole("button", { name: "Fazer Raio-X" }).click();
  await expect(c.getByRole("region", { name: "Decisão" })).toContainText("revisados pela própria empresa");
  await expect(c.getByText("A empresa informou que aceita experiência aplicada")).toBeVisible();

  await irPara(c, "Evidências");
  const desafio = c.locator("form").filter({ hasText: nomeEmpresa });
  await desafio.getByLabel("Link da sua entrega").fill("https://github.com/ana/painel");
  await desafio.getByRole("button", { name: "Enviar entrega" }).click();
  await expect(c.getByRole("heading", { name: "Desafio: Painel de vendas" })).toBeVisible();
  await expect(c.locator("form").filter({ hasText: nomeEmpresa }).getByText("Aguardando avaliação da empresa.")).toBeVisible();

  // Empresa faz a triagem
  await page.reload();
  await page.getByLabel("Triagem").selectOption("avancar");
  await expect(page.locator("#avisos")).toContainText("Triagem salva");
  await c.reload();
  await expect(c.locator("form").filter({ hasText: nomeEmpresa }).getByText("A empresa quer conversar com você.")).toBeVisible();
  await ctx.close();
});
