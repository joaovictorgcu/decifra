# Arquitetura

## Visão geral

```
Navegador (React SPA)
   │  fetch /api/*  (cookie de sessão httpOnly, cabeçalho x-decifra)
   │  SSE  /api/mentor/mensagens
   ▼
API Fastify ── ServicoIA (roteador + fallback + disjuntor + privacidade) ──► Groq | Gemini | OpenRouter | Ollama
   │                                                                     └─► Anthropic | OpenAI (opcionais, pagos)
   │  módulos de rota → domínio (motor de regras) + tarefas de IA
   ▼
Prisma ──► SQLite (local) / PostgreSQL (produção)
```

Em produção, um único processo Node serve a API e o build estático do frontend (mesma origem: sem CORS, cookies simples).

## Decisões e justificativas

| Decisão | Alternativas consideradas | Por quê |
|---|---|---|
| **TypeScript ponta a ponta** com monorepo npm workspaces | Python no backend | O motor do protótipo já era JS; portar para TS manteve a lógica idêntica e permitiu compartilhar schemas e tipos (`packages/shared`) entre API e interface |
| **Fastify 5** | Express, NestJS | Mais rápido que Express, validação/plugins maduros (helmet, rate-limit, cookie, multipart), sem o peso de um framework opinativo |
| **Zod** em `packages/shared` | Validação só no servidor | A mesma regra valida o formulário e a API, com mensagens em português |
| **Prisma + SQLite** local, **PostgreSQL** em produção | Postgres em Docker desde o início | Zero configuração para rodar localmente (o ambiente não tem Docker). Listas ficam em JSON-texto para o schema ser portável; migrar é trocar o `provider` (ver [MODELO_DE_DADOS.md](MODELO_DE_DADOS.md)) |
| **Sessões opacas no banco** | JWT | Revogáveis (logout real, troca de senha encerra outras sessões), sem segredo de assinatura para gerenciar |
| **scrypt nativo** para senhas | bcrypt/argon2 | Sem dependência nativa (instala em qualquer SO), parâmetros fortes (N=16384, r=8) |
| **React + React Router + TanStack Query** | Manter HTML/JS puro | Componentes reutilizáveis, rotas reais, cache e revalidação automáticos. O CSS original foi mantido, então a identidade não muda |
| **Motor de regras como fallback da IA** | IA obrigatória | O produto funciona sem chave de API, com custo zero e de forma determinística; a IA melhora a cobertura, mas nunca é ponto único de falha |
| **IA multi-provedor com roteamento determinístico** | Um provedor fixo; um "modelo roteador" | Gratuitos (Groq, Gemini, OpenRouter, Ollama) no dia a dia e pago só quando configurado e necessário; a escolha usa regras testáveis, sem chamada extra de IA (ver [IA.md](IA.md)) |
| **Cliente único compatível com OpenAI** | Um SDK por fornecedor | Groq, Gemini, OpenRouter, Ollama e OpenAI expõem a mesma API; as diferenças (parâmetro de limite, formato JSON, cabeçalhos) ficam no catálogo. Anthropic usa o SDK oficial |

## Backend (`apps/api`)

- `src/config/env.ts`: variáveis validadas com Zod na inicialização; configuração inválida derruba o processo com mensagem clara.
- `src/app.ts`: monta o Fastify (helmet com CSP, cookie, rate limit, multipart, autenticação, proteção CSRF, tratamento de erros) e registra os módulos.
- `src/plugins/auth.ts`: sessão por cookie e guardas `exigirLogin`, `exigirCandidato`, `exigirEmpresa`, `exigirPlus`.
- `src/modules/*`: rotas por domínio. Toda consulta filtra pelo dono (`userId`/`companyId`), então um usuário não acessa dados de outro (testado).
- `src/domain/*`: motor de análise puro (sem framework, sem banco): extração de requisitos, cruzamento, decisão, justificativa, ações, radar, tradutor, histórias, feedback e guarda de princípios.
- `src/ai/*`: camada de IA: catálogo, configuração, roteador, disjuntor, serviço, privacidade, tarefas e provedores (ver [IA.md](IA.md)).
- `src/lib/*`: erros de negócio (`ErroApp` com status e código estáveis), senha, tokens, leitura de PDF/TXT, mapeamentos banco → contrato.

### Regras de negócio principais

- Raio-X: limite de 3 por mês no plano grátis (contado por eventos de uso no mês corrente); ilimitado no Plus.
- Decisão do Raio-X é **recalculada a cada leitura** a partir das evidências atuais: documentar uma evidência muda a decisão de todas as vagas.
- Ações do Raio-X vão ao Plano sem duplicar. Mini-projeto marcado como feito cria uma evidência uma única vez.
- Uma candidatura por vaga; uma entrega por desafio e pessoa; entregas fora do prazo são recusadas.
- Selo "Aberta a transição de carreira": nenhuma exigência formal obrigatória sem aceitação de experiência aplicada.
- Perfil público é opcional e privado por padrão; a busca de empresas só vê perfis publicados e nunca expõe e-mail.
- Mentor: limite diário de mensagens por plano (configurável).

### Datas e fuso horário

