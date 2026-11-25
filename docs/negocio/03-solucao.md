# 3.1 Proposta de solução

## O que é

A DECIFRA é uma **aplicação web** (desktop, tablet e celular) com dois lados:

- **Candidato**: descobre o que já comprova para uma vaga, recebe uma decisão fundamentada e produz as provas que faltam.
- **Empresa**: publica vagas com requisitos revisados e abertas a transição, propõe desafios práticos e encontra pessoas por competência comprovada.

## Como funciona (jornada do candidato)

```
1. Diagnóstico (6 perguntas) ──► etapa: Definindo o caminho | Construindo a base | Buscando a vaga
2. Banco de Evidências ◄── importar do currículo (IA) / Tradutor de Experiência / desafios / mini-projetos
3. Raio-X da Vaga: requisitos da vaga × evidências ──► situação por requisito ──► DECISÃO + justificativa + próximos passos
4. Plano de Evidências: ações com prazo; mini-projeto concluído vira evidência (volta ao passo 2)
5. Radar (Plus): lacunas que mais se repetem nas vagas desejadas
6. Candidaturas + Preparação para Entrevista (histórias STAR a partir das evidências)
7. Perfil de Evidências público: competências e provas para enviar ao recrutador
   Mentor DECIFRA (IA) acompanha todas as etapas, com o contexto da pessoa, e sugere ações que entram no Plano só com confirmação
```

A **decisão** do Raio-X é sempre calculada por um **motor de regras transparente e testado**:

- **"Candidate-se agora"**: todos os requisitos obrigatórios comprovados.
- **"Busque uma vaga mais compatível"**: metade ou mais das competências obrigatórias sem nenhuma evidência.
- **"Prepare evidências antes"**: nos demais casos.

Exigências formais (tempo de experiência, diploma) nunca contam como falta de competência. A IA só ajuda a **ler** textos (vaga, currículo, experiência anterior) e a **conversar**.

## Coerência entre problema, cliente, proposta e solução

| Problema (pesquisa) | Proposta de valor | Recurso da solução | Como medimos (hipótese) |
|---|---|---|---|
| 47,8%: vagas pedem experiência que não têm | Mostrar o que já comprova e separar exigência formal de competência | Raio-X (tipos de requisito, notas sobre exigência formal), selo da empresa | H1: decisão faz sentido |
| 43,5%: não sabem por onde começar | Próximo passo claro, curto e priorizado | Decisão + próximos passos, Plano com prazo, Radar, Mentor | H2: ativação; H3: execução do plano; H5: Mentor útil |
| 60,9%: não usam a experiência anterior | Traduzir o passado em competências da nova área | Tradutor de Experiência; evidência "caso da carreira anterior"; importar currículo | H3b: mini-projetos e evidências documentadas |
| 5 de 13 sem nenhuma entrevista | Candidatar-se melhor e com prova | Decisão antes de candidatar; Perfil de Evidências; Preparação para Entrevista | H4: perfil público aumenta entrevistas |
| 2 de 3 recrutadores: filtros eliminam | Empresas veem competência comprovada | Vagas Decifradas, selo, busca por evidência, desafios | H6: empresas abrem vagas para transição |

## 3.1.1 Requisitos técnicos e recursos mínimos

**Já construído (MVP funcional, código neste repositório):**

| Camada | Tecnologia | Por quê |
|---|---|---|
| Interface | React 19 + Vite, CSS do protótipo | Mantém a identidade visual; responsiva e acessível (testada com axe) |
| Servidor | Node.js 20+ / Fastify 5 / TypeScript | Um único processo serve API e interface |
| Banco | Prisma 7 + SQLite (desenvolvimento) / PostgreSQL (produção) | Zero configuração local; banco robusto em produção |
| IA | Groq, Gemini, OpenRouter, Ollama (gratuitos); Anthropic e OpenAI opcionais | Custo de IA pode ser zero; fallback entre provedores e para regras |
| Qualidade | 95 testes da API, 7 do frontend, 31 E2E em 3 tamanhos de tela, testes num PostgreSQL real, lint, CI | Funcionalidades verificadas, não só implementadas |
| Implantação | Vercel + Supabase (recomendado); Dockerfile + docker-compose como alternativa | Publicação simples a partir do GitHub |

**Recursos mínimos para operar o piloto:**

| Recurso | Mínimo | Custo estimado |
|---|---|---|
| Hospedagem | Vercel (interface + API serverless) + Supabase (PostgreSQL), configuração pronta no repositório | R$ 0 nos planos gratuitos para o piloto (Vercel Hobby é para uso não comercial; o Supabase Free pausa após 1 semana sem uso). Para operação comercial: planos pagos **[equipe: cotar]** |
| IA | Chave gratuita do Groq (e/ou Gemini); Ollama opcional | R$ 0 dentro dos limites gratuitos (Groq ~1.000 requisições/dia por modelo) |
| Domínio e HTTPS | 1 domínio | **[equipe]** |
| Pessoas | Produto/negócio, desenvolvimento, pesquisa/UX | Equipe do projeto |

**O que ainda falta para escalar** (ver [plano de ação](06-plano-de-acao-12-meses.md)):

- cobrança online;
- verificação de e-mail e recuperação de senha;
- verificação de empresas;
- armazenamento compartilhado de limites, quando houver mais de uma instância.

Detalhes técnicos: [ARQUITETURA.md](../ARQUITETURA.md), [IA.md](../IA.md), [API.md](../API.md).
