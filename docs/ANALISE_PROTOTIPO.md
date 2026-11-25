# Análise do protótipo (DECIFRA.html)

O protótipo é um único arquivo HTML (~840 linhas) com CSS e JavaScript embutidos. Ele já tinha uma proposta de produto muito clara e um motor de análise determinístico bem pensado. Esta análise registra o que existia, o que era simulado e o que mudou.

## Proposta do produto

Plataforma para adultos em transição de carreira para tecnologia e design. Princípios explícitos na landing:

1. **Decisão, não nota**: nada de "73% de compatibilidade"; a saída é uma decisão com justificativa.
2. **Prova, não palavra-chave**: nunca sugerir declarar o que a pessoa não consegue demonstrar.
3. **A carreira anterior conta**: experiência de outra área é traduzida em competências.
4. **Cada etapa tem uma necessidade**: o app se adapta à etapa (definindo o caminho, construindo a base, buscando a vaga).

Esses princípios foram mantidos como regras de negócio e como regras da camada de IA (ver [IA.md](IA.md)).

## Telas e fluxos encontrados

| Área | Tela | Funcionalidade no protótipo |
|---|---|---|
| Pública | Landing | Hero, exemplo de Raio-X, números da pesquisa (23 candidatos, 3 recrutadores), diferenciais, "como funciona", planos |
| Pública | Entrar | E-mail sem senha + papel; botões "Entrar como Ana" / "Entrar como empresa" (dados de exemplo) |
| Candidato | Diagnóstico | 6 perguntas → etapa da transição |
| Candidato | Início | Próximo passo recomendado, progresso do plano, cartão por etapa, vagas salvas |
| Candidato | Raio-X | Cola a vaga → extração de requisitos → cruzamento com evidências → decisão, justificativa, ações |
| Candidato | Evidências | CRUD de evidências, aba Tradutor, desafios práticos abertos |
| Candidato | Tradutor | Funções antigas → competências, frase de currículo, como contar em entrevista |
| Candidato | Plano | Tarefas com status e prazo; mini-projeto "feito" vira evidência; sugestões de mini-projetos |
| Candidato | Radar (Plus) | Requisitos recorrentes e lacuna prioritária (simulação de ganho) |
| Candidato | Candidaturas | Quadro de 5 etapas; alerta com 2+ "sem retorno" |
| Candidato | Entrevista (Plus) | Histórias STAR e feedback de resposta |
| Candidato | Meu Perfil / Perfil público | Competências agrupadas com evidências |
| Empresa | Vagas | Analisar vaga → revisar obrigatório/desejável e exigências formais → selo |
| Empresa | Desafios | Publicar desafio, receber entregas, triagem |
| Empresa | Buscar candidatos | Busca por competência comprovada |

## O que era apenas visual ou simulado

| No protótipo | Problema | Como ficou |
|---|---|---|
| Dados em `localStorage` | Nada persistia fora do navegador; empresas e candidatos "conversavam" só no mesmo navegador | API + banco de dados; dados compartilhados entre usuários reais |
| Login só com e-mail, sem senha | Qualquer pessoa entrava em qualquer conta | Cadastro com senha (scrypt), sessões revogáveis em cookie httpOnly |
| Contas de exemplo (Ana, Bruno, Carla, Davi, empresa) e "Restaurar exemplo" | Dados fictícios misturados ao produto | Removidos. Não há seed automático |
| "Ativar Plus (demonstração)" | Troca de plano sem pagamento | Regras de plano aplicadas no servidor; ativação administrativa até a decisão sobre cobrança |
| Limite de 3 Raio-X por mês com contador que nunca zerava | Contador `raioMes` só crescia | Eventos de uso por data; o limite é calculado no mês corrente |
| `window.claude.use(...)` para IA | API só existe dentro do ambiente de artefatos; fora dele a IA nunca rodava | Camada de IA no backend, multi-provedor, com chaves no servidor |
| "Copiar link público" | O link abria os dados salvos no navegador de quem clicava | URL pública real (`/p/<slug>`), opcional e privada por padrão |
| Busca de candidatos | Listava os perfis de exemplo | Busca nos perfis que os próprios candidatos publicaram |
| Vagas publicadas pela empresa | Ficavam só na tela da empresa | Aparecem para candidatos, que fazem o Raio-X com os pesos da empresa |

## Problemas de estrutura, usabilidade e acessibilidade

- **Estrutura**: todo o app em uma função com strings HTML concatenadas e `innerHTML`; estado global mutável. Migrado para componentes React, rotas reais e consultas com cache.
- **URLs**: rotas via `location.hash`, sem deep links confiáveis. Agora há rotas reais (`/raio-x/:id`, `/p/:slug`...).
- **Acessibilidade**: o protótipo já era cuidadoso (foco no h1 ao navegar, `aria-live`, alvos de 44px, tabelas que viram cartões no celular). Isso foi preservado. Melhorias: link "Pular para o conteúdo", erros ligados aos campos (`aria-describedby`/`aria-invalid`), diálogos nativos para confirmar exclusões, rótulos em todos os inputs. Testes automatizados com axe-core não encontram violações graves.
- **Celular**: no lado da empresa não havia como sair da conta no celular (rodapé do menu ficava oculto sem botão "Mais"). Corrigido.
- **Ações destrutivas sem confirmação** (excluir evidência): agora pedem confirmação.
- **Feedback**: estados de carregamento, erro com "tentar de novo", estados vazios com próxima ação, e indicação da origem do resultado (IA, regras ou empresa).

## O que foi preservado sem mudança

- Identidade visual: paleta marinho/água/âmbar, Inter, logotipo, layout em faixas da landing, menu lateral no desktop e barra inferior no celular. O CSS original está integralmente em `apps/web/src/styles/global.css`.
- Textos e tom de voz.
- O motor de análise (extração por regras, cruzamento, decisão, justificativa, ações, radar), portado para TypeScript com testes que reproduzem os exemplos do protótipo.
