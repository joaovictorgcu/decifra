import type { EvidenciaInput } from "@decifra/shared";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/cliente";
import { useAcao } from "../api/consultas";
import { Botao, Cabecalho, Carregando, ErroForm, Vazio } from "../components/ui";
import { avisar } from "../lib/avisos";
import { useSessaoAtiva } from "../lib/sessao";
import { CamposEvidencia } from "./EvidenciaForm";

/** Importação assistida por IA: o currículo vira rascunhos de evidências que a pessoa revisa antes de salvar. */
export function Importar() {
  const s = useSessaoAtiva();
  const nav = useNavigate();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [rascunhos, setRascunhos] = useState<(EvidenciaInput & { marcado: boolean })[] | null>(null);
  const analisar = useAcao((f: File) => api.enviarArquivo<{ arquivo: string; rascunhos: EvidenciaInput[] }>("/evidencias/importar/analisar", f));
  const salvar = useAcao((evs: EvidenciaInput[]) => api.post<{ itens: unknown[] }>("/evidencias/importar", { evidencias: evs }));

  if (!s.ia.ativa) {
    return (
      <>
        <Cabecalho titulo="Importar do currículo" selo="Prova, não palavra-chave" />
        <Vazio titulo="Importação indisponível neste ambiente" acao={<Link className="link" to="/evidencias/nova">Registrar uma evidência manualmente</Link>}>
          A leitura do currículo usa IA, que não está configurada aqui. Você pode registrar suas evidências manualmente.
        </Vazio>
      </>
    );
  }

  function escolher(f: File | undefined) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      avisar("Arquivo maior que 5 MB.", "erro");
      return;
    }
    setArquivo(f);
    setRascunhos(null);
  }

  const marcados = rascunhos?.filter((r) => r.marcado) ?? [];
  return (
    <>
      <Cabecalho
        titulo="Importar do currículo"
        sub="Envie seu currículo, o PDF do seu LinkedIn ou um documento com seus projetos. A IA sugere evidências usando só o que está escrito, e você revisa antes de salvar."
        selo="Prova, não palavra-chave"
      />
      {!rascunhos && (
        <div
          className={`envio ${arrastando ? "ativo" : ""}`}
          onDragOver={(e) => (e.preventDefault(), setArrastando(true))}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            escolher(e.dataTransfer.files[0]);
          }}
        >
          <label htmlFor="cv" style={{ fontWeight: 600, color: "var(--marinho)" }}>
            Arquivo PDF ou TXT, até 5 MB
          </label>
          <input id="cv" type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(e) => escolher(e.target.files?.[0])} />
          <p className="apoio">O arquivo é lido e descartado. Só ficam salvas as evidências que você escolher.</p>
          <ErroForm erro={analisar.error} />
          <div className="linha">
            <Botao
              className="botao primario"
              disabled={!arquivo}
              carregando={analisar.isPending}
              onClick={() =>
                arquivo &&
                analisar.mutate(arquivo, {
                  onSuccess: (r) => {
                    setRascunhos(r.rascunhos.map((x) => ({ ...x, marcado: true })));
                    if (!r.rascunhos.length) avisar("Não encontrei evidências no documento.", "erro");
                  },
                })
              }
            >
              Analisar documento
            </Botao>
            <Link className="botao" to="/evidencias">
              Cancelar
            </Link>
          </div>
        </div>
      )}
      {analisar.isPending && <Carregando texto="Lendo o documento e montando os rascunhos… Pode levar alguns segundos." />}
      {rascunhos && (
        <section className="pilha">
          <h2>
            {rascunhos.length} {rascunhos.length === 1 ? "sugestão" : "sugestões"} de evidência
          </h2>
          <p className="apoio leitura">Desmarque o que não quiser e ajuste o texto. Campos vazios indicam algo que o documento não diz: complete depois, com o que você consegue demonstrar.</p>
          {rascunhos.map((r, i) => (
            <article className="cartao rascunho" key={i}>
              <input
                type="checkbox"
                aria-label={`Importar ${r.titulo}`}
                checked={r.marcado}
                onChange={(e) => setRascunhos(rascunhos.map((x, j) => (j === i ? { ...x, marcado: e.target.checked } : x)))}
              />
              <details open={i === 0}>
                <summary>
                  {r.titulo} <span className="apoio">&nbsp;· {r.tipo}</span>
                </summary>
                <div className="pilha" style={{ paddingTop: 10 }}>
                  <CamposEvidencia prefixo={`r${i}-`} v={r} set={(nv) => setRascunhos(rascunhos.map((x, j) => (j === i ? { ...x, ...nv } : x)))} />
                </div>
              </details>
            </article>
          ))}
          <ErroForm erro={salvar.error} />
          <div className="linha">
            <Botao
              className="botao primario"
              disabled={!marcados.length}
              carregando={salvar.isPending}
              onClick={() =>
                salvar.mutate(
                  marcados.map(({ marcado: _m, ...e }) => e),
                  {
                    onSuccess: (r) => {
                      avisar(`${r.itens.length} evidência(s) importada(s)`);
                      nav("/evidencias");
                    },
                  },
                )
              }
            >
              Salvar {marcados.length} evidência(s)
            </Botao>
            <button type="button" className="botao" onClick={() => setRascunhos(null)}>
              Escolher outro arquivo
            </button>
          </div>
        </section>
      )}
    </>
  );
}
