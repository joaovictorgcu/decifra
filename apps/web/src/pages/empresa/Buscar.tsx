import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useBuscaCandidatos } from "../../api/consultas";
import { Cabecalho, Esqueleto, Etiqueta, Falha, Vazio } from "../../components/ui";
import { mai } from "../../lib/formato";

export function BuscarCandidatos() {
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");
  const q = useBuscaCandidatos(busca);

  function enviar(e: FormEvent) {
    e.preventDefault();
    setBusca(termo.trim());
  }

  return (
    <>
      <Cabecalho titulo="Buscar candidatos" sub="Encontre pessoas pelas competências comprovadas, e não pelo cargo anterior." />
      <form className="linha" role="search" onSubmit={enviar}>
        <div className="campo" style={{ flex: "1 1 240px" }}>
          <label htmlFor="busca">Competência</label>
          <input type="search" id="busca" placeholder="Ex.: SQL, Figma, Power BI" value={termo} onChange={(e) => setTermo(e.target.value)} maxLength={80} />
        </div>
        <button type="submit" className="botao primario" style={{ alignSelf: "end" }}>
          Buscar
        </button>
      </form>
      {q.isLoading && <Esqueleto linhas={2} />}
      {q.isError && <Falha erro={q.error} tentar={() => q.refetch()} />}
      {q.data && (
        <p className="apoio" role="status">
          {q.data.length} pessoa(s){busca ? ` com “${busca}” comprovada` : ""}. Só aparecem perfis que os próprios candidatos publicaram.
        </p>
      )}
      {q.data && !q.data.length && (
        <Vazio titulo="Ninguém encontrado">{busca ? "Tente outra competência ou um termo mais curto." : "Ainda não há perfis públicos com competências comprovadas."}</Vazio>
      )}
      <div className="pilha">
        {q.data?.map((x) => (
          <article className="cartao" key={x.slug}>
            <h2>{x.nome}</h2>
            {x.area && <p className="apoio">Em transição para {x.area}</p>}
            <div className="linha">
              {x.competencias.map((k) => (
                <Etiqueta key={k.nome} rotulo={`${mai(k.nome)} · ${k.evidencias} ${k.evidencias > 1 ? "evidências" : "evidência"}`} icone="✓" cor="agua" />
              ))}
            </div>
            <div>
              <Link className="botao peq" to={`/p/${x.slug}`} aria-label={`Ver evidências de ${x.nome}`}>
                Ver evidências
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
