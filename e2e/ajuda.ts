import { expect, type Page } from "@playwright/test";

let n = 0;
export const emailUnico = (prefixo: string) => `${prefixo}-${Date.now()}-${n++}@e2e.dev`;

export const VAGA = `Vaga: Analista de Dados Júnior

Requisitos:
- SQL
- Power BI
- Análise de indicadores
- 1 ano de experiência na área

Benefícios:
- Vale refeição`;

export async function cadastrar(page: Page, papel: "candidato" | "empresa", nome: string, email: string) {
  await page.goto(`/entrar?modo=cadastro&papel=${papel}`);
  await page.getByLabel(papel === "empresa" ? "Nome da empresa" : "Seu nome").fill(nome);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senhaforte1");
  await page.locator("form").getByRole("button", { name: "Criar conta" }).click();
}

export async function cadastrarCandidato(page: Page, email = emailUnico("cand")) {
  await cadastrar(page, "candidato", "Ana", email);
  await expect(page.getByRole("heading", { level: 1, name: "Em que momento você está?" })).toBeVisible();
  await page.getByLabel("Análise de dados").check();
  await page.getByLabel("2. De qual área você vem?").fill("Assistente administrativa");
  await page.getByLabel("Trabalho em outra área").check();
  await page.getByLabel("De 6 meses a 1 ano").check();
  await page.getByRole("group", { name: /5\./ }).getByLabel("Sim").check();
  await page.getByLabel("Pouco retorno das empresas").check();
  await page.getByRole("button", { name: "Ver minha etapa" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Olá, Ana" })).toBeVisible();
  return email;
}

/** Navega pelo menu principal; no celular, abre "Mais" quando o item é secundário. */
export async function irPara(page: Page, item: string) {
  const link = page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: new RegExp(`(^| )${item}$`) });
  if (!(await link.isVisible())) await page.getByRole("button", { name: "Mais" }).click();
  await link.click();
}
