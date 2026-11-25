import { ETAPAS_CANDIDATURA, type Candidatura, type EtapaCandidatura } from "@decifra/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/cliente";
import { useAcao, useCandidaturas } from "../api/consultas";
import { Confirmar } from "../components/Confirmar";
import { Cabecalho, Esqueleto, Falha, Vazio } from "../components/ui";
import { avisar } from "../lib/avisos";

export function Candidaturas() {
  const q = useCandidaturas();
  const mover = useAcao((d: { id: string; etapa: EtapaCandidatura }) => api.patch(`/candidaturas/${d.id}`, { etapa: d.etapa }));
  const remover = useAcao((id: string) => api.del(`/candidaturas/${id}`));
  const [alvo, setAlvo] = useState<Candidatura | null>(null);
  const cs = q.data ?? [];
  const sem = cs.filter((x) => x.etapa === "Sem retorno").length;
  return (
    <>
      <Cabecalho titulo="Candidaturas" sub="Acompanhe cada vaga e o Raio-X dela." selo="Cada etapa tem uma necessidade diferente" />
      {sem >= 2 && (
        <div className="alerta" role="status">
          <strong>{sem} candidaturas sem retorno.</strong> Vale revisar suas evidências e o currículo para esse tipo de vaga.
          <br />
          <Link className="link" to="/evidencias" style={{ color: "inherit" }}>
            Revisar evidências
          </Link>
        </div>
      )}
      {q.isLoading && <Esqueleto />}
      {q.isError && <Falha erro={q.error} tentar={() => q.refetch()} />}
      {q.data && !cs.length && (
        <Vazio titulo="Nenhuma candidatura registrada" acao={<Link className="link" to="/raio-x">Ir para o Raio-X</Link>}>
          Quando se candidatar a uma vaga, registre a candidatura no Raio-X dela para acompanhar aqui.
        </Vazio>
      )}
      {cs.length > 0 && (
        <div className="quadro">
          {ETAPAS_CANDIDATURA.map((e) => {
            const l = cs.filter((x) => x.etapa === e);
            return (
              <section className="coluna" key={e}>
                <h2>
                  {e} ({l.length})
                </h2>
                {l.map((x) => (
                  <article className="ficha" key={x.id}>
                    <strong>{x.vagaTitulo}</strong>
                    <div className="campo">
                      <label htmlFor={`et-${x.id}`}>Etapa</label>
                      <select
                        id={`et-${x.id}`}
                        value={x.etapa}
                        onChange={(ev) =>
                          mover.mutate(
                            { id: x.id, etapa: ev.target.value as EtapaCandidatura },
                            { onSuccess: () => avisar(`Candidatura movida para ${ev.target.value}`), onError: (er) => avisar(er.message, "erro") },
                          )
                        }
                      >
                        {ETAPAS_CANDIDATURA.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="linha">
                      <Link className="link" to={`/raio-x/${x.vagaId}`} aria-label={`Ver Raio-X de ${x.vagaTitulo}`}>
                        Ver Raio-X
                      </Link>
                      <button type="button" className="link perigo" onClick={() => setAlvo(x)} aria-label={`Remover candidatura: ${x.vagaTitulo}`}>
                        Remover
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
      <Confirmar
        aberto={!!alvo}
        titulo="Remover esta candidatura?"
        confirmar="Remover"
        carregando={remover.isPending}
        aoFechar={() => setAlvo(null)}
        aoConfirmar={() => alvo && remover.mutate(alvo.id, { onSuccess: () => (setAlvo(null), avisar("Candidatura removida")), onError: (e) => avisar(e.message, "erro") })}
      >
        <p>{alvo?.vagaTitulo}. O Raio-X da vaga continua salvo.</p>
      </Confirmar>
    </>
  );
}
