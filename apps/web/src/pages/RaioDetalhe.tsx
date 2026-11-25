import { DECISOES, TIPOS_REQUISITO } from "@decifra/shared";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/cliente";
import { useAcao, useVaga } from "../api/consultas";
import { Confirmar } from "../components/Confirmar";
import { Botao, Cabecalho, Carregando, EtqSituacao, Falha, OrigemResultado } from "../components/ui";
import { avisar } from "../lib/avisos";

export function RaioDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const q = useVaga(id);
  const [excluir, setExcluir] = useState(false);
  const aoPlano = useAcao(() => api.post<{ adicionadas: number }>(`/vagas/${id}/plano`));
  const candidatar = useAcao(() => api.post("/candidaturas", { vagaId: id }));
  const apagar = useAcao(() => api.del(`/vagas/${id}`));

  if (q.isLoading) return <Carregando texto="Carregando o Raio-X…" />;
  if (q.isError || !q.data)
    return (
      <>
        <Cabecalho titulo="Raio-X da Vaga" />
        <Falha erro={q.error} />
        <Link className="link" to="/raio-x">
          Voltar ao Raio-X
        </Link>
      </>
    );

  const v = q.data;
  const R = v.raio;
  const D = DECISOES[R.decisao];
  return (
    <>
      <Cabecalho titulo={v.titulo} selo={v.empresa ? `${v.empresa} · Decisão, não nota` : "Decisão, não nota"} />
      <section className="decisao escuro" aria-label="Decisão">
        <p className="olho">Decisão</p>
        <p className={`selo ${D.cor}`}>
          <span aria-hidden="true">{D.icone} </span>
          {D.rotulo}
        </p>
        {R.justificativa.map((f) => (
          <p className="leitura" key={f}>
            {f}
          </p>
        ))}
        <OrigemResultado fonte={v.fonte} ia={v.ia} />
      </section>
      <section className="pilha">
        <h2>Requisitos da vaga</h2>
        <div className="caixa-tab">
          <table>
            <thead>
              <tr>
                <th scope="col">Requisito</th>
                <th scope="col">Tipo</th>
                <th scope="col">Situação</th>
                <th scope="col">Evidência</th>
              </tr>
            </thead>
            <tbody>
              {R.reqs.map((r) => (
                <tr key={r.id}>
                  <td className="req" data-r="Requisito">
                    {r.requisito}
                  </td>
                  <td data-r="Tipo">
                    {TIPOS_REQUISITO[r.tipo]}
                    <span className="nota">{r.obrig ? "Obrigatório" : "Desejável"}</span>
                  </td>
                  <td data-r="Situação">
                    <EtqSituacao s={r.situacao} />
                    {r.nota && <span className="nota">{r.nota}</span>}
                  </td>
                  <td data-r="Evidência">
                    {r.evidenciaId ? <Link to={`/evidencias/${r.evidenciaId}`}>{r.evidencia}</Link> : r.evidencia}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="pilha">
        <h2>Seus próximos passos</h2>
        <ol className="passos">
          {R.acoes.map((a) => (
            <li key={a.texto}>
              <span>{a.texto}</span>
            </li>
          ))}
        </ol>
      </section>
      <div className="linha">
        <Botao
          className="botao primario"
          carregando={aoPlano.isPending}
          onClick={() =>
            aoPlano.mutate(undefined, {
              onSuccess: (r) => avisar(r.adicionadas ? `${r.adicionadas} ação(ões) no Plano` : "As ações já estavam no Plano"),
              onError: (e) => avisar(e.message, "erro"),
            })
          }
        >
          {v.noPlano ? "Atualizar o Plano" : "Levar ações para o Plano"}
        </Botao>
        {v.candidaturaId ? (
          <Link className="botao" to="/candidaturas">
            Ver candidatura
          </Link>
        ) : (
          <Botao
            carregando={candidatar.isPending}
            onClick={() => candidatar.mutate(undefined, { onSuccess: () => avisar("Candidatura registrada"), onError: (e) => avisar(e.message, "erro") })}
          >
            Registrar candidatura
          </Botao>
        )}
        <Link className="botao" to="/raio-x">
          Analisar outra vaga
        </Link>
        <Link className="botao" to={`/mentor?vaga=${v.id}`}>
          Perguntar ao Mentor
        </Link>
      </div>
      <details>
        <summary>Ver a descrição original da vaga</summary>
        <p className="pre">{v.texto}</p>
      </details>
      <p>
        <button type="button" className="link perigo" onClick={() => setExcluir(true)}>
          Excluir esta vaga
        </button>
      </p>
      <Confirmar
        aberto={excluir}
        titulo="Excluir esta vaga?"
        carregando={apagar.isPending}
        aoFechar={() => setExcluir(false)}
        aoConfirmar={() =>
          apagar.mutate(undefined, {
            onSuccess: () => {
              avisar("Vaga excluída");
              nav("/raio-x");
            },
            onError: (e) => avisar(e.message, "erro"),
          })
        }
      >
        <p>O Raio-X e a candidatura desta vaga serão apagados. As tarefas do Plano continuam.</p>
      </Confirmar>
    </>
  );
}
