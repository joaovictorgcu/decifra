import { SITUACOES } from "@decifra/shared";
import { Link } from "react-router-dom";
import { CartoesPlanos } from "./Planos";
import { Etiqueta, Marca } from "../components/ui";
import { useSessao } from "../lib/sessao";

const DIFERENCIAIS = [
  ["Decisão, não nota", "Em vez de “73% de compatibilidade”, você recebe uma decisão fundamentada: candidate-se agora, prepare evidências antes ou busque uma vaga mais compatível."],
  ["Prova, não palavra-chave", "A DECIFRA nunca sugere incluir termos que você não consegue demonstrar. Ela ajuda a produzir evidências reais."],
  ["A carreira anterior conta", "O que você fez em outra área é traduzido em competências da nova função."],
  ["Cada etapa tem uma necessidade", "No começo falta direção. Depois, falta retorno das empresas. A plataforma se adapta ao seu momento."],
];

export function Landing() {
  const { sessao } = useSessao();
  const destinoApp = sessao ? (sessao.usuario.papel === "empresa" ? "/empresa/vagas" : "/inicio") : null;
  return (
    <>
      <header className="faixa escuro">
        <div className="miolo">
          <div className="topo-l">
            <Marca />
            <div className="linha" style={{ gap: 8 }}>
            <Link className="botao claro peq" to="/projeto">
              Sobre o projeto
            </Link>
            {destinoApp ? (
              <Link className="botao claro peq" to={destinoApp}>
                Abrir o app
              </Link>
            ) : (
              <Link className="botao claro peq" to="/entrar">
                Entrar
              </Link>
            )}
            </div>
          </div>
          <div className="heroi">
            <div className="pilha">
              <h1 tabIndex={-1}>Prove o que você sabe fazer antes da primeira experiência na nova área.</h1>
              <p className="sub">
                Para adultos em transição de carreira para tecnologia e design. Cole uma vaga e descubra o que você já comprova e qual é o próximo passo.
              </p>
              <div className="linha">
                <Link className="botao primario" to="/entrar?modo=cadastro&papel=candidato">
                  Sou candidato
                </Link>
                <Link className="botao claro" to="/entrar?modo=cadastro&papel=empresa">
                  Sou empresa
                </Link>
              </div>
            </div>
            <figure className="raio-demo" aria-label="Exemplo de Raio-X da Vaga">
              <p className="tit">Analista de Dados Júnior</p>
              <ul>
                <li>
                  SQL <Etiqueta {...SITUACOES.comprova} />
                </li>
                <li>
                  Power BI <Etiqueta {...SITUACOES.tem_precisa_mostrar} />
                </li>
                <li>
                  Análise de indicadores <Etiqueta {...SITUACOES.tem_precisa_mostrar} />
                </li>
                <li>
                  1 ano de experiência <Etiqueta {...SITUACOES.formal} />
                </li>
              </ul>
              <p className="dec ambar">
                <span aria-hidden="true">! </span>Prepare evidências antes
              </p>
            </figure>
          </div>
        </div>
      </header>
      <main>
        <section className="faixa secao">
          <div className="miolo pilha-g">
            <h2>O que ouvimos de 23 candidatos em transição e 3 recrutadores</h2>
            <div className="numeros">
              <p>
                <b>47,8%</b>dizem que as vagas pedem experiência que não têm.
              </p>
              <p>
                <b>43,5%</b>não sabem por onde começar nem qual é o próximo passo.
              </p>
              <p>
                <b>60,9%</b>já trabalham em outra área, mas não usam essa experiência a seu favor.
              </p>
            </div>
            <p className="leitura">
              Dos que se candidataram, 5 em 13 não chegaram a nenhuma entrevista. E 2 de 3 recrutadores dizem que filtros eliminam esses candidatos antes de chegarem até eles.
            </p>
          </div>
        </section>
        <section className="faixa secao escuro">
          <div className="miolo pilha-g">
            <h2>Por que não é mais um comparador de currículo</h2>
            <div className="dif">
              {DIFERENCIAIS.map(([t, d]) => (
                <div className="pilha" style={{ gap: 6 }} key={t}>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="faixa secao">
          <div className="miolo pilha-g">
            <h2>Como funciona</h2>
            <ol className="tres">
              <li>
                <h3>Conte seu momento</h3>
                <p>Um diagnóstico de 6 perguntas adapta a plataforma à sua etapa.</p>
              </li>
              <li>
                <h3>Faça o Raio-X da vaga</h3>
                <p>Cada requisito é cruzado com suas evidências e você recebe uma decisão.</p>
              </li>
              <li>
                <h3>Produza a prova que falta</h3>
                <p>As ações viram um plano com prazo, e cada entrega vira evidência. O Mentor DECIFRA acompanha você em cada passo.</p>
              </li>
            </ol>
          </div>
        </section>
        <section className="faixa secao" style={{ background: "var(--superficie)" }}>
          <div className="miolo pilha-g">
            <h2>Planos</h2>
            <CartoesPlanos />
            <div className="linha">
              <Link className="botao primario" to="/entrar?modo=cadastro&papel=candidato">
                Sou candidato
              </Link>
              <Link className="botao" to="/entrar?modo=cadastro&papel=empresa">
                Sou empresa
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
