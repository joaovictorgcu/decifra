# Camada de Inteligência Artificial

## 1. Onde a IA agrega valor real na DECIFRA

A proposta da DECIFRA é transformar texto desestruturado (vagas, currículos, relatos de experiência, respostas de entrevista) em **decisões e próximos passos baseados em evidência**. É exatamente onde modelos de linguagem são fortes, e onde o motor de regras do protótipo tinha limites (só reconhece ~40 competências de um catálogo fixo e frases em formatos previsíveis).

A IA **não substitui** o motor de decisão: a decisão do Raio-X continua sendo calculada por regras transparentes e testadas. A IA entra para **ler melhor** e **conversar melhor**.

| Funcionalidade | O que a IA faz | Sem IA | Por que faz sentido |
|---|---|---|---|
| **Raio-X da Vaga** | Extrai requisitos de qualquer vaga, classifica (técnica/comportamental/formal), separa obrigatório de desejável e aponta qual evidência sustenta cada requisito | Motor de regras com catálogo | Vagas reais têm redação livre e competências fora de qualquer catálogo |
| **Vagas Decifradas (empresa)** | Mesma extração, para a empresa revisar | Motor de regras | Reduz o trabalho manual de estruturar a vaga |
| **Importar do currículo** | Lê PDF/TXT e propõe rascunhos de evidências | Indisponível (aviso na tela) | Automação: registrar evidências era a tarefa manual mais trabalhosa |
| **Tradutor de Experiência** | Traduz funções antigas em competências da área de destino | Tabela de equivalências | Linguagem natural, área de destino variável |
| **Histórias STAR** | Escreve a história usando só os dados da evidência | Modelo de frase com lacunas marcadas | Texto fluido sem inventar fatos |
| **Feedback de entrevista** | Avalia clareza, objetividade e estrutura | Heurísticas de tamanho e palavras | Feedback específico para a resposta |
| **Mentor DECIFRA** | Assistente conversacional com o contexto real da pessoa e histórico | Indisponível (aviso na tela) | Responde "e agora?", a dor de 43,5% dos entrevistados na pesquisa |

## 2. Arquitetura

```
Rota (módulo) ──► tarefa de IA (ai/tarefas.ts)
                     │  prompt versionado (ai/prompts.ts)
                     │  schema Zod da saída
                     ▼
               ServicoIA (ai/servico.ts)
                 • escolhe o modelo por tarefa
                 • timeout e cancelamento
                 • registra uso/latência/status (AiInteraction)
                     ▼
               ProvedorIA (interface)
     ┌───────────────┼──────────────────┬──────────────┐
 Anthropic      OpenAI / compatível     Mock (testes)   nenhum
 (SDK oficial)  (OpenAI, Ollama, ...)                   → motor de regras
                     ▼
     validação Zod + guardas de princípio + validação de domínio
                     ▼
     sucesso → resultado "ia"   |   qualquer falha → motor de regras ("regras")
```

Pontos que permitem evoluir sem reestruturar:

1. **Interface única `ProvedorIA`** (`gerarJSON` e `conversar`). Um novo provedor (Gemini, Bedrock, Azure, modelo interno) é uma classe nova e uma linha em `criarProvedor`.
2. **Roteamento de modelo por tarefa** sem mudar código: `AI_MODEL` (principal), `AI_MODEL_FAST` (tarefas rápidas) e `AI_MODEL_<TAREFA>` (ex.: `AI_MODEL_MENTOR`). Dá para usar um modelo barato para extração e um forte para o Mentor, ou um modelo local para tarefas sensíveis.
3. **Tarefas isoladas**: cada tarefa tem prompt, schema e validação próprios; mudar uma não afeta as outras.
4. **Fallback obrigatório**: toda tarefa estruturada devolve `null` em qualquer falha (timeout, limite, recusa, JSON inválido, violação de princípio) e a rota usa o motor de regras. A interface mostra a origem do resultado.
5. **Observabilidade**: tabela `AiInteraction` + `npm run admin -- uso-ia` (chamadas, tokens, latência, falhas por tarefa e modelo).
6. **Prompts versionados** em `ai/prompts.ts` (`PROMPT_VERSAO`).

### Saída estruturada

- **Anthropic**: structured outputs nativos (`client.beta.messages.parse` + `zodOutputFormat`), com fallback de recusa do lado do servidor (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) nos modelos que suportam. Desligue com `ANTHROPIC_FALLBACKS=off`.
- **OpenAI e compatíveis**: modo JSON (`response_format: json_object`) com o JSON Schema no prompt, validação Zod e uma tentativa de correção. Funciona em OpenAI, Ollama, LM Studio, vLLM e OpenRouter.

### Mentor (conversa)

- Streaming por **Server-Sent Events** (`POST /api/mentor/mensagens`), com botão "Parar" que cancela a chamada ao provedor.
- Contexto montado a cada mensagem a partir do banco: diagnóstico, evidências (e se estão completas), vagas com decisão e lacunas, tarefas abertas e candidaturas. Até 12 mil caracteres.
- Histórico persistido (`Conversation`/`Message`); as últimas 20 mensagens vão ao modelo.
- Limite diário por plano (`AI_MENTOR_LIMITE_GRATIS`, `AI_MENTOR_LIMITE_PLUS`).

## 3. Guardas e princípios

Os princípios do protótipo viraram regras aplicadas em três camadas:

