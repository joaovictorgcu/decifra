// Envia as variáveis de .env.producao para o projeto da Vercel (production e preview),
// sem mostrar valores na tela. Uso (depois de `npx vercel login` e `npx vercel link`):
//   node scripts/vercel-env.mjs            envia tudo
//   node scripts/vercel-env.mjs --listar   só mostra os NOMES que seriam enviados
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const OBRIGATORIAS = ["DATABASE_URL", "DIRECT_URL"];
// Padrões seguros para a Vercel (podem ser sobrescritos no arquivo).
const PADROES = { NODEJS_HELPERS: "0", AI_PRIVACIDADE: "padrao" };

let texto;
try {
  texto = readFileSync(".env.producao", "utf8");
} catch {
  console.error("Crie o arquivo .env.producao na raiz (veja .env.producao.exemplo).");
  process.exit(1);
}
const vars = { ...PADROES };
for (const linha of texto.split(/\r?\n/)) {
  const m = linha.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  const valor = m[2].replace(/^["']|["']$/g, "");
  if (valor) vars[m[1]] = valor;
}
const faltando = OBRIGATORIAS.filter((k) => !vars[k]);
if (faltando.length) {
  console.error(`Faltam no .env.producao: ${faltando.join(", ")}`);
  process.exit(1);
}
for (const k of OBRIGATORIAS) {
  if (!/^postgres(ql)?:\/\//.test(vars[k])) {
    console.error(`${k} precisa começar com postgresql:// (copie do botão Connect do Supabase).`);
    process.exit(1);
  }
}
if (process.argv.includes("--listar")) {
  console.log(Object.keys(vars).join("\n"));
  process.exit(0);
}
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
for (const [nome, valor] of Object.entries(vars)) {
  for (const ambiente of ["production", "preview"]) {
    // Valor pela entrada padrão: não aparece na linha de comando nem passa pelo shell (no cmd, "%" seria expandido).
    execFileSync(npx, ["vercel", "env", "add", nome, ambiente, "--force", "--yes"], { input: valor, stdio: ["pipe", "ignore", "inherit"], shell: process.platform === "win32" });
  }
  console.log(`✓ ${nome}`);
}
console.log("Variáveis enviadas. Rode `npx vercel --prod` para publicar.");
