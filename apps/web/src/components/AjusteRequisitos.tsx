import { KINDS_FORMAL, TIPOS_REQUISITO, type KindFormal, type RequisitoAvaliado, type TipoRequisito, type VagaDetalhe } from "@decifra/shared";
import { useState, type FormEvent } from "react";
import { api } from "../api/cliente";
import { useAcao } from "../api/consultas";
import { avisar } from "../lib/avisos";
import { Botao, CampoSelecao, CampoTexto, ErroForm, erroDoCampo } from "./ui";

const KINDS: Record<KindFormal, string> = { tempo: "Tempo de experiência", diploma: "Diploma ou formação", certificacao: "Certificação obrigatória" };

/**
 * Correção manual dos requisitos de um Raio-X: a leitura (por IA ou regras)
 * pode errar o peso, incluir algo indevido ou deixar algo de fora.
 * A decisão é recalculada pelo motor de regras a cada mudança.
 */
export function AjusteRequisitos({ vaga, aoFechar }: { vaga: VagaDetalhe; aoFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoRequisito>("tecnica");
  const [kind, setKind] = useState<KindFormal>("tempo");
  const [obrig, setObrig] = useState(true);
  const peso = useAcao((d: { req: RequisitoAvaliado; obrig: boolean }) => api.patch<VagaDetalhe>(`/vagas/${vaga.id}/requisitos/${d.req.id}`, { obrig: d.obrig }));
  const remover = useAcao((r: RequisitoAvaliado) => api.del<VagaDetalhe>(`/vagas/${vaga.id}/requisitos/${r.id}`));
  const adicionar = useAcao((d: { nome: string; tipo: TipoRequisito; kind?: KindFormal; obrig: boolean }) => api.post<VagaDetalhe>(`/vagas/${vaga.id}/requisitos`, d));

  function enviar(e: FormEvent) {
    e.preventDefault();
    adicionar.mutate(
      { nome, tipo, kind: tipo === "formal" ? kind : undefined, obrig },
      {
        onSuccess: () => {
          setNome("");
          avisar("Requisito adicionado. Decisão recalculada.");
        },
      },
    );
  }

  return (
    <section className="cartao" aria-labelledby="ajuste-titulo">
      <div className="linha entre">
        <h2 id="ajuste-titulo">Ajustar requisitos</h2>
        <button type="button" className="botao peq" onClick={aoFechar}>
          Concluir
        </button>
      </div>
      <p className="apoio leitura">Corrija o que a leitura da vaga errou. A decisão é recalculada na hora, sempre pelas regras da DECIFRA.</p>
      <ul className="lista-d">
        {vaga.raio.reqs.map((r) => (
          <li key={r.id}>
            <div>
              <strong>{r.requisito}</strong>
              <br />
              <span className="apoio">{TIPOS_REQUISITO[r.tipo]}</span>
            </div>
            <div className="linha">
              <label className="so-leitor" htmlFor={`peso-${r.id}`}>
                Peso de {r.requisito}
              </label>
              <select
                id={`peso-${r.id}`}
                value={r.obrig ? "1" : "0"}
                style={{ width: "auto" }}
                disabled={peso.isPending && peso.variables?.req.id === r.id}
                onChange={(e) => peso.mutate({ req: r, obrig: e.target.value === "1" }, { onError: (x) => avisar(x.message, "erro") })}
              >
                <option value="1">Obrigatório</option>
                <option value="0">Desejável</option>
              </select>
              <Botao
                className="botao peq perigo"
                aria-label={`Remover ${r.requisito}`}
                carregando={remover.isPending && remover.variables?.id === r.id}
                onClick={() => remover.mutate(r, { onSuccess: () => avisar("Requisito removido"), onError: (x) => avisar(x.message, "erro") })}
              >
                Remover
              </Botao>
            </div>
          </li>
        ))}
      </ul>
      <form className="pilha" onSubmit={enviar} noValidate>
        <h3>Adicionar um requisito que ficou de fora</h3>
        <div className="grade2">
          <CampoTexto id="novo-req" rotulo="Requisito" placeholder="Ex.: Python" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} erro={erroDoCampo(adicionar.error, "nome")} />
          <CampoSelecao
            id="novo-tipo"
            rotulo="Tipo"
            opcoes={Object.entries(TIPOS_REQUISITO) as [string, string][]}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoRequisito)}
          />
          {tipo === "formal" && (
            <CampoSelecao
              id="novo-kind"
              rotulo="Exigência formal de"
              opcoes={KINDS_FORMAL.map((k) => [k, KINDS[k]] as const)}
              value={kind}
              onChange={(e) => setKind(e.target.value as KindFormal)}
              erro={erroDoCampo(adicionar.error, "kind")}
            />
          )}
          <CampoSelecao id="novo-peso" rotulo="Peso na vaga" opcoes={[["1", "Obrigatório"], ["0", "Desejável"]]} value={obrig ? "1" : "0"} onChange={(e) => setObrig(e.target.value === "1")} />
        </div>
        {!erroDoCampo(adicionar.error, "nome") && !erroDoCampo(adicionar.error, "kind") && <ErroForm erro={adicionar.error} />}
        <div className="linha">
          <Botao type="submit" className="botao peq" carregando={adicionar.isPending}>
            Adicionar requisito
          </Botao>
        </div>
      </form>
    </section>
  );
}
