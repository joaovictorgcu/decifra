# API

Base: `/api`. JSON em todas as rotas (exceto upload em `multipart/form-data` e o stream do Mentor em `text/event-stream`).

**Autenticação**: cookie `decifra_sessao` (httpOnly) criado no cadastro/login.
**Escrita** (POST/PUT/PATCH/DELETE): exige o cabeçalho `x-decifra: 1`; se houver `Origin`, deve ser igual a `APP_ORIGIN`.
**Erros**: `{ "erro": "mensagem para o usuário", "codigo": "estavel", "campo"?: "nome_do_campo" }`.

| Status | Quando |
|---|---|
| 400 `validacao` | Entrada inválida (mensagem e `campo`) |
| 401 `nao_autenticado` / `credenciais` | Sem sessão / login incorreto |
| 402 `plano` | Recurso do Plus ou limite do plano grátis |
| 403 `papel` / `csrf` / `origem` | Papel errado ou requisição sem proteção |
| 404 `nao_encontrado` | Não existe ou não pertence a você |
| 409 | Conflito (e-mail em uso, candidatura duplicada, entrega duplicada, prazo encerrado) |
| 413 / 415 / 422 | Arquivo grande, tipo não suportado, PDF ilegível, vaga sem requisitos |
| 429 `limite` / `limite_mentor` / `ia_cota` / `ia_limite` | Rate limit, cota do Mentor, cota diária de IA do usuário, limite do provedor gratuito |
| 503 `ia_desativada` / `ia_privacidade` / `ia_indisponivel` | Sem provedor configurado; nenhum permitido pela política de privacidade; todos falharam ou estão em pausa |

