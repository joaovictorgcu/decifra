import { ACEITA_FORMAL, TIPOS_REQUISITO, type Fonte, type Requisito, type VagaEmpresa } from "@decifra/shared";
import { useState, type FormEvent } from "react";
import { api } from "../../api/cliente";
import { useAcao, useVagasEmpresa } from "../../api/consultas";
import { Confirmar } from "../../components/Confirmar";
import { Botao, Cabecalho, CampoArea, CampoSelecao, CampoTexto, Carregando, ErroForm, Esqueleto, Etiqueta, Falha, OrigemResultado, Vazio, erroDoCampo } from "../../components/ui";
import { avisar } from "../../lib/avisos";

type Rascunho = { titulo: string; texto: string; fonte: Fonte; ia: string | null; requisitos: (Requisito & { aceita: "" | "sim" | "nao" })[] };

export function VagasEmpresa() {
  const q = useVagasEmpresa();
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [rasc, setRasc] = useState<Rascunho | null>(null);
  const [alvo, setAlvo] = useState<VagaEmpresa | null>(null);
  const analisar = useAcao((d: { titulo: string; texto: string }) => api.post<Rascunho>("/empresa/vagas/analisar", d));
  const publicar = useAcao((r: Rascunho) => api.post<VagaEmpresa>("/empresa/vagas", { titulo: r.titulo, texto: r.texto, requisitos: r.requisitos }));
  const alternar = useAcao((d: { id: string; publicada: boolean }) => api.patch(`/empresa/vagas/${d.id}`, { publicada: d.publicada }));
  const apagar = useAcao((id: string) => api.del(`/empresa/vagas/${id}`));

  function enviar(e: FormEvent) {
    e.preventDefault();
    analisar.mutate({ titulo, texto }, { onSuccess: (r) => setRasc({ ...r, requisitos: r.requisitos.map((x) => ({ ...x, aceita: "" })) }) });
  }

  if (analisar.isPending)
    return (
      <>
        <Cabecalho titulo="Vagas Decifradas" />
        <Carregando texto="Lendo a vaga…" />
      </>
    );

  if (rasc) {
    const fechada = rasc.requisitos.some((r) => r.tipo === "formal" && r.obrig && r.aceita !== "sim");
    const muda = (i: number, d: Partial<Rascunho["requisitos"][number]>) => setRasc({ ...rasc, requisitos: rasc.requisitos.map((x, j) => (j === i ? { ...x, ...d } : x)) });
    return (
      <>
        <Cabecalho titulo={`Revise: ${rasc.titulo}`} sub="Separe o que é indispensável do que é desejável. Quem decide é a sua empresa." />
        <OrigemResultado fonte={rasc.fonte} ia={rasc.ia} />
        <form
          className="pilha"
          onSubmit={(e) => {
            e.preventDefault();
            publicar.mutate(rasc, {
              onSuccess: (v) => {
                avisar(v.selo ? "Vaga publicada com selo" : "Vaga publicada sem selo");
                setRasc(null);
                setTitulo("");
                setTexto("");
              },
            });
          }}
        >
          {rasc.requisitos.map((r, i) => (
            <fieldset className="cartao" key={r.id}>
              <legend>{r.requisito}</legend>
              <p className="apoio">{TIPOS_REQUISITO[r.tipo]}</p>
              <CampoSelecao id={`ob${i}`} rotulo="Peso na vaga" opcoes={[["1", "Obrigatório"], ["0", "Desejável"]]} value={r.obrig ? "1" : "0"} onChange={(e) => muda(i, { obrig: e.target.value === "1" })} />
              {r.tipo === "formal" && (
                <CampoSelecao
                  id={`ac${i}`}
                  rotulo="Sua empresa aceita experiência aplicada no lugar desta exigência?"
                  opcoes={ACEITA_FORMAL}
                  value={r.aceita}
                  onChange={(e) => muda(i, { aceita: e.target.value as "" | "sim" | "nao" })}
                />
              )}
              <button type="button" className="link perigo" onClick={() => setRasc({ ...rasc, requisitos: rasc.requisitos.filter((_, j) => j !== i) })}>
                Remover requisito
              </button>
            </fieldset>
          ))}
          <p className="apoio leitura">
            O selo “Aberta a transição de carreira” é aplicado quando nenhuma exigência formal obrigatória ficou fechada ou sem decisão.{" "}
            {fechada ? <strong>Hoje esta vaga ficaria sem selo.</strong> : <strong>Esta vaga receberá o selo.</strong>}
          </p>
          <ErroForm erro={publicar.error} />
          <div className="linha">
            <Botao type="submit" className="botao primario" carregando={publicar.isPending} disabled={!rasc.requisitos.length}>
              Publicar vaga
            </Botao>
            <button type="button" className="botao" onClick={() => setRasc(null)}>
              Cancelar
            </button>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <Cabecalho titulo="Vagas Decifradas" sub="Cole uma vaga e separe requisitos obrigatórios de desejáveis. Vagas publicadas aparecem para candidatos fazerem o Raio-X." />
      <form className="pilha" onSubmit={enviar} noValidate>
        <CampoTexto id="titulo" rotulo="Nome da vaga" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} erro={erroDoCampo(analisar.error, "titulo")} />
        <CampoArea id="texto" className="alto" rotulo="Descrição da vaga" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={20000} erro={erroDoCampo(analisar.error, "texto")} />
        {!erroDoCampo(analisar.error, "titulo") && !erroDoCampo(analisar.error, "texto") && <ErroForm erro={analisar.error} />}
        <div className="linha">
          <Botao type="submit" className="botao primario">
            Analisar vaga
          </Botao>
        </div>
      </form>
      <section className="pilha">
        <h2>Vagas revisadas</h2>
        {q.isLoading && <Esqueleto linhas={2} />}
        {q.isError && <Falha erro={q.error} tentar={() => q.refetch()} />}
        {q.data && !q.data.length && <Vazio titulo="Nenhuma vaga publicada">Analise uma vaga acima para revisar e publicar.</Vazio>}
        {!!q.data?.length && (
          <ul className="lista-d">
            {q.data.map((v) => (
              <li key={v.id}>
                <div>
                  <strong>{v.titulo}</strong>
                  <br />
                  <span className="apoio">
                    {v.requisitos.filter((x) => x.obrig).length} obrigatórios, {v.requisitos.filter((x) => !x.obrig).length} desejáveis · {v.analises} Raio-X de candidatos
                    {!v.publicada && " · Pausada"}
                  </span>
                </div>
                <div className="linha">
                  {v.selo ? <Etiqueta rotulo="Aberta a transição de carreira" icone="✓" cor="agua" /> : <span className="etq cinza">Sem selo</span>}
                  <Botao
                    className="botao peq"
                    carregando={alternar.isPending && alternar.variables?.id === v.id}
                    onClick={() => alternar.mutate({ id: v.id, publicada: !v.publicada }, { onSuccess: () => avisar(v.publicada ? "Vaga pausada" : "Vaga publicada") })}
                  >
                    {v.publicada ? "Pausar" : "Publicar"}
                  </Botao>
                  <button type="button" className="botao peq" onClick={() => setAlvo(v)} aria-label={`Excluir ${v.titulo}`}>
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Confirmar
        aberto={!!alvo}
        titulo={`Excluir “${alvo?.titulo ?? ""}”?`}
        carregando={apagar.isPending}
        aoFechar={() => setAlvo(null)}
        aoConfirmar={() => alvo && apagar.mutate(alvo.id, { onSuccess: () => (setAlvo(null), avisar("Vaga excluída")) })}
      >
        <p>Candidatos que já fizeram o Raio-X mantêm a análise deles.</p>
      </Confirmar>
    </>
  );
}
