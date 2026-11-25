# Deploy em produção

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
