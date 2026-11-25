# Modelo de dados

Definido em [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). Todas as entidades de um usuário são apagadas em cascata quando a conta é excluída.

```
User ─┬─ Session (n)                 sessões revogáveis (hash do token)
      ├─ CandidateProfile (0..1)     diagnóstico, etapa, slug e visibilidade do perfil público
      ├─ Evidence (n)                Banco de Evidências
      ├─ Job (n) ── JobRequirement (n)        vagas analisadas no Raio-X e seus requisitos
      │      └── Application (0..1)           candidatura da vaga
      ├─ Task (n)                    Plano de Evidências (ligada a Job e/ou Evidence)
      ├─ InterviewStory (n)          histórias STAR
      ├─ Conversation (n) ── Message (n)      Mentor
      ├─ UsageEvent (n)              consumo de Raio-X e Mentor (limites por plano)
      ├─ AiInteraction (n)           auditoria de IA (metadados, sem conteúdo)
      ├─ Feedback (n)                "fez sentido?" do Raio-X e "ajudou?" do Mentor
      │
      │  (papel empresa)
      ├─ CompanyJob (n) ── CompanyJobRequirement (n)   Vagas Decifradas
      │      └── Job (n)                               Raio-X de candidatos sobre a vaga
      └─ Challenge (n) ── Submission (n) ── User (candidato)
```

## Entidades

| Entidade | Campos principais | Regras |
|---|---|---|
| `User` | email (único), passwordHash, nome, papel (`candidato`/`empresa`), plano (`gratis`/`plus`) | e-mail normalizado em minúsculas |
| `Session` | tokenHash (único), expiresAt, userAgent | expira em `SESSION_TTL_DAYS` |
| `CandidateProfile` | destino, origem, situacao, tempo, candidatou, atrapalha (JSON), etapa, publico, slug (único) | privado por padrão |
| `Evidence` | titulo, tipo, concluido, link, competencias (JSON), problema, fez, ferramentas, resultado, origem | `origem`: manual, tradutor, mini, desafio, importacao |
| `Job` | titulo, empresa, texto, fonte (`ia`/`regras`/`empresa`), iaDescricao?, ajustada, companyJobId? | a decisão não é gravada: é recalculada com as evidências atuais |
| `JobRequirement` | ordem, requisito, curto, tipo, kind, obrig, evId?, aceita | `aceita` copiado da decisão da empresa |
| `Task` | titulo, prazo (AAAA-MM-DD), status, tipo (`mini`/`doc`/`verificar`/`mentor`), comp, evId?, virou | `virou` evita criar a evidência duas vezes |
| `Application` | jobId (único), etapa | uma por vaga |
| `InterviewStory` | pergunta, evidencia, situacao, tarefa, acao, resultado, fonte | |
| `UsageEvent` | tipo (`raio_x`/`mentor`), createdAt | contado por mês/dia |
| `Conversation` / `Message` | titulo / papel, conteudo, iaDescricao?, interrompida, acoes (JSON) | ações do Mentor só são executadas com confirmação |
| `CompanyJob` / `CompanyJobRequirement` | selo, publicada / obrig, aceita | selo calculado no servidor |
| `Challenge` / `Submission` | prazo / link, triagem; único (challengeId, candidateId) | |
| `AiInteraction` | tarefa, nível, provedor, modelo, tentativa, status, latenciaMs, tokens, erro | não guarda prompt nem resposta |
| `Feedback` | alvo (`raio` / `mentor`), refId, util, comentário | instrumento das hipóteses H1 e H5; único por pessoa e item |

## Por que listas em JSON-texto

`competencias` e `atrapalha` são listas curtas lidas sempre junto com o registro. Guardá-las como texto JSON mantém o schema idêntico em SQLite e PostgreSQL. Se for preciso consultar por competência em escala (busca de candidatos com muitos perfis), a evolução natural é uma tabela `EvidenceSkill` ou uma coluna `jsonb` com índice GIN no PostgreSQL.

## SQLite e PostgreSQL (Prisma 7)

- **Fonte única**: `apps/api/prisma/schema.prisma` (SQLite). O schema de PostgreSQL (`prisma/postgres/schema.prisma`) é **gerado** por `npm run schema:postgres -w @decifra/api`.
- **Escolha do banco**: o `prisma.config.ts` escolhe schema e pasta de migrações pela `DATABASE_URL` (`file:` → SQLite; `postgres://` → PostgreSQL). Em tempo de execução, `src/lib/db.ts` escolhe o adaptador (`@prisma/adapter-better-sqlite3` ou `@prisma/adapter-pg`).
- **Cliente gerado** em `apps/api/generated/prisma` (fora do git), sempre do banco da `DATABASE_URL` no momento do `prisma generate`. A imagem Docker gera para PostgreSQL.

### Ao mudar um modelo

1. Edite `prisma/schema.prisma`.
2. SQLite: `npm run db:migrate -- --name <nome>` (cria a migração e gera o cliente).
3. PostgreSQL:
   ```bash
   cp prisma/postgres/schema.prisma /tmp/antigo.prisma
   npm run schema:postgres -w @decifra/api
   mkdir prisma/postgres/migrations/<AAAAMMDDHHMMSS>_<nome>
   npx prisma migrate diff --from-schema /tmp/antigo.prisma --to-schema prisma/postgres/schema.prisma --script -o prisma/postgres/migrations/<pasta>/migration.sql
   ```
4. `npm run test:postgres -w @decifra/api` valida as migrações e a suíte num PostgreSQL real.

O teste `schema:postgres -- --verificar` falha se o schema de PostgreSQL estiver desatualizado (usado no CI).
