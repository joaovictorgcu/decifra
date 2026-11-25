# DECIFRA

> Prove o que você sabe fazer antes da primeira experiência na nova área.

A DECIFRA é uma plataforma para **adultos em transição de carreira para tecnologia e design**. Em vez de dar uma "nota de compatibilidade" com a vaga, ela cruza cada requisito com as **evidências** que a pessoa consegue demonstrar e devolve uma **decisão fundamentada**: _candidate-se agora_, _prepare evidências antes_ ou _busque uma vaga mais compatível_. As lacunas viram um plano com prazo, e cada entrega vira uma nova evidência.

Este repositório transforma o protótipo HTML original ([`prototype/DECIFRA.html`](prototype/DECIFRA.html)) em uma aplicação completa: frontend React, API Node.js, banco de dados, autenticação e uma camada de Inteligência Artificial multi-provedor.

## Funcionalidades

**Candidato**
- **Diagnóstico** de 6 perguntas que classifica a etapa da transição e adapta a tela inicial.
- **Banco de Evidências** (projetos, cursos, certificados, casos da carreira anterior), com indicação do que falta para cada evidência ficar bem documentada.
- **Importar do currículo** (PDF/TXT) com IA: a IA propõe rascunhos de evidências usando só o que está escrito; a pessoa revisa e escolhe o que salvar.
- **Raio-X da Vaga**: extração de requisitos (IA com fallback para motor de regras), cruzamento com as evidências, decisão, justificativa e próximos passos. Aceita colar o texto ou enviar PDF.
- **Vagas publicadas na DECIFRA**: Raio-X de vagas revisadas pelas próprias empresas, com os pesos e decisões delas.
- **Plano de Evidências**: ações do Raio-X viram tarefas com prazo; mini-projeto concluído vira evidência automaticamente.
- **Tradutor de Experiência**: funções da carreira anterior traduzidas em competências da nova área.
- **Radar de Vagas** (Plus): requisitos que se repetem e qual lacuna resolver primeiro.
- **Candidaturas**: quadro por etapa, ligado ao Raio-X de cada vaga.
- **Preparação para Entrevista** (Plus): histórias STAR a partir das evidências e feedback de respostas.
- **Mentor DECIFRA** (IA): assistente conversacional em streaming que conhece o contexto real da pessoa, adaptado à etapa, com histórico, sugestões iniciais, cancelamento e indicação do modelo usado.
- **Perfil de Evidências**: página pública opcional (privada por padrão) para enviar no lugar de um currículo genérico.
- **Minha conta**: troca de senha, exportação de dados e exclusão de conta (LGPD).

**Empresa**
- **Vagas Decifradas**: análise da vaga, revisão de obrigatório × desejável, decisão sobre exigências formais e selo "Aberta a transição de carreira".
- **Desafios práticos**: entregas viram evidência para o candidato e triagem para a empresa.
- **Busca por competências comprovadas** (apenas perfis que os candidatos publicaram).

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, React Router 7, TanStack Query 5, Vite 8, CSS original do protótipo |
| Backend | Node.js 20+, Fastify 5, Zod 4, TypeScript |
| Banco | Prisma 6 + SQLite (local) / PostgreSQL (produção) |
| IA | Groq, Google Gemini, OpenRouter e Ollama (gratuitos); Anthropic e OpenAI (opcionais); roteamento por tarefa e complexidade com fallback; motor de regras sem IA |
| Testes | Vitest (domínio + integração da API), Playwright + axe-core (E2E, acessibilidade, desktop e celular) |

Detalhes e justificativas em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Como executar localmente

Pré-requisitos: **Node.js 20.19+** e npm 10+.

```bash
git clone https://github.com/joaovictorgcu/decifra.git
cd decifra
cp .env.example .env          # ajuste se quiser ativar a IA
npm install
npm run db:migrate            # cria o banco SQLite e aplica as migrações
npm run dev                   # API em :3333 e app em http://localhost:5173
```

Abra http://localhost:5173, crie uma conta de candidato ou de empresa e use normalmente. Não há dados fictícios: tudo o que aparece foi criado por você.

### Inteligência Artificial (sem custo obrigatório)

**Sem nenhuma chave**, o produto funciona inteiro com o **motor de regras** (Raio-X, Tradutor, histórias e feedback). O Mentor e a importação de currículo aparecem indisponíveis, com explicação na tela.

Para ligar a IA de graça, escolha uma ou mais opções no `.env`:

