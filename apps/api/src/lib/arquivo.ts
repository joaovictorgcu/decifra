import type { FastifyRequest } from "fastify";
import { extractText, getDocumentProxy } from "unpdf";
import { ErroApp } from "./erros";

export const LIMITE_TEXTO = 60000;
const MAX_PAGINAS = 30;

/**
 * Lê um único arquivo enviado (PDF ou texto) e devolve o texto.
 * O tipo é conferido pelo conteúdo (assinatura %PDF), não só pela extensão.
 */
export async function lerTextoEnviado(req: FastifyRequest): Promise<{ nome: string; texto: string }> {
  if (!req.isMultipart()) throw new ErroApp(400, "arquivo", "Envie um arquivo PDF ou TXT.");
  const arq = await req.file();
  if (!arq) throw new ErroApp(400, "arquivo", "Envie um arquivo PDF ou TXT.");
  const buf = await arq.toBuffer();
  if (arq.file.truncated) throw new ErroApp(413, "arquivo_grande", `Arquivo maior que ${Math.floor(req.server.ctx.env.uploadMaxBytes / 1048576)} MB.`);
  const nome = arq.filename.slice(0, 120);
  let texto: string;

  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      if (pdf.numPages > MAX_PAGINAS) throw new ErroApp(413, "pdf_grande", `Envie um PDF de até ${MAX_PAGINAS} páginas.`);
      const r = await extractText(pdf, { mergePages: true });
      texto = Array.isArray(r.text) ? r.text.join("\n") : r.text;
    } catch (e) {
      if (e instanceof ErroApp) throw e;
      throw new ErroApp(422, "pdf_invalido", "Não consegui ler este PDF. Tente exportar de novo ou envie em TXT.");
    }
  } else if (/\.(txt|md)$/i.test(nome) || arq.mimetype.startsWith("text/")) {
    texto = buf.toString("utf8");
    if (texto.includes("\u0000")) throw new ErroApp(415, "tipo_arquivo", "Use um arquivo PDF ou TXT.");
  } else {
    throw new ErroApp(415, "tipo_arquivo", "Use um arquivo PDF ou TXT.");
  }

  texto = texto.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (texto.length < 30) {
    throw new ErroApp(422, "sem_texto", "Não encontrei texto neste arquivo. Se for um PDF escaneado, cole o conteúdo como texto.");
  }
  return { nome, texto: texto.slice(0, LIMITE_TEXTO) };
}
