# 3.2 Estratégia de experimentação e validação

## Formato escolhido: MVP funcional em piloto

Usamos um **MVP funcional** (e não só um protótipo navegável) porque as hipóteses mais arriscadas dependem de **comportamento real ao longo do tempo**: se a pessoa volta, executa o plano, produz prova, chega à entrevista. Isso um protótipo clicável não mede. O MVP já registra esse comportamento e coleta feedback dentro do produto, sem precisar de formulários externos para o essencial.

- **Público do piloto**: adultos em transição para Análise de Dados (primeiro segmento), recrutados entre os participantes da pesquisa inicial e em comunidades de transição de carreira; 3 a 5 empresas ou recrutadores para o lado B2B.
- **Duração**: 8 semanas, com leitura das métricas a cada 2 semanas.
- **Tamanho mínimo**: 30 candidatos ativos (para as métricas com amostra mínima de 15 a 20) e 3 empresas. **[equipe]**: confirmar metas de recrutamento.

## Hipóteses, métricas e critérios

As hipóteses saem das dores da pesquisa e das apostas do modelo de negócio. Cada uma tem métrica, meta, amostra mínima e instrumento. As métricas são calculadas pelo próprio produto: `npm run admin -- metricas 30` (ou `--json`).

| # | Tipo | Hipótese | Métrica | Meta | Amostra mín. | Instrumento |
|---|---|---|---|---|---|---|
| H1 | Desejabilidade | A decisão do Raio-X faz sentido para a pessoa | % de "Sim" em "Esta decisão fez sentido para você?" | ≥ 70% | 20 respostas | Pergunta no Raio-X (com comentário opcional quando "Não") |
| H2 | Desejabilidade | Quem se cadastra chega ao primeiro Raio-X | % de cadastrados com diagnóstico e 1º Raio-X em até 7 dias | ≥ 60% | 20 cadastros | Registro automático |
| H3 | Desejabilidade | Quem tem plano executa ações (produz prova) | % de pessoas com tarefas que concluíram ao menos 1 | ≥ 40% | 15 pessoas | Plano de Evidências |
| H3b | Desejabilidade | Mini-projetos viram evidência | % de mini-projetos concluídos | ≥ 30% | 15 mini-projetos | Plano (mini-projeto concluído vira evidência) |
| H4 | Valor | Perfil de Evidências aumenta entrevistas | Taxa de candidaturas em "Entrevista"/"Proposta": com perfil público − sem perfil | ≥ +10 p.p. | 15 candidaturas por grupo | Quadro de candidaturas + perfil público |
| H5 | Desejabilidade | O Mentor ajuda | % de "Sim" em "Esta resposta ajudou?" | ≥ 60% | 20 respostas | Pergunta em cada resposta do Mentor |
| H5b | Desejabilidade | Sugestões do Mentor viram ação | % de ações sugeridas adicionadas ao Plano | ≥ 25% | 20 sugestões | Botão "Adicionar ao Plano" (confirmação explícita) |
| H6 | Viabilidade (B2B) | Empresas aceitam abrir vagas para transição | % de vagas publicadas com selo "Aberta a transição" | ≥ 50% | 5 vagas | Área da empresa |
| H7 | Viabilidade (custo) | IA gratuita sustenta o produto | % de chamadas de IA atendidas com sucesso (sem cair nas regras) | ≥ 80% | 50 chamadas | Registro de cada chamada de IA (provedor, nível, status) |
| H8 | Viabilidade (receita) | Há disposição a pagar pelo Plus | % dos ativos que aceitam pagar o preço testado | ≥ 10% | 30 ativos | **Fora do produto**: teste de preço com 2 faixas (pesquisa curta ou página de pré-venda) **[equipe]** |

**Critério de decisão**: a hipótese é **validada** quando atinge a meta com a amostra mínima. Abaixo da meta, a equipe investiga os comentários de "Não" e o comportamento e decide entre ajustar e repetir o teste, ou mudar a aposta. Com amostra insuficiente, não se tira conclusão (o relatório mostra "amostra insuficiente").

## Métodos complementares (qualitativos)

| Método | Para quê | Quando |
|---|---|---|
| Entrevistas de 20 min com 5 a 8 participantes do piloto | Entender o "porquê" dos números (ex.: por que a decisão não fez sentido) | Semanas 2 e 6 |
| Teste de usabilidade moderado (tarefa: "faça o Raio-X desta vaga e diga se vale se candidatar") | Encontrar fricções da jornada | Antes de abrir o piloto e na semana 4 |
| Conversas com recrutadores sobre Vagas Decifradas e perfis | Validar o lado B2B (H6) | Semanas 3 a 6 |

## Ética e privacidade do experimento

- Participação com **consentimento**; dados tratados conforme a LGPD (exportação e exclusão de conta já existem no produto).
- Métricas **agregadas**: nenhuma métrica usa o texto das pessoas; os comentários de feedback são lidos só pela equipe.
- A IA não envia currículo nem o contexto do Mentor a provedores que treinam com os dados.

## Status da validação (hoje)

| Frente | Status | Evidência disponível |
|---|---|---|
| Problema (dores) | **Validado na pesquisa inicial** | 23 candidatos e 3 recrutadores (seção 1.2) |
| Viabilidade técnica da solução | **Validada** | MVP funcional; 95 testes da API, 7 do frontend e E2E em desktop, tablet e celular; suíte executada também num PostgreSQL real; CI no GitHub |
| Viabilidade da IA gratuita (H7, técnica) | **Validada em ambiente local** | Avaliação real com modelo local gratuito (Ollama): todas as tarefas aprovadas pelas validações; instrução maliciosa embutida na vaga ignorada (ver [resultados](05-resultados-e-aprendizados.md)) |
| H1 a H6, H8 (comportamento e valor) | **Instrumentadas, coleta não iniciada** | Os instrumentos estão no produto; falta rodar o piloto **[equipe: atualizar quando o piloto começar]** |
