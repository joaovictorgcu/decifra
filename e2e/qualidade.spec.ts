import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cadastrarCandidato } from "./ajuda";

/** Nenhuma página pode ter rolagem horizontal (layout quebrado no celular). */
async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "rolagem horizontal").toBeLessThanOrEqual(1);
}

async function semViolacoesGraves(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const graves = r.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
}

test("páginas públicas: acessibilidade e responsividade", async ({ page }) => {
  for (const url of ["/", "/projeto", "/entrar", "/planos", "/pagina-que-nao-existe"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await semRolagemHorizontal(page);
    await semViolacoesGraves(page);
  }
});

test("páginas do app: acessibilidade e responsividade", async ({ page }) => {
  await cadastrarCandidato(page);
  for (const url of ["/inicio", "/raio-x", "/evidencias", "/evidencias/nova", "/tradutor", "/plano", "/candidaturas", "/mentor", "/perfil", "/conta", "/radar"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await semRolagemHorizontal(page);
    await semViolacoesGraves(page);
  }
});

test("menu do celular mostra os itens secundários em Mais", async ({ page, isMobile }) => {
  test.skip(!isMobile, "só no celular");
  await cadastrarCandidato(page);
  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link", { name: "Raio-X" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Candidaturas" })).toBeHidden();
  await page.getByRole("button", { name: "Mais" }).click();
  await expect(nav.getByRole("link", { name: "Candidaturas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});
