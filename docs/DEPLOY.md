# Deploy em produção

## Opção recomendada: Vercel + Supabase (gratuito para começar)

Um único projeto na Vercel serve a interface (arquivos estáticos) e a API (uma função serverless em `api/index.mjs`); o Supabase fornece o PostgreSQL. A configuração já está no repositório (`vercel.json`, `scripts/vercel-build.mjs`, `scripts/vercel-env.mjs`).

### Passo a passo

1. **Supabase**: crie um projeto em supabase.com (anote a senha do banco). Em **Connect**, copie:
   - *Transaction pooler* (porta **6543**) → `DATABASE_URL` (usada pela aplicação);
   - *Session pooler* (porta **5432**) → `DIRECT_URL` (usada só para as migrações no build).
2. **Chaves e segredos**: copie `.env.producao.exemplo` para `.env.producao` (já ignorado pelo git) e preencha as duas URLs, trocando a senha, e a `GROQ_API_KEY` (gratuita). Não cole segredos em chats.
3. **Vercel** (na raiz do repositório):
   ```bash
   npx vercel login            # abre o navegador
   npx vercel link             # cria/vincula o projeto (escolha a raiz do repositório)
   node scripts/vercel-env.mjs # envia as variáveis do .env.producao (production e preview)
   npx vercel --prod           # build: interface + API + migrações no Supabase
   ```
   Alternativa sem CLI: em vercel.com > New Project > importe o repositório do GitHub (raiz do repositório, sem mudar o framework) e cadastre as variáveis do `.env.producao` em Settings > Environment Variables, incluindo `NODEJS_HELPERS=0`.
4. Abra o domínio que a Vercel mostrar. Depois do primeiro deploy, cada push na `main` publica sozinho.

### O que o projeto já faz por você na Vercel

- **Padrões de produção** (sobrescrevíveis): `NODE_ENV=production`, cookie `Secure`, `TRUST_PROXY=1` e `APP_ORIGIN` igual ao domínio de produção. Os domínios de preview também são aceitos pela proteção de origem.
- **Migrações** (`prisma migrate deploy`) só nos deploys de **produção**; previews nunca alteram o banco.
- **PostgreSQL em serverless**: 1 conexão por instância, SSL ligado (`PG_SSL=require`; `verify` com `PG_SSL_CA` para validar o certificado), e parâmetros que são do Prisma/Supabase (`pgbouncer`, `sslmode`) removidos antes de chegar ao driver.
- **Limites da plataforma**: upload de até 4 MB (a Vercel aceita 4,5 MB por requisição); o streaming do Mentor manda um "batimento" a cada 15 s e a função tem até 300 s (plano Hobby).

### Limites dos planos gratuitos

- **Supabase Free**: 500 MB de banco e 2 projetos ativos. **O projeto pausa após 1 semana sem uso**: reative pelo painel, ou mantenha o uso durante o piloto.
- **Vercel Hobby**: uso pessoal e não comercial, com funções de até 300 s.
- **Se o PostgreSQL recusar conexões pelo pooler de transação** (prepared statements): use a URL do *Session pooler* (5432) também em `DATABASE_URL`. Com 1 conexão por instância, isso funciona bem para o volume de um piloto.

Validação feita antes do primeiro deploy real:

- o handler serverless foi exercitado localmente, emulando a Vercel (saúde, cadastro, origem de preview, streaming do Mentor e limite de upload);
- a suíte completa da API passa num PostgreSQL real;
- o deploy na nuvem em si depende da sua conta Vercel e do projeto Supabase.

---

## Outras opções

A DECIFRA roda como **um único processo Node** que serve a API e o frontend estático. Funciona em qualquer plataforma que rode Node 20+ (Render, Railway, Fly.io, uma VM com PM2/systemd, contêiner).

## Opção 1: Docker (recomendado)

```bash
docker compose up --build
```

Sobe o PostgreSQL e a aplicação (imagem multi-stage `node:24-bookworm-slim`, usuário sem privilégios, healthcheck em `/api/saude`). Ao iniciar, o contêiner roda `prisma migrate deploy` e depois o servidor. Para a nuvem, use o `Dockerfile` com um PostgreSQL gerenciado e defina as variáveis abaixo.

> O `Dockerfile` e o `docker-compose.yml` ainda não foram executados com Docker nesta máquina (Docker não instalado). O mesmo caminho de produção foi validado fora do contêiner: cliente PostgreSQL gerado, build, `prisma migrate deploy` e `node dist/server.js` num PostgreSQL real.

## Opção 2: Node direto


```bash
npm ci
npm run build                 # gera apps/web/dist e apps/api/dist
npm run db:deploy             # aplica as migrações
npm start
```

## Variáveis obrigatórias em produção

| Variável | Exemplo | Observação |
|---|---|---|
| `NODE_ENV` | `production` | Liga cookie `Secure`, HSTS e logs em JSON |
| `HOST` / `PORT` | `0.0.0.0` / `3333` | |
| `APP_ORIGIN` | `https://decifra.app` | Precisa ser exatamente a origem pública (CSRF) |
| `WEB_DIST` | `../web/dist` | Caminho do build do frontend, relativo a `apps/api` |
| `DATABASE_URL` | `postgresql://...` | Recomendado PostgreSQL (ver [MODELO_DE_DADOS.md](MODELO_DE_DADOS.md)) |
| `TRUST_PROXY` | `1` | Número de proxies na frente da API |
| `APP_TZ` | `America/Sao_Paulo` | Fuso dos prazos e das cotas diárias; não depende do fuso do servidor (que costuma ser UTC) |
| Chaves de IA (opcional) | `GROQ_API_KEY`, `GEMINI_API_KEY`... | Guarde no cofre de segredos da plataforma, nunca no repositório. Sem chave, o produto roda pelo motor de regras (ver [IA.md](IA.md)) |

## Checklist

- [ ] HTTPS terminado no proxy/plataforma.
- [ ] `APP_ORIGIN` igual ao domínio público.
- [ ] Banco PostgreSQL com backup automático.
- [ ] Sessões expiradas são removidas automaticamente a cada hora (o comando `npm run admin -- limpar-sessoes` continua disponível).
- [ ] Monitorar `npm run admin -- uso-ia` e definir alerta de gasto no painel do provedor de IA.
- [ ] Política de privacidade informando o uso de provedores de IA.
- [ ] Mais de uma instância? Configure um armazenamento compartilhado para o rate limit (o padrão é em memória, por instância).
