import { useState } from "react";
import { api } from "../api/cliente";

/**
 * Pergunta curta de validação ("fez sentido?" / "ajudou?"). As respostas
 * alimentam as métricas das hipóteses do negócio (H1 e H5).
 */
export function PerguntaFeedback({ alvo, refId, inicial, pergunta, compacta }: { alvo: "raio" | "mentor"; refId: string; inicial: boolean | null; pergunta: string; compacta?: boolean }) {
  const [util, setUtil] = useState<boolean | null>(inicial);
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  async function responder(v: boolean, texto = "") {
    setErro("");
    try {
      await api.post("/feedback", { alvo, refId, util: v, comentario: texto });
      setUtil(v);
      setEnviado(true);
      setComentando(!v && !texto);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
    }
  }

  return (
    <div className={`feedback ${compacta ? "compacta" : ""}`} role="group" aria-label={pergunta}>
      <span className="feedback-pergunta">{pergunta}</span>
      <div className="linha" style={{ gap: 6 }}>
        <button type="button" className="botao peq" aria-pressed={util === true} onClick={() => void responder(true)}>
          Sim
        </button>
        <button type="button" className="botao peq" aria-pressed={util === false} onClick={() => void responder(false)}>
          Não
        </button>
      </div>
      {comentando && (
        <form
          className="linha"
          onSubmit={(e) => {
            e.preventDefault();
            void responder(false, comentario);
            setComentando(false);
          }}
        >
          <label className="so-leitor" htmlFor={`fb-${refId}`}>
            O que não funcionou?
          </label>
          <input id={`fb-${refId}`} type="text" maxLength={500} placeholder="O que não funcionou? (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} style={{ flex: "1 1 220px" }} />
          <button type="submit" className="botao peq">
            Enviar
          </button>
        </form>
      )}
      <span className="so-leitor" role="status">
        {enviado ? "Obrigado pela resposta." : ""}
      </span>
      {enviado && !comentando && <span className="feedback-ok">Obrigado! Isso ajuda a melhorar a DECIFRA.</span>}
      {erro && <span className="erro">{erro}</span>}
    </div>
  );
}
