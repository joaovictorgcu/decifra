/** Avisos curtos (toasts) acessíveis, no mesmo padrão do protótipo: região aria-live fixa. */
let temporizador: ReturnType<typeof setTimeout> | undefined;

export function avisar(texto: string, tipo: "ok" | "erro" = "ok") {
  const a = document.getElementById("avisos");
  if (!a) return;
  const p = document.createElement("p");
  p.textContent = texto;
  if (tipo === "erro") p.className = "erro-aviso";
  a.replaceChildren(p);
  clearTimeout(temporizador);
  temporizador = setTimeout(() => a.replaceChildren(), tipo === "erro" ? 6000 : 4000);
}
