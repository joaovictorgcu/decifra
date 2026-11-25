import type { PerfilPublico } from "@decifra/shared";
import { Link, useParams } from "react-router-dom";
import { usePerfilPublico } from "../api/consultas";
import { Carregando, Etiqueta, Marca } from "../components/ui";
import { mai } from "../lib/formato";
import { useSessao } from "../lib/sessao";

export function BlocoCompetencias({ perfil }: { perfil: PerfilPublico }) {
  if (!perfil.competencias.length) return <p className="apoio">Ainda não há competências registradas.</p>;
  return (
    <div className="pilha">
      {perfil.competencias.map((k) => (
        <section className="cartao" key={k.competencia}>
          <div className="linha entre">
            <h2>{mai(k.competencia)}</h2>
            <Etiqueta {...(k.comprovada ? { rotulo: "Comprovada", icone: "✓", cor: "agua" } : { rotulo: "Em documentação", icone: "!", cor: "ambar" })} />
          </div>
          <ul>
            {k.evidencias.map((e) => (
              <li className="pilha" style={{ gap: 2, paddingTop: 8 }} key={e.id}>
                <strong>{e.titulo}</strong>
                <span className="apoio">{e.tipo}</span>
                {e.problema && <span>Problema: {e.problema}</span>}
                {e.fez && <span>O que fez: {e.fez}</span>}
                {e.resultado && <span>Resultado: {e.resultado}</span>}
                {e.link && (
                  <a href={e.link} target="_blank" rel="noopener noreferrer nofollow">
                    Ver evidência<span className="so-leitor"> (abre em nova aba)</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function PerfilPublicoPagina() {
  const { slug } = useParams();
  const { sessao } = useSessao();
  const q = usePerfilPublico(slug);
  const voltar = sessao ? (sessao.usuario.papel === "empresa" ? "/empresa/candidatos" : "/perfil") : null;
  return (
    <>
      <div className="faixa escuro">
        <div className="miolo topo-l">
          <Marca />
          {voltar && (
            <Link className="botao claro peq" to={voltar}>
              Voltar
            </Link>
          )}
        </div>
      </div>
      <main className="faixa">
        <div className="perfil-pub">
          {q.isLoading && <Carregando />}
          {q.isError && (
            <header className="cab">
              <h1 tabIndex={-1}>Perfil não encontrado</h1>
              <p className="apoio">O link pode estar errado ou a pessoa deixou o perfil privado.</p>
            </header>
          )}
          {q.data && (
            <>
              {!q.data.publico && (
                <p className="alerta" role="status">
                  <strong>Pré-visualização.</strong> Seu perfil está privado: só você vê esta página.
                </p>
              )}
              <header className="cab">
                <p className="selo-pos">Perfil de Evidências</p>
                <h1 tabIndex={-1}>{q.data.nome}</h1>
                {q.data.area && <p className="apoio">Em transição para {q.data.area}</p>}
              </header>
              <BlocoCompetencias perfil={q.data} />
            </>
          )}
        </div>
      </main>
    </>
  );
}
