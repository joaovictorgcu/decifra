import { Link } from "react-router-dom";
import { useRadar } from "../api/consultas";
import { Cabecalho, Esqueleto, EtqSituacao, Falha, Trava, Vazio } from "../components/ui";
import { mai } from "../lib/formato";
import { useSessaoAtiva } from "../lib/sessao";
import { ListaVagas } from "./RaioX";

export function Radar() {
  const s = useSessaoAtiva();
  const plus = s.usuario.plano === "plus";
  const q = useRadar(plus);
  if (!plus)
    return (
      <>
        <Cabecalho titulo="Radar de Vagas" />
        <Trava recurso="O Radar de Vagas" />
      </>
    );
  const r = q.data;
  return (
    <>
      <Cabecalho titulo="Radar de Vagas" sub="Veja o que se repete nas vagas que você quer e o que resolver primeiro." selo="Decisão, não nota" />
      {q.isLoading && <Esqueleto />}
      {q.isError && <Falha erro={q.error} tentar={() => q.refetch()} />}
      {r && !r.totalVagas && (
        <Vazio titulo="Seu radar está vazio" acao={<Link className="link" to="/raio-x">Fazer um Raio-X</Link>}>
          O radar cruza os requisitos de todas as vagas que você analisou. Faça o Raio-X de pelo menos duas vagas que você quer para ver o que se repete.
        </Vazio>
      )}
      {r && r.prioridade && (
        <section className="foco escuro">
          <p className="olho">Resolva primeiro</p>
          <h2>{mai(r.prioridade.curto)}</h2>
          <p>
            Aparece em {r.prioridade.vagas} de {r.totalVagas} vagas salvas
            {r.prioridade.ganho ? ` e melhora sua situação em ${r.prioridade.ganho} delas` : ""}.
          </p>
          <Link className="botao primario" to="/plano">
            Ver mini-projetos no Plano
          </Link>
        </section>
      )}
      {r && r.itens.length > 0 && (
        <section className="pilha">
          <h2>Requisitos que se repetem</h2>
          <div className="caixa-tab">
            <table>
              <thead>
                <tr>
                  <th scope="col">Requisito</th>
                  <th scope="col">Vagas</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {r.itens.map((i) => (
                  <tr key={i.curto}>
                    <td className="req" data-r="Requisito">
                      {mai(i.curto)}
                    </td>
                    <td data-r="Vagas">
                      {i.vagas} de {r.totalVagas}
                      <span className="nota">{i.nomes.join(", ")}</span>
                    </td>
                    <td data-r="Situação">
                      <EtqSituacao s={i.situacao} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="pilha">
        <h2>Vagas salvas</h2>
        <ListaVagas />
      </section>
    </>
  );
}
