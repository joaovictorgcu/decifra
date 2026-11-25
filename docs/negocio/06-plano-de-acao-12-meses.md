# 4. Plano de ação: próximos 12 meses

Ponto de partida (hoje): MVP funcional e testado, instrumentado para validação, pronto para piloto. O plano segue a lógica **validar antes de escalar**. Cada fase só avança se as hipóteses da fase anterior forem confirmadas, com os critérios do [plano de experimentação](04-experimentacao-e-validacao.md).

Meses contados a partir da apresentação do Status Report 2. Responsáveis: **[equipe]**.

## Visão por trimestre

| Trimestre | Objetivo | Principais ações | Marco de saída (critério) |
|---|---|---|---|
| **T1 (meses 1–3): Piloto e validação de valor** | Confirmar que a decisão e o plano geram ação | 1. Publicar o MVP (Docker + PostgreSQL) com domínio e HTTPS. 2. Configurar IA gratuita (Groq; Gemini só para vagas). 3. Recrutar 30 candidatos (Análise de Dados) e 3 a 5 empresas. 4. Rodar o piloto de 8 semanas com leitura quinzenal das métricas. 5. Entrevistas e testes de usabilidade (semanas 2, 4, 6) | H1, H2, H3 e H5 com amostra mínima; decisão de seguir, ajustar ou mudar |
| **T2 (meses 4–6): Ajuste e receita** | Corrigir o que o piloto mostrou e testar disposição a pagar | 1. Priorizar melhorias pelos comentários de "Não" e pelo funil. 2. Teste de preço do Plus (H8) e de pacote para escolas. 3. Implantar cobrança online (provedor a escolher). 4. Verificação de e-mail e recuperação de senha. 5. Primeira parceria com escola ou bootcamp (turma piloto) | H8: ≥ 10% dos ativos dispostos a pagar no preço testado; 1 parceria assinada |
| **T3 (meses 7–9): Lado da empresa e prova de resultado** | Validar o B2B e o impacto em entrevistas | 1. Verificação de empresas (CNPJ ou domínio corporativo). 2. Desafios práticos com 3+ empresas. 3. Medir H4 (perfil público × entrevistas) com amostra suficiente. 4. Expandir o catálogo para UX/UI e Desenvolvimento | H4 e H6 atingidas; primeiras contratações relatadas por usuários |
| **T4 (meses 10–12): Escala controlada** | Crescer mantendo custo e qualidade | 1. Aquisição via parceiros e indicação (Perfil compartilhado). 2. Infraestrutura para várias instâncias (limites e disjuntor compartilhados, PostgreSQL gerenciado com backup). 3. Conjunto de avaliação com vagas reais para escolher modelos de IA por tarefa. 4. Mentor com mais ações (sempre com confirmação) | Meta de usuários ativos e receita definida no T2 **[equipe]**; custo de IA por usuário dentro do orçamento |

## Necessidades por frente

| Frente | Necessidades nos 12 meses |
|---|---|
| **Desenvolvimento** | Cobrança, verificação de e-mail e de empresas, armazenamento compartilhado de limites, painel de métricas para a equipe, catálogo de competências para novas áreas |
| **Validação** | Recrutamento do piloto, roteiros de entrevista e de usabilidade, leitura quinzenal das métricas, teste de preço |
| **Implementação** | Hospedagem (contêiner + PostgreSQL gerenciado), domínio, HTTPS, backups, monitoramento, política de privacidade e termos de uso |
| **Negócio** | Parcerias com escolas e bootcamps, aproximação com empresas para vagas e desafios, definição de preço, canais de aquisição |

## Riscos e respostas

| Risco | Sinal | Resposta |
|---|---|---|
| A decisão do Raio-X não é percebida como útil (H1 baixo) | % de "Não" alto e comentários recorrentes | Revisar as regras de decisão com os casos reais; mais transparência na justificativa |
| Pessoas não executam o plano (H3 baixo) | Tarefas paradas, sem mini-projetos concluídos | Tarefas menores, lembretes, uso do Mentor para destravar |
| Empresas não aderem (H6 baixo) | Poucas vagas publicadas ou sem selo | Começar via escolas e bootcamps (B2B2C) antes das empresas |
| Limites gratuitos de IA no piloto | Disjuntor em pausa, H7 abaixo de 80% | Somar provedores gratuitos (Gemini, OpenRouter), Ollama local, ou provedor pago só para tarefas complexas, com teto |
| Baixa disposição a pagar (H8) | < 10% | Receita via escolas e empresas; candidato fica no gratuito |

## Realismo

O plano parte de um **produto já funcional e testado**. Por isso o primeiro trimestre é de validação, e não de construção. As entregas técnicas de cada trimestre são incrementais sobre a arquitetura atual (ver [PROXIMOS_PASSOS.md](../PROXIMOS_PASSOS.md)), e o custo de IA pode ficar em zero durante o piloto.
