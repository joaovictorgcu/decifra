import type { VagaDetalhe } from "@decifra/shared";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ErroRequisicao } from "../api/cliente";
import { useAcao, useVagas, useVagasAbertas } from "../api/consultas";
import { Botao, Cabecalho, CampoArea, CampoTexto, Carregando, ErroForm, Esqueleto, EtqDecisao, Etiqueta, Falha, Trava, Vazio, erroDoCampo } from "../components/ui";
import { avisar } from "../lib/avisos";
import { useSessaoAtiva } from "../lib/sessao";

/** Lista de vagas salvas com a decisão atual de cada uma. */
export function ListaVagas() {
  const q = useVagas();
  if (q.isLoading) return <Esqueleto linhas={2} />;
  if (q.isError) return <Falha erro={q.error} tentar={() => q.refetch()} />;
  if (!q.data?.length) return <p className="apoio">Nenhuma vaga salva ainda. Faça um Raio-X para guardar a primeira.</p>;
  return (
    <ul className="lista-d">
      {q.data.map((v) => (
        <li key={v.id}>
          <div>
            <strong>{v.titulo}</strong>
            {v.empresa && <span className="apoio"> · {v.empresa}</span>}
          </div>
          <div className="linha">
            <EtqDecisao d={v.decisao} />
            <Link className="botao peq" to={`/raio-x/${v.id}`} aria-label={`Ver Raio-X de ${v.titulo}`}>
              Ver Raio-X
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

function VagasAbertas({ bloqueado }: { bloqueado: boolean }) {
  const q = useVagasAbertas();
  const nav = useNavigate();
  const analisar = useAcao((id: string) => api.post<VagaDetalhe>(`/vagas-abertas/${id}/raio`));
  if (q.isLoading || !q.data?.length) return null;
  return (
    <section className="pilha">
      <h2>Vagas publicadas na DECIFRA</h2>
      <p className="apoio leitura">Vagas revisadas pelas próprias empresas, com o que é obrigatório e o que é desejável já separado.</p>
      <ul className="lista-d">
        {q.data.map((v) => (
          <li key={v.id}>
            <div>
              <strong>{v.titulo}</strong>
              <span className="apoio"> · {v.empresa}</span>
            </div>
            <div className="linha">
              {v.selo && <Etiqueta rotulo="Aberta a transição de carreira" icone="✓" cor="agua" />}
              {v.minhaVagaId ? (
                <Link className="botao peq" to={`/raio-x/${v.minhaVagaId}`}>
                  Ver meu Raio-X
                </Link>
              ) : (
                <Botao
                  className="botao peq"
                  disabled={bloqueado}
                  carregando={analisar.isPending && analisar.variables === v.id}
                  onClick={() =>
                    analisar.mutate(v.id, {
                      onSuccess: (d) => nav(`/raio-x/${d.id}`),
                      onError: (e) => avisar(e.message, "erro"),
                    })
                  }
                >
                  Fazer Raio-X
                </Botao>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RaioX() {
  const s = useSessaoAtiva();
  const nav = useNavigate();
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [lendo, setLendo] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const gerar = useAcao((d: { titulo: string; texto: string }) => api.post<VagaDetalhe>("/vagas", d));
  const limite = s.uso.limiteRaio !== null && s.uso.raioMes >= s.uso.limiteRaio;

  function enviar(e: FormEvent) {
    e.preventDefault();
    gerar.mutate({ titulo, texto }, { onSuccess: (v) => nav(`/raio-x/${v.id}`) });
  }

  async function carregarArquivo(f: File | undefined) {
    if (!f) return;
    setLendo(true);
    try {
      const r = await api.enviarArquivo<{ texto: string }>("/arquivos/texto", f);
      setTexto(r.texto.slice(0, 20000));
      avisar("Texto da vaga carregado. Confira antes de gerar.");
    } catch (x) {
      avisar(x instanceof Error ? x.message : "Não consegui ler o arquivo.", "erro");
    } finally {
      setLendo(false);
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  if (gerar.isPending) {
    return (
      <>
        <Cabecalho titulo="Raio-X da Vaga" />
        <Carregando texto="Analisando a vaga e cruzando com suas evidências…" />
      </>
    );
  }

  const planoErro = gerar.error instanceof ErroRequisicao && gerar.error.codigo === "plano";
  return (
    <>
      <Cabecalho titulo="Raio-X da Vaga" sub="Cole uma vaga e veja, requisito por requisito, o que suas evidências já sustentam." selo="Decisão, não nota" />
      {limite || planoErro ? (
        <Trava recurso="O Raio-X ilimitado" />
      ) : (
        <form className="pilha" onSubmit={enviar} noValidate>
          <CampoTexto id="titulo" rotulo="Nome da vaga" ajuda="Opcional. Se ficar em branco, uso a primeira linha da descrição." value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} />
          <CampoArea
            id="texto"
            className="alto"
            rotulo="Cole aqui a descrição da vaga"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={20000}
            erro={erroDoCampo(gerar.error, "texto")}
          />
          <div className="linha">
            <input ref={arquivo} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="so-leitor" id="arquivo-vaga" aria-label="Arquivo com a descrição da vaga (PDF ou TXT)" onChange={(e) => carregarArquivo(e.target.files?.[0])} tabIndex={-1} />
            <Botao className="link" carregando={lendo} onClick={() => arquivo.current?.click()}>
              Carregar a vaga de um PDF ou TXT
            </Botao>
          </div>
          {!erroDoCampo(gerar.error, "texto") && <ErroForm erro={gerar.error} />}
          <div className="linha">
            <Botao type="submit" className="botao primario">
              Gerar Raio-X
            </Botao>
          </div>
          {s.uso.limiteRaio !== null && (
            <p className="apoio">
              {s.uso.raioMes} de {s.uso.limiteRaio} Raio-X usados neste mês.
            </p>
          )}
        </form>
      )}
      <VagasAbertas bloqueado={limite} />
      <section className="pilha">
        <h2>Vagas salvas</h2>
        <ListaVagas />
      </section>
      {!s.ia.ativa && (
        <Vazio titulo="Análise por regras">
          Neste ambiente a IA está desligada, então os requisitos são lidos pelo motor de regras da DECIFRA. Ele reconhece as competências mais comuns de vagas de entrada.
        </Vazio>
      )}
      {s.ia.ativa && (
        <p className="fonte">
          <b aria-hidden="true">✦</b>A leitura da vaga usa IA ({s.ia.provedores.join(", ")}). Se a IA não responder, o motor de regras assume e o resultado indica isso.
        </p>
      )}
    </>
  );
}
