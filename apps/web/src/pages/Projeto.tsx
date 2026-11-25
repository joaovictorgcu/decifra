import { Link } from "react-router-dom";
import { Marca } from "../components/ui";
import { useSessao } from "../lib/sessao";

/**
 * Página pública do projeto (Status Report): negócio, proposta de valor,
 * solução, validação, aprendizados e plano. Só conteúdo com evidência;
 * o detalhamento completo está em docs/negocio no repositório.
 */

const DORES: [string, string, string][] = [
  ["47,8%", "dizem que as vagas pedem experiência que não têm", "Raio-X separa competência de exigência formal e mostra o que já é comprovado"],
  ["43,5%", "não sabem por onde começar nem o próximo passo", "Decisão por vaga, até 3 próximos passos, Plano com prazo e Radar da lacuna mais recorrente"],
  ["60,9%", "já trabalham em outra área, mas não usam essa experiência", "Tradutor de Experiência e evidências do tipo “caso da carreira anterior”"],
  ["5 de 13", "que se candidataram não chegaram a nenhuma entrevista", "Decidir antes de se candidatar; Perfil de Evidências; preparação para entrevista"],
  ["2 de 3", "recrutadores dizem que filtros eliminam esses candidatos", "Vagas revisadas pela empresa, selo “Aberta a transição” e desafios práticos"],
];

const CANVAS: [string, string][] = [
  ["Problema", "Vagas pedem experiência que a pessoa não tem; falta direção; a carreira anterior é desperdiçada."],
  ["Segmentos", "Adultos em transição para tecnologia e design (primeiro: Análise de Dados); empresas com vagas de entrada; escolas e bootcamps."],
  ["Proposta única de valor", "Prove o que você sabe fazer antes da primeira experiência na nova área: decisão fundamentada, não nota."],
  ["Solução", "Raio-X da Vaga, Banco e Plano de Evidências, Tradutor, Mentor com IA, Perfil de Evidências; para empresas, vagas revisadas, desafios e busca por competência comprovada."],
  ["Alternativas", "Comparadores de currículo por palavra-chave, cursos e bootcamps, mentoria individual, tentativa e erro."],
  ["Canais", "Comunidades de transição de carreira, parcerias com escolas e bootcamps, indicação via perfil compartilhado."],
  ["Receita", "Freemium (Plus por assinatura), assinatura para empresas, pacote por turma para escolas."],
  ["Custos", "Hospedagem e banco gerenciado; IA gratuita por padrão (paga só se ativada); aquisição; equipe."],
  ["Métricas-chave", "Ativação (1º Raio-X), plano executado, evidências documentadas, entrevistas, conversão para o Plus."],
  ["Vantagem", "Princípios no código: a IA não inventa experiência e a decisão vem de regras auditáveis; base de evidências e vagas revisadas que cresce com o uso."],
];

const HIPOTESES: [string, string, string][] = [
  ["H1", "A decisão do Raio-X faz sentido para a pessoa", "≥ 70% de “Sim” na pergunta do Raio-X"],
  ["H2", "Quem se cadastra chega ao primeiro Raio-X", "≥ 60% em até 7 dias"],
  ["H3", "Quem tem plano executa ações", "≥ 40% concluem ao menos 1 tarefa"],
  ["H4", "O Perfil de Evidências aumenta entrevistas", "+10 p.p. na taxa de entrevista"],
  ["H5", "O Mentor ajuda e suas sugestões viram ação", "≥ 60% úteis; ≥ 25% das sugestões aceitas"],
  ["H6", "Empresas abrem vagas para transição", "≥ 50% das vagas com selo"],
  ["H7", "IA gratuita sustenta o produto", "≥ 80% das chamadas atendidas"],
  ["H8", "Há disposição a pagar pelo Plus", "≥ 10% aceitam o preço testado"],
];

const APRENDIZADOS: [string, string][] = [
  ["A IA erra por omissão (deixou de fora um requisito desejável)", "A pessoa pode ajustar os requisitos e reanalisar; a decisão continua sendo das regras"],
  ["Modelos pequenos tendem a inventar conquistas e a sugerir “faça um curso”", "Validações descartam essas respostas; ações do Mentor só entram no Plano com confirmação"],
  ["Instrução maliciosa escondida numa vaga foi ignorada", "Mantidas as defesas: texto do usuário é tratado como dado e toda saída é validada"],
  ["IA gratuita na nuvem atende o dia a dia; modelo local é lento", "Groq como principal, Gemini só para dados não pessoais, Ollama para privacidade"],
];