1. **Prompt** (`PRINCIPIOS`): não inventar experiência, separar habilidade de exigência formal, não prometer vaga nem afirmar política de empresa, não recomendar "faça um curso" genérico, PT-BR sem travessão, tratar conteúdo marcado como dado.
2. **Validação de saída**: schema Zod, limites de tamanho, deduplicação; a função `violaPrincipios` descarta respostas que prometem contratação ou afirmam o que a empresa aceita.
3. **Validação de domínio**:
   - a IA só pode ligar um requisito a evidências **que existem e são da própria pessoa**;
   - links de evidências importadas só são aceitos se **aparecem literalmente no documento**;
   - histórias STAR só usam IA quando a evidência está completa (senão o modelo teria de inventar);
   - a decisão do Raio-X é sempre calculada pelo motor de regras.

**Prompt injection**: todo texto do usuário vai entre marcações (`<vaga>`, `<documento>`...), com instrução explícita de que é dado; tentativas de fechar a marcação são neutralizadas. Mesmo que o modelo seja manipulado, ele não tem ferramentas, não acessa dados de outras pessoas (o contexto só contém dados do próprio usuário) e a saída passa pelas validações acima.

**Privacidade**: o conteúdo enviado à IA não é armazenado em `AiInteraction` (só metadados). Os provedores comerciais recebem os textos da pessoa, então isso deve constar na política de privacidade. Para dados que não podem sair da infraestrutura, use um modelo local (`openai-compatible` + Ollama/vLLM), inclusive só para algumas tarefas (`AI_MODEL_<TAREFA>` com outro provedor é uma evolução simples: ver seção 6).

## 4. Comparação de alternativas

| Critério | Anthropic (Claude) | OpenAI | Open source local (Ollama/vLLM: Llama, Qwen, Mistral) |
|---|---|---|---|
| Qualidade em PT-BR e em seguir regras | Muito alta | Muito alta | Boa nos modelos grandes; varia muito nos pequenos |
| Saída estruturada | Nativa (schema garantido) | Nativa | Modo JSON; precisa de validação e correção |
| Custo | Por token (tabela abaixo) | Por token (ver página de preços da OpenAI) | Sem custo por token; custo de GPU/servidor e operação |
| Privacidade | Dados saem para o provedor (política de retenção do provedor) | Idem | Dados ficam na sua infraestrutura |
| Latência | Baixa a média; streaming | Baixa a média; streaming | Depende do hardware |
| Facilidade | SDK oficial, sem infraestrutura | SDK oficial, sem infraestrutura | Exige servidor com GPU para modelos bons |
| Integração na DECIFRA | `AI_PROVIDER=anthropic` | `AI_PROVIDER=openai` | `AI_PROVIDER=openai-compatible` |

Preços Anthropic por milhão de tokens (entrada / saída), conforme a tabela oficial em novembro de 2026:

| Modelo | Entrada | Saída | Uso sugerido |
|---|---|---|---|
| `claude-opus-5-5` (padrão) | US$ 4 | US$ 20 | Mentor, importação de currículo, histórias |
| `claude-sonnet-5-5` | US$ 2 | US$ 10 | Alternativa equilibrada para todas as tarefas |
| `claude-haiku-5-5` | US$ 0,10 | US$ 0,50 | Extração de requisitos, tradutor e feedback (`AI_MODEL_FAST`) |

Estimativa de ordem de grandeza: um Raio-X usa ~1,5 mil tokens de entrada e ~0,5 mil de saída (mais o raciocínio interno do modelo). Com Haiku em `AI_MODEL_FAST`, isso fica em frações de centavo por Raio-X; uma mensagem do Mentor com Opus, com o contexto da pessoa, fica na casa de 1 a 3 centavos de dólar. Meça o custo real com `npm run admin -- uso-ia` antes de definir preços dos planos.

**Recomendação**: começar com Anthropic (`claude-opus-5-5` como principal e avaliar `claude-haiku-5-5` em `AI_MODEL_FAST` comparando a qualidade da extração em vagas reais), manter o motor de regras como fallback e reservar o caminho open source para clientes institucionais (escolas e bootcamps) que exijam que os dados não saiam da infraestrutura.

## 5. Testes da camada de IA

- `apps/api/test/api.test.ts` usa um **provedor fake** para testar: uso da IA quando disponível, fallback quando falha, descarte de respostas que violam princípios, rejeição de evidências de outra pessoa, remoção de links inventados, streaming e erro no Mentor, registro em `AiInteraction`.
- O E2E (Playwright) usa `AI_PROVIDER=mock`, determinístico e **bloqueado em produção**.
- Antes de trocar de modelo, rode um conjunto de vagas e currículos reais nos dois modelos e compare a extração (cobertura de requisitos, classificação formal/técnica, obrigatório/desejável).

## 6. Como evoluir

- **Novo provedor**: implementar `ProvedorIA` em `src/ai/providers/` e registrar em `criarProvedor`.
- **Provedor por tarefa** (ex.: Mentor no Claude, extração em modelo local): trocar o `provedor` único do `ServicoIA` por um mapa tarefa → provedor; as rotas não mudam.
- **Nova funcionalidade de IA**: criar prompt em `prompts.ts`, schema e função em `tarefas.ts` (devolvendo `null` em falha), adicionar o perfil em `PERFIS` e chamar a partir do módulo.
- **Mentor com ações** (ex.: "adicione esse mini-projeto ao meu plano"): expor ferramentas (tool use) que chamam os mesmos serviços das rotas, com confirmação da pessoa antes de gravar.
- **Busca semântica de candidatos e vagas**: embeddings das evidências e requisitos (pgvector no PostgreSQL).
- **Avaliação contínua**: guardar (com consentimento) pares vaga → requisitos revisados pela empresa como conjunto de avaliação da extração.