## Autenticação e conta

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/cadastro` | `{ nome, email, senha, papel: "candidato"\|"empresa" }` → `Sessao` (201) |
| POST | `/auth/login` | `{ email, senha }` → `Sessao` |
| POST | `/auth/logout` | Encerra a sessão atual |
| GET | `/auth/sessao` | `Sessao`: usuário, perfil, uso (Raio-X no mês, Mentor no dia) e status da IA |
| PATCH | `/conta` | `{ nome }` |
| POST | `/conta/senha` | `{ senhaAtual, novaSenha }`; encerra todas as sessões e emite uma nova |
| GET | `/conta/exportar` | Download JSON com todos os dados do usuário |
| DELETE | `/conta` | `{ senha }`; exclui conta e dados em cascata |

## Candidato

| Método | Rota | Descrição |
|---|---|---|
| PUT | `/perfil/diagnostico` | 6 respostas → etapa da transição |
| PATCH | `/perfil/publico` | `{ publico: boolean }` |
| GET / POST | `/evidencias` | Listar / criar evidência |
| GET / PUT / DELETE | `/evidencias/:id` | Detalhe / atualizar / excluir |
| POST | `/evidencias/importar/analisar` | Upload PDF/TXT (campo `arquivo`) → `{ rascunhos }` (IA) |
| POST | `/evidencias/importar` | `{ evidencias: [...] }` salva os rascunhos escolhidos |
| POST | `/arquivos/texto` | Upload PDF/TXT → `{ nome, texto }` (nada é armazenado) |
| GET | `/vagas` | Vagas salvas com a decisão atual |
| POST | `/vagas` | `{ titulo?, texto }` → Raio-X completo (consome 1 Raio-X do mês) |
| GET / DELETE | `/vagas/:id` | Raio-X recalculado com as evidências atuais / excluir |
| POST | `/vagas/:id/plano` | Leva as ações ao Plano → `{ adicionadas }` |
| GET | `/vagas-abertas` | Vagas publicadas por empresas |
| POST | `/vagas-abertas/:id/raio` | Raio-X de uma vaga publicada (idempotente) |
| GET | `/radar` | Plus. `{ itens, prioridade, totalVagas }` |
| GET | `/tarefas` | Plano de Evidências |
| PATCH | `/tarefas/:id` | `{ status?, prazo? }` → `{ tarefa, evidenciaCriadaId }` (mini-projeto feito vira evidência) |
| DELETE | `/tarefas/:id` | Remove tarefa |
| POST | `/tarefas/mini` | `{ competencia }` adiciona mini-projeto |
| GET | `/plano/sugestoes` | Lacunas técnicas sem mini-projeto no Plano |
| GET / POST | `/candidaturas` | Listar / registrar `{ vagaId }` |
| PATCH / DELETE | `/candidaturas/:id` | `{ etapa }` / remover |
| POST | `/tradutor` | `{ entrada }` → `{ itens, fonte }` |
| POST | `/tradutor/evidencia` | `{ entrada, competencias }` → evidência |
| GET / POST | `/historias` | Plus. Listar / gerar `{ pergunta, evidenciaId }` |
| DELETE | `/historias/:id` | Remover |
| POST | `/entrevista/feedback` | Plus. `{ pergunta, resposta }` → `Feedback` |
| GET | `/desafios` | Desafios abertos (e os que você entregou) |
| POST | `/desafios/:id/entregas` | `{ link }` → entrega + evidência |
| GET | `/mentor/conversas` | Conversas do Mentor |
| GET / DELETE | `/mentor/conversas/:id` | Mensagens / excluir |
| GET | `/mentor/sugestoes` | Perguntas iniciais pela etapa e pelos dados da pessoa |
| POST | `/mentor/acoes` | `{ mensagemId, indice }`: adiciona ao Plano uma ação sugerida pelo Mentor (uma vez só) |
| PATCH / DELETE | `/vagas/:id/requisitos/:reqId` | `{ obrig }` muda o peso / remove o requisito (vagas da empresa não podem ser alteradas) |
| POST | `/vagas/:id/requisitos` | `{ nome, tipo, kind?, obrig }` adiciona requisito que ficou de fora |
| POST | `/vagas/:id/reanalisar` | Lê a vaga de novo com IA (não consome Raio-X do mês) |
| POST | `/feedback` | `{ alvo: "raio" \| "mentor", refId, util, comentario? }` (instrumento de validação) |
| POST | `/mentor/mensagens` | `{ conversaId?, mensagem }` → **SSE** |

### Stream do Mentor (SSE)

```
event: inicio   data: {}
event: meta     data: {"ia":"Groq · gpt-oss-120b"}  (quando o 1º trecho chega)
event: trecho   data: {"t":"texto parcial"}        (vários)
event: fim      data: {"conversaId":"...","titulo":"...","mensagem":{...MensagemMentor}}
event: erro     data: {"erro":"mensagem","codigo":"ia_limite"}   (em caso de falha)
```

A troca só é gravada quando há resposta. Se o cliente fechar a conexão (botão "Parar"), o trecho já gerado é gravado com `interrompida: true`.

Resultados com IA trazem `fonte` (`ia` | `regras` | `empresa`) e `ia` (provedor e modelo, ex.: `"Groq · gpt-oss-120b"`), em vagas, traduções, histórias, feedback e importação.

## Empresa

| Método | Rota | Descrição |
|---|---|---|
| POST | `/empresa/vagas/analisar` | `{ titulo, texto }` → rascunho com requisitos |
| POST | `/empresa/vagas` | `{ titulo, texto, requisitos: [{..., obrig, aceita}] }` publica (selo calculado no servidor) |
| GET | `/empresa/vagas` | Vagas da empresa, com nº de Raio-X de candidatos |
| PATCH / DELETE | `/empresa/vagas/:id` | `{ publicada }` / excluir |
| GET / POST | `/empresa/desafios` | Desafios com entregas / publicar `{ titulo, vaga, competencia, descricao, prazo }` |
| DELETE | `/empresa/desafios/:id` | Excluir |
| PATCH | `/empresa/entregas/:id` | `{ triagem: ""\|"avancar"\|"nao" }` |
| GET | `/empresa/candidatos?q=` | Perfis públicos com a competência comprovada |

## Público

| Método | Rota | Descrição |
|---|---|---|
| GET | `/publico/perfis/:slug` | Perfil de Evidências (404 se privado, exceto para o dono) |
| GET | `/saude` | Verificação de saúde (inclui o banco) |

Os tipos de resposta estão em [`packages/shared/src/types.ts`](../packages/shared/src/types.ts) e os schemas de entrada em [`packages/shared/src/schemas.ts`](../packages/shared/src/schemas.ts).
