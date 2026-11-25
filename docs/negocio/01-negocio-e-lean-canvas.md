# 1. Negócio e modelo de negócios

> Status Report 2. Fontes: pesquisa da equipe com **23 candidatos em transição de carreira e 3 recrutadores** (números na landing do produto), protótipo original (`prototype/DECIFRA.html`) e o MVP construído neste repositório. Itens marcados **[equipe]** dependem de informação que só a equipe tem e precisam ser completados antes da apresentação.

## 1.1 O negócio em uma frase

A DECIFRA ajuda adultos em transição de carreira para tecnologia e design a **provar o que sabem fazer antes da primeira experiência na nova área**: cruza cada requisito de uma vaga com as evidências reais da pessoa, devolve uma **decisão fundamentada** (candidate-se agora, prepare evidências antes, busque uma vaga mais compatível) e transforma as lacunas num plano de evidências com prazo.

## 1.2 Problema

O que a pesquisa mostrou (23 candidatos, 3 recrutadores):

| Evidência | Leitura |
|---|---|
| **47,8%** dizem que as vagas pedem experiência que não têm | A barreira percebida é "experiência", não falta de estudo |
| **43,5%** não sabem por onde começar nem qual é o próximo passo | Falta direção e priorização |
| **60,9%** já trabalham em outra área, mas não usam essa experiência a seu favor | Há capital profissional desperdiçado |
| **5 de 13** que se candidataram não chegaram a nenhuma entrevista | O funil quebra antes do contato humano |
| **2 de 3** recrutadores dizem que filtros eliminam esses candidatos antes de chegarem a eles | O problema também existe do lado da empresa |

O problema central: **a pessoa em transição não consegue demonstrar competência de forma que vaga e recrutador reconheçam**, e por isso não sabe se deve se candidatar, o que estudar primeiro, nem como contar a experiência anterior.

## 1.3 Oportunidade

- As ferramentas existentes respondem com **nota de compatibilidade por palavra-chave** (ex.: "73% compatível"), que incentiva enfeitar currículo e não diz o que fazer.
- Cursos e bootcamps entregam **conteúdo**, mas não a **prova**: a pesquisa mostra que a barreira é demonstrar, não aprender.
- O lado das empresas sofre com filtros que descartam talento em transição (2 de 3 recrutadores). Uma vaga que separa "obrigatório" de "desejável" e aceita experiência aplicada no lugar de exigência formal amplia o funil da empresa.
- A IA tornou viável, a custo baixo ou zero, ler vagas e currículos em linguagem natural e orientar a pessoa de forma contextualizada (ver [docs/IA.md](../IA.md)).

Dimensionamento do mercado (TAM/SAM/SOM): **[equipe]**. Use as fontes públicas que a equipe já consultou e cite-as; não há número de mercado neste repositório.

## 1.4 Segmentos de clientes

| Segmento | Quem é | Papel no modelo | Evidência |
|---|---|---|---|
| **Candidato em transição** (principal) | Adulto que trabalha ou trabalhou em outra área e quer entrar em dados, desenvolvimento, UX/UI, design gráfico, suporte ou produto | Usuário e pagante do plano Plus | Pesquisa com 23 candidatos |
| **Empresas que contratam para vagas de entrada** | RH e gestores que recrutam júnior/estágio em tecnologia e design | Pagante (vagas decifradas, busca por evidência, desafios) | Pesquisa com 3 recrutadores |
| **Escolas e bootcamps** | Instituições que formam pessoas em transição e precisam de empregabilidade | Pagante (pacote por turma) | Hipótese a validar (ver experimentação) |

Primeiro segmento a atacar: **candidato em transição para Análise de Dados**, o caso mais desenvolvido no protótipo e no catálogo de competências do motor de regras.

## 1.5 Lean Canvas

