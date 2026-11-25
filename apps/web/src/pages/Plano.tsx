import { STATUS_TAREFA, type Tarefa } from "@decifra/shared";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/cliente";
import { useAcao, useSugestoes, useTarefas } from "../api/consultas";
import { Confirmar } from "../components/Confirmar";
import { Botao, Cabecalho, Campo, Esqueleto, Falha, Vazio } from "../components/ui";
import { avisar } from "../lib/avisos";
import { hojeISO } from "../lib/formato";

export function Plano() {
  const q = useTarefas();
  const sug = useSugestoes();
  const nav = useNavigate();
  const [remover, setRemover] = useState<Tarefa | null>(null);
  const atualizar = useAcao((d: { id: string; status?: string; prazo?: string }) =>
    api.patch<{ tarefa: Tarefa; evidenciaCriadaId: string | null }>(`/tarefas/${d.id}`, { status: d.status, prazo: d.prazo }),
  );
  const addMini = useAcao((c: string) => api.post("/tarefas/mini", { competencia: c }));
  const apagar = useAcao((id: string) => api.del(`/tarefas/${id}`));
  const hoje = hojeISO();

  function mudar(t: Tarefa, d: { status?: string; prazo?: string }) {
    atualizar.mutate(
      { id: t.id, ...d },
      {
        onSuccess: (r) => {
          if (r.evidenciaCriadaId) {
            avisar("Mini-projeto virou evidência. Complete a documentação.");
            nav(`/evidencias/${r.evidenciaCriadaId}`);
          } else avisar(d.status ? "Status atualizado" : "Prazo atualizado");
        },
        onError: (e) => avisar(e.message, "erro"),
      },
    );
  }

  return (
    <>
      <Cabecalho titulo="Plano de Evidências" sub="As ações dos seus Raio-X viram tarefas com prazo. Mini-projetos concluídos viram evidências." selo="Prova, não palavra-chave" />
      {q.isLoading && <Esqueleto />}
      {q.isError && <Falha erro={q.error} tentar={() => q.refetch()} />}
      {q.data && !q.data.length && (
        <Vazio titulo="Nenhuma tarefa ainda" acao={<Link className="link" to="/raio-x">Fazer um Raio-X</Link>}>
          Faça um Raio-X e leve as ações para cá. Cada ação vira uma tarefa com prazo.
        </Vazio>
      )}
      {!!q.data?.length && (
        <ul className="pilha">
          {q.data.map((t) => {
            const atrasada = t.status !== "feito" && t.prazo < hoje;
            return (
              <li className="cartao" key={t.id}>
                <p>
                  <strong>{t.titulo}</strong>
                </p>
                <p className="apoio">
                  {t.vagaTitulo ? `${t.vagaTitulo} · ` : ""}
                  {t.tipo === "mini" ? "Mini-projeto de até 1 semana" : "Ação do Raio-X"}
                  {atrasada && <strong style={{ color: "var(--ambar-texto)" }}> · Prazo vencido</strong>}
                </p>
                <div className="grade2">
                  <Campo id={`st-${t.id}`} rotulo="Status">
                    <select id={`st-${t.id}`} value={t.status} disabled={atualizar.isPending && atualizar.variables?.id === t.id} onChange={(e) => mudar(t, { status: e.target.value })}>
                      {STATUS_TAREFA.map(([v, r]) => (
                        <option key={v} value={v}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo id={`pz-${t.id}`} rotulo="Prazo">
                    <input type="date" id={`pz-${t.id}`} defaultValue={t.prazo} onBlur={(e) => e.target.value && e.target.value !== t.prazo && mudar(t, { prazo: e.target.value })} />
                  </Campo>
                </div>
                <div className="linha">
                  {t.tipo === "doc" && t.evId && (
                    <Link className="link" to={`/evidencias/${t.evId}`}>
                      Documentar a evidência
                    </Link>
                  )}
                  <button type="button" className="link perigo" onClick={() => setRemover(t)} aria-label={`Remover tarefa: ${t.titulo}`}>
                    Remover
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!!sug.data?.length && (
        <section className="pilha">
          <h2>Mini-projetos sugeridos para suas lacunas</h2>
          <ul className="lista-d">
            {sug.data.map((i) => (
              <li key={i.competencia}>
                <div>
                  {i.texto} <span className="apoio">Aparece em {i.vagas} vaga(s).</span>
                </div>
                <Botao
                  className="botao peq"
                  carregando={addMini.isPending && addMini.variables === i.competencia}
                  onClick={() => addMini.mutate(i.competencia, { onSuccess: () => avisar("Mini-projeto no Plano"), onError: (e) => avisar(e.message, "erro") })}
                >
                  Adicionar ao Plano
                </Botao>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Confirmar
        aberto={!!remover}
        titulo="Remover esta tarefa?"
        confirmar="Remover"
        carregando={apagar.isPending}
        aoFechar={() => setRemover(null)}
        aoConfirmar={() =>
          remover &&
          apagar.mutate(remover.id, {
            onSuccess: () => {
              setRemover(null);
              avisar("Tarefa removida");
            },
          })
        }
      >
        <p>{remover?.titulo}</p>
      </Confirmar>
    </>
  );
}
