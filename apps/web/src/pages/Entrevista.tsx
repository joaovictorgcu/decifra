import { PERGUNTAS_ENTREVISTA, type Feedback, type Historia } from "@decifra/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/cliente";
import { useAcao, useEvidencias, useHistorias } from "../api/consultas";
import { Botao, Cabecalho, CampoArea, CampoSelecao, Carregando, ErroForm, OrigemResultado, Trava, Vazio, erroDoCampo } from "../components/ui";
import { avisar } from "../lib/avisos";
import { useSessaoAtiva } from "../lib/sessao";

const PERGS = PERGUNTAS_ENTREVISTA.map((p) => [p, p] as const);

export function Entrevista() {
  const s = useSessaoAtiva();
  const plus = s.usuario.plano === "plus";
  const evs = useEvidencias();
  const hs = useHistorias(plus);
  const [pergunta, setPergunta] = useState<string>(PERGUNTAS_ENTREVISTA[0]);
  const [evid, setEvid] = useState("");
  const [ptreino, setPtreino] = useState<string>(PERGUNTAS_ENTREVISTA[0]);
  const [resp, setResp] = useState("");
  const criar = useAcao((d: { pergunta: string; evidenciaId: string }) => api.post<Historia>("/historias", d));
  const remover = useAcao((id: string) => api.del(`/historias/${id}`));
  const feedback = useAcao((d: { pergunta: string; resposta: string }) => api.post<Feedback>("/entrevista/feedback", d));

  if (!plus)
    return (
      <>
        <Cabecalho titulo="Preparação para Entrevista" />
        <Trava recurso="A Preparação para Entrevista" />
      </>
    );

  const lista = evs.data ?? [];
  const evSel = evid || lista[0]?.id || "";

  function gerar(e: FormEvent) {
    e.preventDefault();
    criar.mutate({ pergunta, evidenciaId: evSel }, { onSuccess: () => avisar("História criada") });
  }
  function treinar(e: FormEvent) {
    e.preventDefault();
    feedback.mutate({ pergunta: ptreino, resposta: resp });
  }

  return (
    <>
      <Cabecalho
        titulo="Preparação para Entrevista"
        sub="Monte histórias a partir das suas evidências e treine as respostas. Nada é inventado: o que faltar fica marcado para você completar."
        selo="A carreira anterior conta"
      />
      <section className="pilha">
        <h2>Histórias no formato Situação, Tarefa, Ação, Resultado</h2>
        {!lista.length && !evs.isLoading ? (
          <Vazio titulo="Registre uma evidência para gerar histórias" acao={<Link className="link" to="/evidencias/nova">Nova evidência</Link>}>
            As histórias são montadas só com o que está nas suas evidências.
          </Vazio>
        ) : (
          <form className="pilha" onSubmit={gerar} noValidate>
            <CampoSelecao id="pergunta" rotulo="Pergunta" opcoes={PERGS} value={pergunta} onChange={(e) => setPergunta(e.target.value)} />
            <CampoSelecao
              id="evid"
              rotulo="Evidência usada"
              ajuda="Evidências bem documentadas geram histórias mais completas."
              opcoes={lista.map((e) => [e.id, `${e.titulo}${e.completa ? "" : " (incompleta)"}`] as const)}
              value={evSel}
              onChange={(e) => setEvid(e.target.value)}
            />
            <ErroForm erro={criar.error} />
            <div className="linha">
              <Botao type="submit" className="botao primario" carregando={criar.isPending}>
                Gerar história
              </Botao>
            </div>
          </form>
        )}
        {criar.isPending && <Carregando texto="Montando sua história…" />}
        {hs.data?.map((h) => (
          <article className="cartao" key={h.id}>
            <h3>{h.pergunta}</h3>
            <p className="apoio">A partir de: {h.evidencia}</p>
            <p>
              <strong>Situação:</strong> {h.situacao}
            </p>
            <p>
              <strong>Tarefa:</strong> {h.tarefa}
            </p>
            <p>
              <strong>Ação:</strong> {h.acao}
            </p>
            <p>
              <strong>Resultado:</strong> {h.resultado}
            </p>
            <OrigemResultado fonte={h.fonte} />
            <div>
              <Botao className="botao peq" carregando={remover.isPending && remover.variables === h.id} onClick={() => remover.mutate(h.id, { onSuccess: () => avisar("História removida") })}>
                Remover
              </Botao>
            </div>
          </article>
        ))}
      </section>
      <section className="pilha">
        <h2>Treino de perguntas e respostas</h2>
        <form className="pilha" onSubmit={treinar} noValidate>
          <CampoSelecao id="ptreino" rotulo="Pergunta" opcoes={PERGS} value={ptreino} onChange={(e) => setPtreino(e.target.value)} />
          <CampoArea id="resp" rotulo="Sua resposta" value={resp} onChange={(e) => setResp(e.target.value)} maxLength={3000} erro={erroDoCampo(feedback.error, "resposta")} />
          {!erroDoCampo(feedback.error, "resposta") && <ErroForm erro={feedback.error} />}
          <div className="linha">
            <Botao type="submit" className="botao primario" carregando={feedback.isPending}>
              Receber feedback
            </Botao>
          </div>
        </form>
        <div aria-live="polite" className="pilha">
          {feedback.isPending && <Carregando texto="Lendo sua resposta…" />}
          {feedback.data && (
            <article className="cartao">
              <h3>Feedback</h3>
              <p>
                <strong>Clareza:</strong> {feedback.data.clareza}
              </p>
              <p>
                <strong>Objetividade:</strong> {feedback.data.objetividade}
              </p>
              <ul>
                {feedback.data.sugestoes.map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
              <OrigemResultado fonte={feedback.data.fonte} />
            </article>
          )}
        </div>
      </section>
    </>
  );
}
