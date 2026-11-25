import type { MensagemMentor } from "@decifra/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, conversarComMentor } from "../api/cliente";
import { useAcao, useConversa, useConversas, useVaga } from "../api/consultas";
import { Confirmar } from "../components/Confirmar";
import { Markdown } from "../components/Markdown";
import { Botao, Cabecalho, Carregando, Falha, Vazio } from "../components/ui";
import { avisar } from "../lib/avisos";
import { useSessaoAtiva } from "../lib/sessao";

type Msg = Pick<MensagemMentor, "papel" | "conteudo"> & { id: string };

const SUGESTOES = [
  "Qual deve ser meu próximo passo esta semana?",
  "Qual lacuna das minhas vagas eu resolvo primeiro?",
  "Como conto minha experiência anterior numa entrevista?",
  "Que mini-projeto eu faço para comprovar o que falta?",
];

export function Mentor() {
  const s = useSessaoAtiva();
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const conversas = useConversas();
  const conversa = useConversa(id);
  const vagaCtx = useVaga(params.get("vaga") ?? undefined);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [excluir, setExcluir] = useState(false);
  const cancelar = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const apagar = useAcao((cid: string) => api.del(`/mentor/conversas/${cid}`));
  const restantes = Math.max(0, s.uso.limiteMentor - s.uso.mentorHoje);

  // Carrega o histórico ao abrir uma conversa salva (sem sobrescrever um envio em andamento).
  useEffect(() => {
    if (enviando) return;
    if (!id) setMsgs([]);
    else if (conversa.data) setMsgs(conversa.data.mensagens.map((m) => ({ id: m.id, papel: m.papel, conteudo: m.conteudo })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, conversa.data]);

  useEffect(() => {
    if (vagaCtx.data && !texto && !id) setTexto(`Analisei a vaga “${vagaCtx.data.titulo}”. O que eu faço primeiro para me preparar para ela?`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vagaCtx.data]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs]);

  useEffect(() => () => cancelar.current?.abort(), []);

  async function enviar(mensagem: string) {
    const m = mensagem.trim();
    if (!m || enviando) return;
    setErro("");
    setTexto("");
    setEnviando(true);
    const idResp = `r${Date.now()}`;
    setMsgs((l) => [...l, { id: `u${Date.now()}`, papel: "user", conteudo: m }, { id: idResp, papel: "assistant", conteudo: "" }]);
    const ctrl = new AbortController();
    cancelar.current = ctrl;
    let novaId: string | null = null;
    try {
      await conversarComMentor(
        { conversaId: id, mensagem: m },
        {
          inicio: (d) => {
            if (!id) novaId = d.conversaId;
          },
          trecho: (t) => setMsgs((l) => l.map((x) => (x.id === idResp ? { ...x, conteudo: x.conteudo + t } : x))),
          erro: (e) => {
            setErro(e);
            setMsgs((l) => l.filter((x) => x.id !== idResp || x.conteudo));
          },
        },
        ctrl.signal,
      );
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setErro(e instanceof Error ? e.message : "O Mentor não respondeu.");
        setMsgs((l) => l.filter((x) => x.id !== idResp || x.conteudo));
      }
    } finally {
      setEnviando(false);
      cancelar.current = null;
      await qc.invalidateQueries({ queryKey: ["conversas"] });
      await qc.invalidateQueries({ queryKey: ["sessao"] });
      if (novaId) {
        await qc.invalidateQueries({ queryKey: ["conversa", novaId] });
        nav(`/mentor/${novaId}`, { replace: true });
      }
    }
  }

  function submeter(e: FormEvent) {
    e.preventDefault();
    void enviar(texto);
  }
  function atalho(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void enviar(texto);
    }
  }

  if (!s.ia.ativa) {
    return (
      <>
        <Cabecalho titulo="Mentor DECIFRA" selo="Assistente de transição de carreira" />
        <Vazio titulo="O Mentor não está disponível neste ambiente">
          O Mentor usa IA, que não foi configurada aqui. As demais ferramentas da DECIFRA continuam funcionando com o motor de regras.
        </Vazio>
      </>
    );
  }

  return (
    <>
      <Cabecalho
        titulo="Mentor DECIFRA"
        selo="Assistente de transição de carreira"
        sub="Converse sobre sua transição. O Mentor conhece seu diagnóstico, suas evidências, os Raio-X e o seu Plano, e nunca sugere declarar o que você não consegue demonstrar."
      />
      <div className="mentor">
        <aside className="conversas" aria-label="Conversas">
          <Link className="botao peq" to="/mentor" onClick={() => setMsgs([])}>
            Nova conversa
          </Link>
          {conversas.data && conversas.data.length > 0 && (
            <ul>
              {conversas.data.map((c) => (
                <li className="conversa-item" key={c.id}>
                  <Link to={`/mentor/${c.id}`} aria-current={c.id === id ? "page" : undefined} title={c.titulo}>
                    {c.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="chat" aria-label="Conversa com o Mentor">
          {id && conversa.isLoading && <Carregando texto="Carregando conversa…" />}
          {id && conversa.isError && <Falha erro={conversa.error} />}
          {!id && !msgs.length && (
            <div className="pilha">
              <p className="apoio">Comece com uma destas perguntas ou escreva a sua:</p>
              <div className="sugestoes">
                {SUGESTOES.map((x) => (
                  <button key={x} type="button" className="botao" onClick={() => void enviar(x)} disabled={enviando || !restantes}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mensagens" aria-live="polite" aria-busy={enviando}>
            {msgs.map((m) => (
              <div key={m.id} className={`msg ${m.papel}`}>
                <span className="so-leitor">{m.papel === "user" ? "Você disse:" : "Mentor:"}</span>
                {m.papel === "assistant" ? (
                  m.conteudo ? (
                    <Markdown texto={m.conteudo} />
                  ) : (
                    <span className="carregando">
                      <span className="girando" aria-hidden="true" /> Pensando…
                    </span>
                  )
                ) : (
                  <p style={{ whiteSpace: "pre-wrap" }}>{m.conteudo}</p>
                )}
              </div>
            ))}
            <div ref={fim} />
          </div>
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
          <form className="compor" onSubmit={submeter}>
            <label htmlFor="mensagem" className="so-leitor">
              Sua mensagem
            </label>
            <textarea id="mensagem" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={atalho} maxLength={4000} placeholder="Escreva sua pergunta. Enter envia, Shift+Enter quebra a linha." disabled={!restantes} />
            <div className="linha entre">
              <span className="apoio" style={{ fontSize: ".8125rem" }}>
                {restantes ? `${restantes} mensagens restantes hoje` : "Você usou as mensagens de hoje. Volte amanhã."}
              </span>
              <div className="linha">
                {enviando && (
                  <button type="button" className="botao peq" onClick={() => cancelar.current?.abort()}>
                    Parar
                  </button>
                )}
                {id && !enviando && (
                  <button type="button" className="botao peq" onClick={() => setExcluir(true)}>
                    Excluir conversa
                  </button>
                )}
                <Botao type="submit" className="botao primario peq" carregando={enviando} disabled={!texto.trim() || !restantes}>
                  Enviar
                </Botao>
              </div>
            </div>
          </form>
        </section>
      </div>
      <Confirmar
        aberto={excluir}
        titulo="Excluir esta conversa?"
        carregando={apagar.isPending}
        aoFechar={() => setExcluir(false)}
        aoConfirmar={() =>
          id &&
          apagar.mutate(id, {
            onSuccess: () => {
              setExcluir(false);
              avisar("Conversa excluída");
              nav("/mentor");
            },
          })
        }
      >
        <p>O histórico desta conversa será apagado.</p>
      </Confirmar>
    </>
  );
}
