import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, conversarComMentor } from "../api/cliente";
import { useAcao, useConversa, useConversas, useVaga } from "../api/consultas";
import { Confirmar } from "../components/Confirmar";
import { Markdown } from "../components/Markdown";
import { Cabecalho, Carregando, Falha, Vazio } from "../components/ui";
import { avisar } from "../lib/avisos";
import { dataBR } from "../lib/formato";
import { useSessaoAtiva } from "../lib/sessao";

interface Msg {
  id: string;
  papel: "user" | "assistant";
  conteudo: string;
  ia: string | null;
  interrompida: boolean;
}

export function Mentor() {
  const s = useSessaoAtiva();
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const conversas = useConversas();
  const conversa = useConversa(id);
  const vagaCtx = useVaga(params.get("vaga") ?? undefined);
  const sugestoes = useQuery<string[]>({
    queryKey: ["mentor-sugestoes"],
    queryFn: async () => (await api.get<{ itens: string[] }>("/mentor/sugestoes")).itens,
    enabled: s.ia.mentor,
  });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; repetir: string | null } | null>(null);
  const [excluir, setExcluir] = useState(false);
  const cancelar = useRef<AbortController | null>(null);
  /** A troca de URL veio do próprio envio (conversa nova): não limpa o aviso de erro. */
  const navegouAposEnvio = useRef(false);
  const fim = useRef<HTMLDivElement>(null);
  const apagar = useAcao((cid: string) => api.del(`/mentor/conversas/${cid}`));
  const restantes = Math.max(0, s.uso.limiteMentor - s.uso.mentorHoje);

  // Carrega o histórico ao abrir uma conversa salva (sem sobrescrever um envio em andamento).
  useEffect(() => {
    if (enviando) return;
    if (!id) setMsgs([]);
    else if (conversa.data) setMsgs(conversa.data.mensagens.map((m) => ({ id: m.id, papel: m.papel, conteudo: m.conteudo, ia: m.ia, interrompida: m.interrompida })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, conversa.data]);

  // Ao trocar de conversa, limpa o aviso de erro (exceto quando a troca veio do próprio envio).
  useEffect(() => {
    if (navegouAposEnvio.current) navegouAposEnvio.current = false;
    else setErro(null);
  }, [id]);

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
    setErro(null);
    setTexto("");
    setEnviando(true);
    const idUser = `u${Date.now()}`;
    const idResp = `r${Date.now()}`;
    setMsgs((l) => [...l, { id: idUser, papel: "user", conteudo: m, ia: null, interrompida: false }, { id: idResp, papel: "assistant", conteudo: "", ia: null, interrompida: false }]);
    const ctrl = new AbortController();
    cancelar.current = ctrl;
    let novaId: string | null = null;
    let recebeu = false;
    const atualizar = (f: (x: Msg) => Msg) => setMsgs((l) => l.map((x) => (x.id === idResp ? f(x) : x)));
    const desfazer = () => {
      // Sem nenhum texto gerado, nada foi gravado: devolve a pergunta para o campo.
      setMsgs((l) => l.filter((x) => x.id !== idUser && x.id !== idResp));
      setTexto(m);
    };
    try {
      await conversarComMentor(
        { conversaId: id, mensagem: m },
        {
          meta: (ia) => atualizar((x) => ({ ...x, ia })),
          trecho: (t) => {
            recebeu = true;
            atualizar((x) => ({ ...x, conteudo: x.conteudo + t }));
          },
          fim: (d) => {
            if (!id) novaId = d.conversaId;
            atualizar((x) => ({ ...x, id: d.mensagem.id, ia: d.mensagem.ia, interrompida: d.mensagem.interrompida }));
          },
          erro: (e) => {
            setErro({ mensagem: e, repetir: recebeu ? null : m });
            if (recebeu) atualizar((x) => ({ ...x, interrompida: true }));
            else desfazer();
          },
        },
        ctrl.signal,
      );
      if (ctrl.signal.aborted) {
        if (recebeu) atualizar((x) => ({ ...x, interrompida: true }));
        else desfazer();
      }
    } catch (e) {
      setErro({ mensagem: e instanceof Error ? e.message : "O Mentor não respondeu.", repetir: recebeu ? null : m });
      if (recebeu) atualizar((x) => ({ ...x, interrompida: true }));
      else desfazer();
    } finally {
      setEnviando(false);
      cancelar.current = null;
      await Promise.all([qc.invalidateQueries({ queryKey: ["conversas"] }), qc.invalidateQueries({ queryKey: ["sessao"] })]);
      // Cancelamento com texto parcial: o servidor criou a conversa; atualiza a lista para encontrá-la.
      if (novaId) {
        await qc.invalidateQueries({ queryKey: ["conversa", novaId] });
        navegouAposEnvio.current = true;
        nav(`/mentor/${novaId}`, { replace: true });
      } else if (id) {
        await qc.invalidateQueries({ queryKey: ["conversa", id] });
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

  if (!s.ia.mentor) {
    return (
      <>
        <Cabecalho titulo="Mentor DECIFRA" selo="Assistente de transição de carreira" />
        <Vazio
          titulo="O Mentor não está disponível neste ambiente"
          acao={
            <div className="linha">
              <Link className="link" to="/raio-x">
                Fazer um Raio-X
              </Link>
              <Link className="link" to="/plano">
                Ver meu Plano
              </Link>
            </div>
          }
        >
          {s.ia.ativa
            ? "O Mentor usa o seu contexto pessoal e, por privacidade, só conversa por provedores de IA que não treinam com seus dados. Nenhum deles está configurado aqui."
            : "O Mentor é uma conversa com IA, e nenhum provedor de IA está configurado aqui. O Raio-X, o Plano e as demais ferramentas continuam funcionando pelo motor de regras."}
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
                    <span className="so-leitor">, atualizada em {dataBR(c.atualizadaEm)}</span>
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
                {(sugestoes.data ?? []).map((x) => (
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
                      <span className="girando" aria-hidden="true" /> {m.ia ? `Respondendo (${m.ia})…` : "Pensando…"}
                    </span>
                  )
                ) : (
                  <p style={{ whiteSpace: "pre-wrap" }}>{m.conteudo}</p>
                )}
                {m.papel === "assistant" && (m.ia || m.interrompida) && m.conteudo && (
                  <p className="msg-origem">
                    {m.interrompida && <strong>Resposta interrompida. </strong>}
                    {m.ia && <>Gerado por IA · {m.ia}</>}
                  </p>
                )}
              </div>
            ))}
            <div ref={fim} />
          </div>
          {erro && (
            <div className="falha" role="alert">
              <span>{erro.mensagem}</span>
              {erro.repetir && (
                <button type="button" className="link" style={{ color: "inherit" }} onClick={() => void enviar(erro.repetir!)} disabled={enviando}>
                  Tentar de novo
                </button>
              )}
            </div>
          )}
          <form className="compor" onSubmit={submeter}>
            <label htmlFor="mensagem" className="so-leitor">
              Sua mensagem
            </label>
            <textarea
              id="mensagem"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={atalho}
              maxLength={4000}
              placeholder="Escreva sua pergunta. Enter envia, Shift+Enter quebra a linha."
              disabled={!restantes}
            />
            <div className="linha entre">
              <span className="apoio" style={{ fontSize: ".8125rem" }}>
                {restantes ? `${restantes} mensagens restantes hoje` : "Você usou as mensagens de hoje. Elas renovam amanhã."}
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
                <button type="submit" className="botao primario peq" disabled={enviando || !texto.trim() || !restantes} aria-busy={enviando || undefined}>
                  {enviando && <span className="girando" aria-hidden="true" />}
                  Enviar
                </button>
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