| Bloco | Conteúdo | Fundamentação |
|---|---|---|
| **Problema** | 1) Vagas pedem experiência que a pessoa não tem; 2) não sabe por onde começar; 3) não usa a experiência anterior a seu favor | Pesquisa (47,8% / 43,5% / 60,9%) |
| **Alternativas existentes** | Comparadores de currículo por palavra-chave, cursos e bootcamps, mentoria individual paga, tentativa e erro nas candidaturas | Análise da equipe; protótipo ("não é mais um comparador de currículo") |
| **Segmentos** | Candidato em transição (principal), empresas com vagas de entrada, escolas/bootcamps | Seção 1.4 |
| **Early adopters** | Pessoas que já se candidataram sem retorno (5 de 13 da pesquisa) e quem trabalha em outra área e estuda dados | Pesquisa |
| **Proposta única de valor** | "Prove o que você sabe fazer antes da primeira experiência na nova área": decisão fundamentada e plano de evidências, não nota | Princípios do produto |
| **Solução** | Raio-X da Vaga, Banco de Evidências, Plano de Evidências, Tradutor de Experiência, Mentor com IA, Perfil de Evidências; para empresas, Vagas Decifradas, desafios e busca por competência comprovada | MVP funcional |
| **Canais** | Comunidades de transição de carreira, parcerias com bootcamps e escolas, conteúdo orgânico, indicação via Perfil de Evidências compartilhado | Hipótese (seção 4 da experimentação) |
| **Fontes de receita** | Freemium (Plus com assinatura mensal); assinatura para empresas; pacote por turma para escolas | Tabela de planos do produto. Preços: hipótese a testar |
| **Estrutura de custos** | Hospedagem (um processo Node + PostgreSQL), IA (gratuita por padrão; paga só se ativada), domínio, aquisição de usuários, equipe | Arquitetura real (ver 3) |
| **Métricas-chave** | Ativação (1º Raio-X), evidências bem documentadas por usuário, tarefas do plano concluídas, candidaturas que chegam a entrevista, conversão para Plus | Instrumentadas no produto (`npm run admin -- metricas`) |
| **Vantagem injusta** | Princípio "prova, não palavra-chave" aplicado no produto (a IA não inventa experiência, a decisão é por regras auditáveis); base de evidências e vagas revisadas por empresas que cresce com o uso | Arquitetura e regras do produto |

## 1.6 Lógica de valor (criação, entrega e captura)

- **Criação**: o motor de regras e a IA transformam texto solto (vaga, currículo, experiência anterior) em requisitos, evidências, decisão e plano. A empresa cria valor ao revisar a vaga e ao publicar desafios, que viram evidência para o candidato.
- **Entrega**: aplicação web responsiva (desktop, tablet e celular); Perfil de Evidências com link público; Mentor conversacional.
- **Captura**:
  - candidato: grátis com limite (3 Raio-X por mês, Mentor com limite diário) e Plus por assinatura (Raio-X ilimitado, Radar de Vagas, Preparação para Entrevista, mais mensagens);
  - empresa: assinatura;
  - escolas: pacote por turma.

O limite do plano grátis já é aplicado no servidor. A cobrança online ainda não existe; a ativação do Plus hoje é administrativa, durante o piloto.

**Coerência entre os blocos**: cada dor da pesquisa tem um recurso correspondente (ver a matriz na [proposta de valor](02-proposta-de-valor.md)), cada recurso pago resolve uma dor recorrente da etapa "Buscando a vaga" (onde há candidaturas e entrevistas), e o custo variável principal, a IA, pode ser zero com provedores gratuitos. Isso permite um plano grátis real sem queimar caixa.

## 1.7 Evolução desde o Status Report 1

**[equipe]**: descreva o que estava no Status Report 1. O que este repositório documenta como evolução, com evidência verificável:

| Antes (protótipo) | Agora (MVP) |
|---|---|
| HTML único, dados no navegador, login só com e-mail | Aplicação web com API, banco de dados, contas com senha e sessões seguras |
| Dados fictícios ("Ana", "Bruno", empresa de exemplo) | Nenhum dado fictício; tudo é criado por usuários reais |
| IA disponível só dentro do ambiente de protótipo | Camada de IA multi-provedor, gratuita por padrão, com fallback para regras e regras de privacidade |
| Plano Plus "ativado" sem pagamento | Regras de plano aplicadas no servidor; cobrança como próximo passo |
| Sem métricas | Instrumentação das hipóteses e coleta de feedback dentro do produto (ver [experimentação](04-experimentacao-e-validacao.md)) |