Prazos, "hoje" e a virada das cotas (Raio-X por mês, Mentor e IA por dia) seguem `APP_TZ` (padrão `America/Sao_Paulo`), e não o fuso do servidor. Sem isso, num servidor em UTC, um prazo "de hoje" passaria a ser recusado às 21h de Brasília. Implementação em `src/lib/datas.ts`, com testes inclusive de horário de verão.

### Qualidade de código

- `npm run lint`: ESLint com typescript-eslint e regras de hooks do React (zero avisos tolerados no CI).
- `npm run typecheck`, `npm test` (API e frontend) e `npm run test:e2e`.

### Tratamento de erros e logs

- Erros de negócio respondem `{ erro, codigo, campo? }` com status adequado (400, 401, 402 para plano, 403, 404, 409, 422, 429, 503).
- Erros inesperados respondem 500 genérico e são registrados com stack no log (pino). Cabeçalhos de cookie/autorização e campos de senha são mascarados.
- Cada tentativa de IA é registrada em `AiInteraction` (tarefa, nível, provedor, modelo, tentativa, status, latência, tokens), sem guardar o conteúdo enviado. `npm run admin -- uso-ia 7` resume por tarefa, nível e provedor.

## Frontend (`apps/web`)

- `src/api/cliente.ts`: `fetch` com cabeçalho anti-CSRF, erros tipados (`ErroRequisicao`), envio de arquivo e leitor de SSE do Mentor.
- `src/api/consultas.ts`: hooks de consulta (TanStack Query). Mutações revalidam os dados, porque uma evidência nova muda Raio-X, radar e sugestões.
- `src/components/`: `BarreiraErro` (erro de renderização não deixa a tela em branco), `Casca` (menu lateral/barra inferior), `ui.tsx` (campos com erro acessível, botões com carregamento, estados vazios/erro/carregando, etiquetas), `Confirmar` (diálogo nativo), `Markdown` (renderização segura das respostas da IA, sem `innerHTML`).
- `src/pages/`: uma página por tela; rotas carregadas sob demanda (code splitting).
- Rotas protegidas por papel; candidato sem diagnóstico é levado ao diagnóstico.

## Segurança

| Ameaça | Mitigação |
|---|---|
| Senhas vazadas | scrypt com sal; comparação em tempo constante; login não revela se o e-mail existe (mesma mensagem e mesmo custo de hash) |
| Roubo de sessão | Token aleatório de 256 bits em cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção; banco guarda só o SHA-256 |
| CSRF | Vale para qualquer caminho (o roteador decodifica `/%61pi/...`). Escrita exige o cabeçalho `x-decifra` (força preflight, nunca liberado a outras origens) e Origin igual a `APP_ORIGIN` |
| XSS | React escapa tudo; respostas da IA renderizadas sem HTML; links de evidência aceitos só com `http(s)://`; CSP restritiva |
| Acesso indevido (IDOR) | Toda consulta filtra pelo dono; testes cobrem acesso cruzado entre usuários e papéis |
| Força bruta / abuso | Login: 10 tentativas/min por IP e bloqueio de 15 min por e-mail após 5 senhas erradas (vale para ataques distribuídos em vários IPs). Rate limit global (300/min) e por rota (IA 5–15/min); `TRUST_PROXY` por número de saltos (X-Forwarded-For forjado não burla o limite) |
| Custo de IA | Teto diário de chamadas por usuário (`AI_LIMITE_DIARIO`, acima dele usa regras); limite diário do Mentor por plano |
| Upload malicioso | Até 4 MB (`UPLOAD_MAX_MB`; a Vercel limita o corpo a 4,5 MB), 1 arquivo; tipo conferido pelo conteúdo (`%PDF-`); nada é gravado em disco |
| Prompt injection | Dados do usuário (e textos de empresas) delimitados por marcações e tratados como dado; saída validada por schema e por guardas; a IA só pode apontar evidências que existem e pertencem à pessoa; links importados precisam existir no documento. Testado com instrução maliciosa real em vaga |
| Privacidade na IA | E-mail, telefone e CPF removidos antes do envio; tarefas sensíveis (Mentor, currículo) só em provedores que não treinam com os dados; política configurável (`AI_PRIVACIDADE`) |
| Chaves de IA | Só no backend; nunca em respostas HTTP, no navegador ou nos logs (o log mostra só provedores e rotas) |
| Redirecionamento aberto | `?volta=` aceita só caminhos internos |
| Segredos | Só em variáveis de ambiente; `.env` no `.gitignore`; `.env.example` sem valores |
| LGPD | Exportação de todos os dados (inclui o histórico de uso da IA, só metadados) e exclusão de conta em cascata |

Uma revisão de segurança independente foi feita durante o desenvolvimento; os achados corrigidos têm testes de regressão em `apps/api/test/api.test.ts`. Pontos aceitos conscientemente estão em [PROXIMOS_PASSOS.md](PROXIMOS_PASSOS.md).

Dependências com alertas do `npm audit` no momento: `effect` e `deepmerge-ts` (vindos do CLI do Prisma, usado só em desenvolvimento/migração) e `esbuild` do `tsup` (só no servidor de desenvolvimento do tsup, que não usamos). Nenhum entra no build de produção da API ou do frontend.
