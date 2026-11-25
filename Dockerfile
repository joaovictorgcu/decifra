# syntax=docker/dockerfile:1
# Imagem de produção da DECIFRA: API + frontend estático num único processo, com PostgreSQL.

# ---------- Build ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
# O cliente Prisma é gerado para PostgreSQL (o prisma.config.ts escolhe o schema pela URL).
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---------- Execução ----------
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    WEB_DIST=/app/apps/web/dist \
    APP_TZ=America/Sao_Paulo
# Dependências de produção (após npm prune), cliente Prisma gerado para PostgreSQL e builds.
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/apps/api
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3333)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Aplica as migrações pendentes e sobe o servidor.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
