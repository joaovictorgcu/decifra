import { TRIAGENS, type Triagem } from "@decifra/shared";
import type { Desafio } from "@decifra/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/cliente";
import { useAcao, useDesafiosEmpresa } from "../../api/consultas";
import { Confirmar } from "../../components/Confirmar";
import { Botao, Cabecalho, Campo, CampoArea, CampoTexto, ErroForm, Esqueleto, Falha, Vazio, erroDoCampo } from "../../components/ui";
import { avisar } from "../../lib/avisos";
import { dataBR, hojeISO, somarDias } from "../../lib/formato";

const VAZIO = { titulo: "", vaga: "", competencia: "", descricao: "", prazo: somarDias(14) };

export function DesafiosEmpresa() {
  const q = useDesafiosEmpresa();
  const [f, setF] = useState(VAZIO);
  const criar = useAcao((d: typeof VAZIO) => api.post("/empresa/desafios", d));
  const [alvo, setAlvo] = useState<Desafio | null>(null);
  const apagar = useAcao((id: string) => api.del(`/empresa/desafios/${id}`));
  const triar = useAcao((d: { id: string; triagem: Triagem }) => api.patch(`/empresa/entregas/${d.id}`, { triagem: d.triagem }));

  function enviar(e: FormEvent) {
    e.preventDefault();
    criar.mutate(f, { onSuccess: () => (setF({ ...VAZIO, prazo: somarDias(14) }), avisar("Desafio publicado")) });
  }
  const erroCampo = ["titulo", "descricao", "prazo"].some((c) => erroDoCampo(criar.error, c));

  return (
    <>
      <Cabecalho titulo="Desafios práticos" sub="Publique um desafio ligado a uma vaga. As entregas viram evidências para o candidato e triagem para você." />
      <form className="pilha" onSubmit={enviar} noValidate>
        <CampoTexto id="titulo" rotulo="Título do desafio" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={140} erro={erroDoCampo(criar.error, "titulo")} />
        <CampoTexto id="vaga" rotulo="Vaga relacionada" value={f.vaga} onChange={(e) => setF({ ...f, vaga: e.target.value })} maxLength={140} />
        <CampoTexto id="competencia" rotulo="Competência avaliada" ajuda="Vira a competência da evidência do candidato. Ex.: Power BI." value={f.competencia} onChange={(e) => setF({ ...f, competencia: e.target.value })} maxLength={80} />
        <CampoArea id="descricao" rotulo="O que a pessoa deve entregar" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} maxLength={3000} erro={erroDoCampo(criar.error, "descricao")} />
        <Campo id="prazo" rotulo="Prazo" erro={erroDoCampo(criar.error, "prazo")}>
          <input type="date" id="prazo" min={hojeISO()} value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} />
        </Campo>
        {!erroCampo && <ErroForm erro={criar.error} />}
        <div className="linha">
          <Botao type="submit" className="botao primario" carregando={criar.isPending}>
            Publicar desafio
          </Botao>
        </div>
      </form>
      <section className="pilha">
        <h2>Desafios publicados</h2>
        {q.isLoading && <Esqueleto linhas={2} />}
        {q.isError && <Falha erro={q.error} tentar={() => q.refetch()} />}
        {q.data && !q.data.length && <Vazio titulo="Nenhum desafio publicado">Publique um desafio para receber entregas de candidatos.</Vazio>}
        {q.data?.map((d) => (
          <article className="cartao" key={d.id}>
            <h3>{d.titulo}</h3>
            <p className="apoio">
              {d.vaga} · até {dataBR(d.prazo)}
              {d.prazo < hojeISO() && " · Encerrado"}
            </p>
            <p>{d.descricao}</p>
            <p>
              <strong>{d.entregas?.length ?? 0} entrega(s)</strong>
            </p>
            <div>
              <button type="button" className="link perigo" onClick={() => setAlvo(d)} aria-label={`Excluir desafio ${d.titulo}`}>
                Excluir desafio
              </button>
            </div>
            {!!d.entregas?.length && (
              <ul className="lista-d">
                {d.entregas.map((x) => (
                  <li key={x.id}>
                    <div>
                      <strong>{x.candidatoNome}</strong>
                      <br />
                      <a href={x.link} target="_blank" rel="noopener noreferrer nofollow">
                        Abrir entrega<span className="so-leitor"> de {x.candidatoNome} (abre em nova aba)</span>
                      </a>
                      {x.candidatoSlug && (
                        <>
                          {" · "}
                          <Link to={`/p/${x.candidatoSlug}`}>Ver evidências</Link>
                        </>
                      )}
                    </div>
                    <div className="campo" style={{ flex: "1 1 220px" }}>
                      <label htmlFor={`tr-${x.id}`}>Triagem</label>
                      <select
                        id={`tr-${x.id}`}
                        value={x.triagem}
                        onChange={(e) => triar.mutate({ id: x.id, triagem: e.target.value as Triagem }, { onSuccess: () => avisar("Triagem salva"), onError: (er) => avisar(er.message, "erro") })}
                      >
                        {TRIAGENS.map(([v, r]) => (
                          <option key={v} value={v}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>
      <Confirmar
        aberto={!!alvo}
        titulo={`Excluir “${alvo?.titulo ?? ""}”?`}
        carregando={apagar.isPending}
        aoFechar={() => setAlvo(null)}
        aoConfirmar={() => alvo && apagar.mutate(alvo.id, { onSuccess: () => (setAlvo(null), avisar("Desafio excluído")), onError: (e) => avisar(e.message, "erro") })}
      >
        <p>As entregas deixam de aparecer aqui. As evidências que os candidatos registraram continuam com eles.</p>
      </Confirmar>
    </>
  );
}
