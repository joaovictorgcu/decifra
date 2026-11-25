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
| `Job` | titulo, empresa, texto, fonte (`ia`/`regras`/`empresa`), companyJobId? | a decisão não é gravada: é recalculada com as evidências atuais |
| `JobRequirement` | ordem, requisito, curto, tipo, kind, obrig, evId?, aceita | `aceita` copiado da decisão da empresa |
| `Task` | titulo, prazo (AAAA-MM-DD), status, tipo (`mini`/`doc`/`verificar`), comp, evId?, virou | `virou` evita criar a evidência duas vezes |
| `Application` | jobId (único), etapa | uma por vaga |
| `InterviewStory` | pergunta, evidencia, situacao, tarefa, acao, resultado, fonte | |
| `UsageEvent` | tipo (`raio_x`/`mentor`), createdAt | contado por mês/dia |
| `Conversation` / `Message` | titulo / papel, conteudo | |
| `CompanyJob` / `CompanyJobRequirement` | selo, publicada / obrig, aceita | selo calculado no servidor |
| `Challenge` / `Submission` | prazo / link, triagem; único (challengeId, candidateId) | |
| `AiInteraction` | tarefa, provedor, modelo, status, latenciaMs, tokens, erro | não guarda prompt nem resposta |

## Por que listas em JSON-texto

`competencias` e `atrapalha` são listas curtas lidas sempre junto com o registro. Guardá-las como texto JSON mantém o schema idêntico em SQLite e PostgreSQL. Se for preciso consultar por competência em escala (busca de candidatos com muitos perfis), a evolução natural é uma tabela `EvidenceSkill` ou uma coluna `jsonb` com índice GIN no PostgreSQL.

## Migrar para PostgreSQL

1. Em `schema.prisma`, troque `provider = "sqlite"` por `provider = "postgresql"`.
2. Apague a pasta `prisma/migrations` (as migrações são específicas do banco) e gere a migração inicial do Postgres:
   ```bash
   DATABASE_URL="postgresql://usuario:senha@host:5432/decifra" npx prisma migrate dev --name inicial -w @decifra/api
   ```
3. Faça commit da nova pasta `migrations`. Em produção use `npm run db:deploy`.

Nenhum código da aplicação muda.
