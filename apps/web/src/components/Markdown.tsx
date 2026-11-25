import type { ReactNode } from "react";

/**
 * Renderizador mínimo de markdown para as respostas do Mentor: parágrafos,
 * listas e negrito. Gera elementos React (nunca HTML bruto), então o texto
 * vindo da IA não consegue injetar marcação na página.
 */
function inline(texto: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((p, i) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
}

export function Markdown({ texto }: { texto: string }) {
  const blocos: ReactNode[] = [];
  const linhas = texto.replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i]!;
    if (!l.trim() || /^\s*([-*_])\1{2,}\s*$/.test(l)) {
      i++;
      continue;
    }
    // Títulos viram um parágrafo em negrito (o Mentor não deve usá-los, mas modelos menores às vezes usam).
    if (/^\s*#{1,6}\s+/.test(l)) {
      blocos.push(
        <p key={`h${i}`}>
          <strong>{inline(l.replace(/^\s*#{1,6}\s+/, "").replace(/\*\*/g, ""))}</strong>
        </p>,
      );
      i++;
      continue;
    }
    const ul = /^\s*[-*•]\s+/;
    const ol = /^\s*\d+[.)]\s+/;
    if (ul.test(l) || ol.test(l)) {
      const ordenada = ol.test(l);
      const re = ordenada ? ol : ul;
      const itens: ReactNode[] = [];
      while (i < linhas.length && re.test(linhas[i]!)) {
        itens.push(<li key={i}>{inline(linhas[i]!.replace(re, ""))}</li>);
        i++;
      }
      blocos.push(ordenada ? <ol key={`b${i}`}>{itens}</ol> : <ul key={`b${i}`}>{itens}</ul>);
      continue;
    }
    const par: string[] = [];
    while (i < linhas.length && linhas[i]!.trim() && !ul.test(linhas[i]!) && !ol.test(linhas[i]!)) {
      par.push(linhas[i]!.replace(/^#+\s*/, ""));
      i++;
    }
    blocos.push(<p key={`b${i}`}>{inline(par.join(" "))}</p>);
  }
  return <>{blocos}</>;
}
