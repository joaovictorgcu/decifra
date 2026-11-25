# Próximos passos e decisões pendentes

Itens que mudam o escopo do produto ou dependem de serviços externos. Ficaram de fora de propósito e precisam de decisão.

## Decisões de produto

1. **Cobrança do Plus e dos planos de empresa.** As regras de plano já são aplicadas no servidor; falta escolher o meio de pagamento (Stripe, Mercado Pago, Pagar.me) e o preço. Hoje a ativação é administrativa (`npm run admin -- plano <email> plus`).
2. **Verificação de e-mail e recuperação de senha.** Exigem um serviço de e-mail transacional (Resend, SES, SendGrid). Também reduzem abuso: hoje qualquer pessoa cria conta, e a cota de IA é por conta.
3. **Verificação de empresas.** Qualquer pessoa pode se cadastrar como empresa e publicar vagas/desafios. Para produção aberta, vale validar CNPJ ou domínio de e-mail corporativo.
4. **"Revisão do portfólio por mentor" (plano Plus).** Está na tabela de planos do protótipo, mas envolve mentores humanos: definir operação antes de implementar.
5. **Plano para escolas e bootcamps.** Painel por turma e acompanhamento: precisa de definição de produto.
6. **Mentor com ações.** Permitir que o Mentor crie tarefas, mini-projetos e rascunhos de evidência, sempre com confirmação da pessoa (ver [IA.md](IA.md), seção 8).

## Camada de IA

- **Validar com chaves reais** de Groq, Gemini e OpenRouter (`npm run avaliar:ia -w @decifra/api`). O caminho compatível com OpenAI foi validado de verdade com o Ollama; os demais seguem a documentação oficial, mas ainda não receberam chamadas reais (sem chaves neste ambiente).
- **Parâmetro de limite no Gemini**: a documentação de compatibilidade não nomeia `max_tokens` × `max_completion_tokens`; o catálogo usa `max_tokens`. Confirmar na primeira chamada real.
- **Modelos gratuitos do OpenRouter**: a listagem pública não retornou modelos `:free` na consulta; por isso não há modelo padrão (`OPENROUTER_MODEL` é obrigatório).
- **Limites gratuitos do Groq**: confirmar no painel (console.groq.com/settings/limits) se a tabela pública é do plano gratuito.
- **Conjunto de avaliação** com vagas reais revisadas por empresas para comparar modelos por tarefa e ajustar `classificar()`.
- **Disjuntor e cotas compartilhados** (Redis) quando houver mais de uma instância.
- **Teto global de gasto diário** com provedores pagos (hoje há teto por usuário e por chamadas complexas).
- **Gemini para usuários no EEE, Suíça ou Reino Unido**: os termos exigem o plano pago para servir usuários finais nessas regiões.

## Melhorias técnicas recomendadas

- PostgreSQL em produção e armazenamento compartilhado (Redis) para rate limit com várias instâncias.
- Cotas contadas na mesma transação que registra o uso (hoje, requisições simultâneas podem passar um pouco do limite).
- O cadastro informa quando o e-mail já existe (escolha de usabilidade); com verificação de e-mail, dá para trocar por uma resposta neutra.
- Conjunto de avaliação da extração de requisitos com vagas reais revisadas por empresas.
- **Executar o Docker**: `Dockerfile` e `docker-compose.yml` prontos, mas não executados aqui (falta instalar o Docker Desktop, que exige WSL2 e permissão de administrador).
- Lembretes de prazo (Plano e desafios) por e-mail: depende da escolha do serviço de e-mail.