```bash
# Groq: gratuito, não treina com seus dados (chave em console.groq.com/keys)
GROQ_API_KEY=gsk_...

# Google Gemini: gratuito; no plano grátis o Google pode usar os dados, por isso
# a DECIFRA não envia currículo nem o contexto do Mentor para ele (chave em aistudio.google.com/apikey)
GEMINI_API_KEY=AIza...

# Ollama: local, nada sai da sua máquina (ollama.com; depois: ollama pull qwen2.5:7b-instruct)
OLLAMA_MODEL=qwen2.5:7b-instruct

# OpenRouter: modelos ":free" de vários fornecedores (chave em openrouter.ai/keys)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=<um modelo terminado em :free>
```

Anthropic (`ANTHROPIC_API_KEY`) e OpenAI (`OPENAI_API_KEY`) continuam suportados para quem quiser usar a própria chave. Com `AI_AVANCADO=anthropic`, eles ficam reservados às tarefas complexas.

O roteador escolhe o provedor e o modelo por tarefa e complexidade, tenta o próximo provedor quando um falha ou atinge o limite gratuito, respeita a privacidade e mostra na tela qual modelo gerou cada resultado. Para validar as chaves com chamadas reais (só provedores gratuitos, por padrão):

```bash
npm run avaliar:ia -w @decifra/api
```

Guia completo (provedores, modelos, limites gratuitos, privacidade e exemplos): [docs/IA.md](docs/IA.md).

### Ativando o plano Plus

A cobrança online ainda não existe (decisão de produto pendente, ver [docs/PROXIMOS_PASSOS.md](docs/PROXIMOS_PASSOS.md)). Para liberar o Plus para um usuário:

```bash
npm run admin -- plano pessoa@email.com plus
```

Outros comandos: `npm run admin -- uso-ia 7` (uso e latência da IA nos últimos 7 dias) e `npm run admin -- limpar-sessoes`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | API (com recarga) + Vite com proxy de `/api` |
| `npm run build` | Build do frontend (`apps/web/dist`) e da API (`apps/api/dist`) |
| `npm start` | Sobe a API compilada (serve o frontend se `WEB_DIST` estiver definido) |
| `npm run db:migrate` | Cria/aplica migrações em desenvolvimento |
| `npm run db:deploy` | Aplica migrações em produção |
| `npm run typecheck` | Verificação de tipos de todos os pacotes |
| `npm test` | Testes unitários, de integração e de roteamento da IA (79 testes, sem chamadas reais) |
| `npm run avaliar:ia -w @decifra/api` | Avaliação real das tarefas de IA nos provedores configurados (ignora pagos sem `--permitir-pagos`) |
| `npm run test:e2e` | Testes de interface (Playwright) em desktop, tablet e celular. Rode `npm run build` antes. Na primeira vez: `npx playwright install chromium` |

## Estrutura

```
decifra/
├── apps/
│   ├── api/                  # Backend Fastify
│   │   ├── prisma/           # schema.prisma e migrações
│   │   ├── src/
│   │   │   ├── ai/           # camada de IA: catálogo, config, roteador, disjuntor, serviço, provedores, prompts, tarefas
│   │   │   ├── domain/       # motor de análise (Raio-X, radar, regras) sem dependência de framework
│   │   │   ├── modules/      # rotas HTTP por domínio (auth, vagas, evidências, mentor, empresa...)
│   │   │   ├── plugins/      # autenticação e guardas de acesso
│   │   │   ├── lib/          # erros, senha, tokens, arquivos, mapeamentos
│   │   │   ├── config/       # variáveis de ambiente validadas
│   │   │   └── scripts/      # CLI administrativo
│   │   └── test/             # Vitest
│   └── web/                  # Frontend React
│       └── src/
│           ├── api/          # cliente HTTP, SSE e consultas
│           ├── components/   # componentes reutilizáveis (Casca, ui, Confirmar, Markdown)
│           ├── pages/        # telas do candidato, públicas e da empresa
│           └── styles/       # CSS do protótipo + componentes novos
├── packages/shared/          # constantes, schemas Zod e tipos usados por API e web
├── e2e/                      # Playwright
├── prototype/DECIFRA.html    # protótipo original, preservado como referência
└── docs/                     # documentação
```

## Documentação

- [Análise do protótipo](docs/ANALISE_PROTOTIPO.md): telas, fluxos, o que era simulado e o que foi corrigido.
- [Arquitetura](docs/ARQUITETURA.md): tecnologias, decisões, backend, frontend e segurança.
- [Camada de IA](docs/IA.md): onde a IA agrega valor, provedores, custos, guardas e como evoluir.
- [API](docs/API.md): endpoints e contratos.
- [Modelo de dados](docs/MODELO_DE_DADOS.md): entidades e migração para PostgreSQL.
- [Deploy](docs/DEPLOY.md): como publicar em produção.
- [Próximos passos](docs/PROXIMOS_PASSOS.md): decisões de produto pendentes.
