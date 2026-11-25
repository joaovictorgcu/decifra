import { LIMITE_RAIO_GRATIS } from "@decifra/shared";
import { Link } from "react-router-dom";
import { Casca } from "../components/Casca";
import { Cabecalho, Marca } from "../components/ui";
import { useSessao } from "../lib/sessao";

const PLANOS: [string, string, string[]][] = [
  ["Candidato grátis", "R$ 0", ["Diagnóstico", `${LIMITE_RAIO_GRATIS} Raio-X por mês`, "Banco de Evidências", "Perfil de Evidências", "Mentor DECIFRA com limite diário"]],
  ["Candidato Plus", "Assinatura mensal", ["Raio-X ilimitado", "Radar de Vagas", "Preparação para Entrevista", "Mentor DECIFRA com mais mensagens", "Revisão do portfólio por mentor"]],
  ["Empresa", "Assinatura", ["Vagas Decifradas", "Busca por evidências", "Desafios práticos"]],
  ["Escolas e bootcamps", "Pacote por turma", ["Pacote de empregabilidade", "Acompanhamento por turma"]],
];

export function CartoesPlanos() {
  return (
    <div className="planos">
      {PLANOS.map(([t, p, itens], i) => (
        <article className={`plano ${i === 1 ? "dest" : ""}`} key={t}>
          <h3>{t}</h3>
          <p className="apoio">{p}</p>
          <ul>
            {itens.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function Conteudo() {
  const { sessao } = useSessao();
  return (
    <>
      <Cabecalho titulo="Planos" sub="Escolha o acesso que faz sentido para o seu momento." />
      <CartoesPlanos />
      {sessao?.usuario.papel === "candidato" && (
        <section className="cartao">
          <h2>Seu plano: {sessao.usuario.plano === "plus" ? "Candidato Plus" : "Candidato grátis"}</h2>
          {sessao.usuario.plano === "plus" ? (
            <p>Você tem acesso a todos os recursos do Plus.</p>
          ) : (
            <p className="apoio leitura">
              A contratação online do Plus ainda não está aberta. Durante o programa piloto, a equipe DECIFRA ativa o Plus para os participantes. Este mês você
              usou {sessao.uso.raioMes} de {LIMITE_RAIO_GRATIS} Raio-X do plano grátis.
            </p>
          )}
        </section>
      )}
    </>
  );
}

export function Planos() {
  const { sessao } = useSessao();
  if (sessao)
    return (
      <Casca>
        <Conteudo />
      </Casca>
    );
  return (
    <>
      <div className="faixa escuro">
        <div className="miolo topo-l">
          <Marca />
          <Link className="botao claro peq" to="/entrar">
            Entrar
          </Link>
        </div>
      </div>
      <main className="faixa secao">
        <div className="miolo pilha-g">
          <Conteudo />
        </div>
      </main>
    </>
  );
}
