import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** Hash de senha com scrypt (nativo do Node, sem dependências nativas). Formato: scrypt$N$r$p$sal$hash */
const N = 16384;
const R = 8;
const P = 1;
const TAM = 64;

function scrypt(senha: string, sal: Buffer, opcoes: ScryptOptions): Promise<Buffer> {
  return new Promise((ok, falha) => scryptCb(senha, sal, TAM, opcoes, (e, k) => (e ? falha(e) : ok(k))));
}

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const k = await scrypt(senha.normalize("NFKC"), sal, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64")}$${k.toString("base64")}`;
}

export async function conferirSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, salB64, hashB64] = partes as [string, string, string, string, string, string];
  const esperado = Buffer.from(hashB64, "base64");
  const k = await scrypt(senha.normalize("NFKC"), Buffer.from(salB64, "base64"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return k.length === esperado.length && timingSafeEqual(k, esperado);
}

/** Hash fixo usado para igualar o tempo de resposta quando o e-mail não existe. */
export const HASH_FICTICIO = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");