const PLANO: [string, string, string][] = [
  ["Meses 1–3", "Piloto e validação de valor", "Publicar, recrutar 30 candidatos e 3 a 5 empresas, medir H1, H2, H3 e H5"],
  ["Meses 4–6", "Ajuste e receita", "Corrigir pelo feedback, testar preço (H8), cobrança online, primeira escola parceira"],
  ["Meses 7–9", "Lado da empresa e resultado", "Desafios com empresas, medir H4 e H6, novas áreas (UX/UI e Desenvolvimento)"],
  ["Meses 10–12", "Escala controlada", "Aquisição por parceiros, infraestrutura para crescer, escolha de modelos de IA por avaliação"],
];

export function Projeto() {
  const { sessao } = useSessao();
  return (
    <>
      <header className="faixa escuro">
        <div className="miolo">
          <div className="topo-l">
            <Marca />
            <Link className="botao claro peq" to={sessao ? "/inicio" : "/entrar?modo=cadastro&papel=candidato"}>
              {sessao ? "Abrir o app" : "Experimentar a DECIFRA"}
            </Link>
          </div>
          <div className="pilha" style={{ paddingBlock: "36px 56px", maxWidth: 760 }}>
            <p className="olho" style={{ color: "var(--agua)" }}>
              Sobre o projeto
            </p>
            <h1 tabIndex={-1}>Do problema à prova: como a DECIFRA foi pensada, construída e será validada</h1>
            <p className="sub" style={{ color: "#D5DEEA", fontSize: "1.125rem" }}>
              Modelo de negócio, proposta de valor, solução, estratégia de validação, aprendizados e plano para os próximos 12 meses. Tudo apoiado na pesquisa com 23 candidatos
              em transição e 3 recrutadores, e num produto que já funciona.
            </p>
            <nav aria-label="Seções" className="linha" style={{ gap: 8 }}>
              {[
                ["#problema", "Problema"],
                ["#valor", "Proposta de valor"],
                ["#negocio", "Modelo de negócio"],
                ["#solucao", "Solução"],
                ["#validacao", "Validação"],
                ["#aprendizados", "Aprendizados"],
                ["#plano", "Plano de 12 meses"],
              ].map(([href, r]) => (
                <a key={href} className="botao claro peq" href={href}>
                  {r}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main>
        <section className="faixa secao" id="problema">
          <div className="miolo pilha-g">
            <h2>1. O problema, com evidência</h2>
            <p className="leitura">
              Adultos em transição de carreira para tecnologia e design não conseguem <strong>demonstrar</strong> o que sabem de um jeito que vagas e recrutadores reconheçam.
              Por isso não sabem se devem se candidatar, o que fazer primeiro nem como usar a experiência anterior.
            </p>
            <div className="numeros">
              <p>
                <b>47,8%</b>dizem que as vagas pedem experiência que não têm.
              </p>
              <p>
                <b>43,5%</b>não sabem por onde começar nem o próximo passo.
              </p>
              <p>
                <b>60,9%</b>já trabalham em outra área, mas não usam essa experiência a seu favor.
              </p>
            </div>
            <p className="apoio leitura">Pesquisa da equipe com 23 candidatos em transição e 3 recrutadores. Amostra pequena: indica direção e por isso orienta as hipóteses do piloto.</p>
          </div>
        </section>

        <section className="faixa secao escuro" id="valor">
          <div className="miolo pilha-g">
            <h2>2. Proposta de valor: cada dor tem uma resposta</h2>
            <div className="pilha">
              {DORES.map(([n, dor, resp]) => (
                <div key={n} className="dif-linha">
                  <p>
                    <b style={{ color: "var(--agua)", fontSize: "1.5rem", fontWeight: 800 }}>{n}</b> {dor}
                  </p>
                  <p style={{ color: "#D5DEEA" }}>→ {resp}</p>
                </div>
              ))}
            </div>
            <p className="leitura" style={{ color: "#D5DEEA" }}>
              <strong style={{ color: "var(--branco)" }}>Diferencial:</strong> em vez de uma nota de compatibilidade por palavra-chave, uma <strong style={{ color: "var(--branco)" }}>decisão fundamentada</strong> (candidate-se agora, prepare evidências antes ou busque uma vaga mais compatível) e um plano para produzir a prova que falta. A DECIFRA nunca sugere declarar o que a pessoa não consegue demonstrar.
            </p>
          </div>
        </section>

        <section className="faixa secao" id="negocio">
          <div className="miolo pilha-g">
            <h2>3. Modelo de negócio (Lean Canvas)</h2>
            <div className="canvas">
              {CANVAS.map(([t, d]) => (
                <article key={t} className="cartao">
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
            <p className="apoio leitura">
              Lógica de valor: o produto <strong>cria</strong> valor transformando vaga, currículo e experiência em decisão e plano; <strong>entrega</strong> pela web e pelo perfil compartilhável; <strong>captura</strong> por freemium (limites do plano grátis já aplicados), assinatura de empresas e pacotes para escolas. Com IA gratuita por padrão, o plano grátis não queima caixa.
            </p>
          </div>
        </section>

        <section className="faixa secao" id="solucao" style={{ background: "var(--superficie)" }}>
          <div className="miolo pilha-g">
            <h2>4. A solução, funcionando</h2>
            <ol className="tres">
              <li>
                <h3>Conte seu momento</h3>
                <p>Diagnóstico de 6 perguntas define a etapa da transição e adapta o app.</p>
              </li>
              <li>
                <h3>Faça o Raio-X da vaga</h3>
                <p>Cada requisito é cruzado com suas evidências; a decisão vem de regras transparentes e testadas.</p>
              </li>
              <li>
                <h3>Produza a prova que falta</h3>
                <p>Ações viram tarefas com prazo; mini-projetos concluídos viram evidência; o Mentor acompanha.</p>
              </li>
            </ol>
            <div className="grade2">
              <article className="cartao">
                <h3>Requisitos técnicos atendidos</h3>
                <p>Aplicação web responsiva (React), API Node.js, PostgreSQL, IA multi-provedor gratuita com fallback, segurança revisada, conformidade LGPD (exportar e excluir dados).</p>
              </article>
              <article className="cartao">
                <h3>Qualidade verificada</h3>
                <p>Mais de 100 testes automatizados, testes de interface em desktop, tablet e celular, acessibilidade verificada e suíte executada num PostgreSQL real.</p>
              </article>
            </div>
            <p>
              <Link className="botao primario" to={sessao ? "/inicio" : "/entrar?modo=cadastro&papel=candidato"}>
                Experimentar agora
              </Link>
            </p>
          </div>
        </section>

        <section className="faixa secao" id="validacao">
          <div className="miolo pilha-g">
            <h2>5. Estratégia de validação</h2>
            <p className="leitura">
              Formato: <strong>MVP funcional em piloto de 8 semanas</strong>, porque as hipóteses mais arriscadas dependem de comportamento real (voltar, executar o plano, conseguir entrevista). Os instrumentos já estão dentro do produto: perguntas de feedback no Raio-X e no Mentor e métricas calculadas a partir do uso.
            </p>
            <div className="caixa-tab">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Hipótese</th>
                    <th scope="col">Critério de sucesso</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {HIPOTESES.map(([id, h, m]) => (
                    <tr key={id}>
                      <td className="req" data-r="Hipótese">
                        {id} · {h}
                      </td>
                      <td data-r="Critério de sucesso">{m}</td>
                      <td data-r="Status">{id === "H8" ? "Teste de preço planejado" : id === "H7" ? "Validada em ambiente local; aguarda piloto" : "Instrumentada; aguarda piloto"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="apoio leitura">Cada hipótese tem amostra mínima: sem ela, o relatório mostra “amostra insuficiente” e nenhuma conclusão é tirada. Complementos qualitativos: entrevistas e testes de usabilidade durante o piloto.</p>
          </div>
        </section>

        <section className="faixa secao escuro" id="aprendizados">
          <div className="miolo pilha-g">
            <h2>6. O que já aprendemos e o que mudamos</h2>
            <div className="dif">
              {APRENDIZADOS.map(([a, d]) => (
                <div className="pilha" style={{ gap: 6 }} key={a}>
                  <h3>{a}</h3>
                  <p className="contra">Decisão: {d}</p>
                </div>
              ))}
            </div>
            <p style={{ color: "#D5DEEA" }} className="leitura">
              Fragilidades assumidas: ainda não há dados de comportamento (o piloto vai gerá-los), a amostra da pesquisa é pequena e a cobrança online ainda não existe.
            </p>
          </div>
        </section>

        <section className="faixa secao" id="plano">
          <div className="miolo pilha-g">
            <h2>7. Plano para os próximos 12 meses</h2>
            <ol className="passos">
              {PLANO.map(([q, t, d]) => (
                <li key={q}>
                  <span>
                    <strong>
                      {q} · {t}.
                    </strong>{" "}
                    {d}
                  </span>
                </li>
              ))}
            </ol>
            <p className="apoio leitura">Cada etapa só avança se as hipóteses da anterior forem confirmadas. Riscos mapeados: decisão pouco útil, plano não executado, baixa adesão de empresas, limites de IA gratuita e baixa disposição a pagar, cada um com uma resposta planejada.</p>
            <div className="linha">
              <Link className="botao primario" to={sessao ? "/inicio" : "/entrar?modo=cadastro&papel=candidato"}>
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
