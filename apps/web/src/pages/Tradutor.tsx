import { AREAS, type AreaId, type Evidencia, type Fonte, type Traducao } from "@decifra/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/cliente";
import { useAcao } from "../api/consultas";
import { Botao, Cabecalho, CampoArea, Carregando, ErroForm, OrigemResultado, erroDoCampo } from "../components/ui";
import { avisar } from "../lib/avisos";
import { useSessaoAtiva } from "../lib/sessao";
import { AbasEvidencias } from "./Evidencias";

export function Tradutor() {
  const s = useSessaoAtiva();
  const nav = useNavigate();
  const [entrada, setEntrada] = useState("");
  const traduzir = useAcao((t: string) => api.post<{ itens: Traducao[]; fonte: Fonte }>("/tradutor", { entrada: t }));
  const salvar = useAcao((t: Traducao) => api.post<Evidencia>("/tradutor/evidencia", { entrada: t.entrada, competencias: t.competencias }));
  const area = AREAS[s.perfil!.destino as AreaId]?.nome ?? "a nova área";

  function enviar(e: FormEvent) {
    e.preventDefault();
    traduzir.mutate(entrada);
  }

  return (
    <>
      <Cabecalho titulo="Tradutor de Experiência" sub="Descreva suas funções e tarefas, uma por linha. A tradução usa só o que você escreveu." selo="A carreira anterior conta" />
      <AbasEvidencias />
      <form className="pilha" onSubmit={enviar} noValidate>
        <CampoArea
          id="entrada"
          rotulo="O que você fazia na carreira anterior"
          ajuda="Ex.: assistente administrativa que acompanhava metas de vendas em planilhas"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          maxLength={4000}
          erro={erroDoCampo(traduzir.error, "entrada")}
        />
        {!erroDoCampo(traduzir.error, "entrada") && <ErroForm erro={traduzir.error} />}
        <div className="linha">
          <Botao type="submit" className="botao primario" carregando={traduzir.isPending}>
            Traduzir para {area}
          </Botao>
        </div>
      </form>
      <div className="pilha" aria-live="polite">
        {traduzir.isPending && <Carregando texto="Traduzindo sua experiência…" />}
        {traduzir.data && <OrigemResultado fonte={traduzir.data.fonte} />}
        {traduzir.data?.itens.map((t, i) => (
          <article className="cartao" key={i}>
            <h2>{t.entrada}</h2>
            {t.falta ? (
              <p className="apoio">{t.falta}</p>
            ) : (
              <>
                <p>
                  <strong>Competências:</strong> {t.competencias.join(", ")}
                </p>
                <p>
                  <strong>No currículo:</strong> {t.curriculo}
                </p>
                <p>
                  <strong>Na entrevista:</strong> {t.entrevista}
                </p>
                <div className="linha">
                  <Botao
                    className="botao peq"
                    carregando={salvar.isPending && salvar.variables === t}
                    onClick={() =>
                      salvar.mutate(t, {
                        onSuccess: (ev) => {
                          avisar("Salva. Complete o que falta.");
                          nav(`/evidencias/${ev.id}`);
                        },
                        onError: (x) => avisar(x.message, "erro"),
                      })
                    }
                  >
                    Salvar como evidência
                  </Botao>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
