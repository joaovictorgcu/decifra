import { AREAS, type AreaId } from "@decifra/shared";
import { Link } from "react-router-dom";
import { useCandidaturas, useEvidencias, useTarefas } from "../api/consultas";
import { ListaVagas } from "./RaioX";
import { Cabecalho, Esqueleto } from "../components/ui";
import { plural } from "../lib/formato";
import { useSessaoAtiva } from "../lib/sessao";

export function Inicio() {
  const s = useSessaoAtiva();
  const p = s.perfil!;
  const tarefas = useTarefas();
  const evs = useEvidencias();
  const cands = useCandidaturas();
  const area = AREAS[p.destino as AreaId];

  const ts = tarefas.data ?? [];
  const feitas = ts.filter((t) => t.status === "feito").length;
  const pct = ts.length ? Math.round((feitas / ts.length) * 100) : 0;
  const prox = ts.find((t) => t.status !== "feito");

  let bloco: [string, string, string];
  if (prox) bloco = [prox.titulo, "Abrir o Plano", "/plano"];
  else if (p.etapa === "Definindo o caminho") bloco = [`Faça o Raio-X de uma vaga de entrada em ${area?.nome} para entender o que ela pede.`, "Fazer um Raio-X", "/raio-x"];
  else if (p.etapa === "Construindo a base") bloco = ["Registre um projeto ou curso como evidência, com problema, o que fez, ferramentas e resultado.", "Registrar evidência", "/evidencias/nova"];
  else bloco = ["Cole uma vaga que você quer e veja a decisão para ela.", "Fazer um Raio-X", "/raio-x"];

  const lista = evs.data ?? [];
  const cs = cands.data ?? [];

  return (
    <>
      <Cabecalho titulo={`Olá, ${s.usuario.nome}`} selo={`Etapa atual: ${p.etapa}`} />
      <section className="foco escuro">
        <p className="olho">Próximo passo recomendado</p>
        {tarefas.isLoading ? <p>Carregando seu plano…</p> : <h2>{bloco[0]}</h2>}
        <Link className="botao primario" to={bloco[2]}>
          {bloco[1]}
        </Link>
      </section>
      <div className="grade2">
        <section className="cartao">
          <h2>Plano de Evidências</h2>
          <div className="barra" role="img" aria-label={`${pct}% concluído`}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <p>
            {feitas} de {plural(ts.length, "tarefa feita", "tarefas feitas")}.
          </p>
          <Link className="link" to="/plano">
            Abrir o Plano
          </Link>
        </section>
        {p.etapa === "Definindo o caminho" && (
          <section className="cartao">
            <h2>Vagas de entrada em {area?.nome}</h2>
            <p>O que costuma aparecer: {area?.tipico}.</p>
            <p className="apoio">Referência geral para orientar. Confirme sempre na vaga real.</p>
            <Link className="link" to="/tradutor">
              Traduzir minha experiência
            </Link>
          </section>
        )}
        {p.etapa === "Construindo a base" && (
          <section className="cartao">
            <h2>Transforme estudo em evidência</h2>
            <p>
              {lista.filter((e) => e.completa).length} de {plural(lista.length, "evidência está completa", "evidências estão completas")}.
            </p>
            <Link className="link" to="/evidencias">
              Ver minhas evidências
            </Link>
          </section>
        )}
        {p.etapa === "Buscando a vaga" && (
          <section className="cartao">
            <h2>Suas candidaturas</h2>
            <p>
              {cs.length} em andamento, {cs.filter((x) => x.etapa === "Entrevista").length} em entrevista.
            </p>
            <div className="linha">
              <Link className="link" to="/candidaturas">
                Ver quadro
              </Link>
              <Link className="link" to="/entrevista">
                Preparar entrevista
              </Link>
            </div>
          </section>
        )}
        <section className="cartao">
          <h2>Mentor DECIFRA</h2>
          <p>Tire dúvidas sobre sua transição com quem conhece suas evidências, vagas e plano.</p>
          <Link className="link" to="/mentor">
            Conversar com o Mentor
          </Link>
        </section>
      </div>
      <section className="pilha">
        <h2>Vagas salvas</h2>
        {tarefas.isLoading ? <Esqueleto linhas={2} /> : <ListaVagas />}
      </section>
      <p>
        <Link className="link" to="/diagnostico">
          Refazer o diagnóstico
        </Link>
      </p>
    </>
  );
}
