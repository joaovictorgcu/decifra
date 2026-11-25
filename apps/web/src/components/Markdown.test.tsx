import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

const html = (texto: string) => renderToStaticMarkup(<Markdown texto={texto} />);

describe("Markdown do Mentor", () => {
  it("nunca injeta HTML vindo da IA", () => {
    const h = html('<script>alert(1)</script> <img src=x onerror="alert(1)"> **ok**');
    expect(h).not.toContain("<script>");
    expect(h).not.toContain("<img");
    expect(h).toContain("&lt;script&gt;");
    expect(h).toContain("<strong>ok</strong>");
  });

  it("renderiza parágrafos, listas e negrito", () => {
    const h = html("Primeiro passo:\n\n- **SQL**: publique as consultas\n- Power BI\n\n1. um\n2. dois");
    expect(h).toContain("<p>Primeiro passo:</p>");
    expect(h).toContain("<ul><li><strong>SQL</strong>: publique as consultas</li><li>Power BI</li></ul>");
    expect(h).toContain("<ol><li>um</li><li>dois</li></ol>");
  });

  it("transforma títulos em negrito e ignora linhas separadoras", () => {
    const h = html("### Plano de 2 semanas\n\n---\n\nTexto");
    expect(h).toContain("<p><strong>Plano de 2 semanas</strong></p>");
    expect(h).not.toContain("---");
    expect(h).not.toContain("<h3");
  });

  it("não renderiza links (o Mentor não deve citar URLs clicáveis)", () => {
    expect(html("veja [aqui](https://exemplo.com)")).not.toContain("<a ");
  });
});
