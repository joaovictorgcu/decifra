import type { Evidencia } from "@decifra/shared";
import { useState, type FormEvent } from "react";
import { Link, NavLink } from "react-router-dom";
import { api } from "../api/cliente";
import { useAcao, useDesafiosAbertos, useEvidencias } from "../api/consultas";
import { Confirmar } from "../components/Confirmar";
import { Botao, Cabecalho, Esqueleto, Etiqueta, Falha, Vazio } from "../components/ui";
import { avisar } from "../lib/avisos";
import { dataBR, juntar } from "../lib/formato";

export function AbasEvidencias() {
  return (
    <nav className="abas" aria-label="Evidências">
      <NavLink className="aba" to="/evidencias" end>
        Banco de Evidências
      </NavLink>
      <NavLink className="aba" to="/tradutor">
        Tradutor de Experiência
      </NavLink>
    </nav>
  );
}

function CartaoEvidencia({ e, aoExcluir }: { e: Evidencia; aoExcluir: (e: Evidencia) => void }) {
  return (
    <article className="cartao">
      <div className="linha entre">
        <h2>{e.titulo}</h2>
        <span className="etq contorno">{e.tipo}</span>
      </div>
      <p>Comprova: {e.competencias.join(", ") || "nada indicado ainda"}</p>
      {e.faltas.length ? (
        <p className="apoio">
          <strong>Para ficar bem documentada, falta:</strong> {juntar(e.faltas)}.
        </p>
      ) : (
        <p>
          <Etiqueta rotulo="Bem documentada" icone="✓" cor="agua" />
        </p>
      )}
      {e.link && (
        <p>
          <a href={e.link} target="_blank" rel="noopener noreferrer nofollow">
            Abrir link<span className="so-leitor"> de {e.titulo} (abre em nova aba)</span>
          </a>
        </p>
      )}
      <div className="linha">
        <Link className="botao peq" to={`/evidencias/${e.id}`} aria-label={`Editar ${e.titulo}`}>
          Editar
        </Link>
        <button type="button" className="botao peq" onClick={() => aoExcluir(e)} aria-label={`Excluir ${e.titulo}`}>
          Excluir
        </button>
      </div>
    </article>
  );
}

function Desafios() {
  const q = useDesafiosAbertos();
  const [links, setLinks] = useState<Record<string, string>>({});
  const enviar = useAcao((d: { id: string; link: string }) => api.post(`/desafios/${d.id}/entregas`, { link: d.link }));
  const lista = q.data ?? [];
  if (!lista.length) return null;
  return (
    <section className="pilha">
      <h2>Desafios práticos</h2>
      <p className="apoio leitura">Desafios publicados por empresas. Sua entrega vira evidência e chega à empresa para triagem.</p>
      {lista.map((d) => {
        const sub = (ev: FormEvent) => {
          ev.preventDefault();
          enviar.mutate(
            { id: d.id, link: links[d.id] ?? "" },
            { onSuccess: () => avisar("Entrega enviada e registrada como evidência"), onError: (x) => avisar(x.message, "erro") },
          );
        };
        return (
          <form className="cartao" key={d.id} onSubmit={sub} noValidate>
            <h3>{d.titulo}</h3>
            <p className="apoio">
              {d.empresa} · {d.vaga} · até {dataBR(d.prazo)}
            </p>
            <p>{d.descricao}</p>
            {d.minhaEntrega ? (
              <p>
                <Etiqueta rotulo="Entrega enviada" icone="✓" cor="agua" />{" "}
                {d.minhaEntrega.triagem === "avancar" ? (
                  <strong>A empresa quer conversar com você.</strong>
                ) : d.minhaEntrega.triagem === "nao" ? (
                  <span className="apoio">A empresa não vai avançar agora.</span>
                ) : (
                  <span className="apoio">Aguardando avaliação da empresa.</span>
                )}
              </p>
            ) : (
              <>
                <div className="campo">
                  <label htmlFor={`l-${d.id}`}>Link da sua entrega</label>
                  <input type="url" id={`l-${d.id}`} placeholder="https://" value={links[d.id] ?? ""} onChange={(e) => setLinks({ ...links, [d.id]: e.target.value })} />
                </div>
                <div className="linha">
                  <Botao type="submit" className="botao peq" carregando={enviar.isPending && enviar.variables?.id === d.id}>
                    Enviar entrega
                  </Botao>
                </div>
              </>
            )}
          </form>
        );
      })}
    </section>
  );
}

export function Evidencias() {
  const q = useEvidencias();
  const [alvo, setAlvo] = useState<Evidencia | null>(null);
  const apagar = useAcao((id: string) => api.del(`/evidencias/${id}`));

  return (
    <>
      <Cabecalho titulo="Minhas Evidências" sub="Registre o que você consegue demonstrar. Cada evidência é usada em todos os Raio-X." selo="Prova, não palavra-chave" />
      <AbasEvidencias />
      <div className="linha">
        <Link className="botao primario" to="/evidencias/nova">
          Nova evidência
        </Link>
        <Link className="botao" to="/evidencias/importar">
          Importar do currículo
        </Link>
      </div>
      <div className="pilha">
        {q.isLoading && <Esqueleto />}
        {q.isError && <Falha erro={q.error} tentar={() => q.refetch()} />}
        {q.data && !q.data.length && (
          <Vazio titulo="Você ainda não registrou evidências" acao={<Link className="link" to="/evidencias/nova">Registrar a primeira</Link>}>
            Comece por um projeto, curso ou caso do trabalho atual. Se você já tem um currículo, importe e revise as sugestões.
          </Vazio>
        )}
        {q.data?.map((e) => <CartaoEvidencia key={e.id} e={e} aoExcluir={setAlvo} />)}
      </div>
      <Desafios />
      <Confirmar
        aberto={!!alvo}
        titulo={`Excluir “${alvo?.titulo ?? ""}”?`}
        carregando={apagar.isPending}
        aoFechar={() => setAlvo(null)}
        aoConfirmar={() =>
          alvo &&
          apagar.mutate(alvo.id, {
            onSuccess: () => {
              avisar("Evidência excluída");
              setAlvo(null);
            },
            onError: (x) => avisar(x.message, "erro"),
          })
        }
      >
        <p>Os Raio-X que usavam esta evidência serão recalculados.</p>
      </Confirmar>
    </>
  );
}
