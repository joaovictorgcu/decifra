# Próximos passos e decisões pendentes

Itens que mudam o escopo do produto ou dependem de serviços externos. Ficaram de fora de propósito e precisam de decisão.

## Decisões de produto

1. **Cobrança do Plus e dos planos de empresa.** As regras de plano já são aplicadas no servidor; falta escolher o meio de pagamento (Stripe, Mercado Pago, Pagar.me) e o preço. Hoje a ativação é administrativa (`npm run admin -- plano <email> plus`).
2. **Verificação de e-mail e recuperação de senha.** Exigem um serviço de e-mail transacional (Resend, SES, SendGrid). Também reduzem abuso: hoje qualquer pessoa cria conta, e a cota de IA é por conta.
3. **Verificação de empresas.** Qualquer pessoa pode se cadastrar como empresa e publicar vagas/desafios. Para produção aberta, vale validar CNPJ ou domínio de e-mail corporativo.
4. **"Revisão do portfólio por mentor" (plano Plus).** Está na tabela de planos do protótipo, mas envolve mentores humanos: definir operação antes de implementar.
5. **Plano para escolas e bootcamps.** Painel por turma e acompanhamento: precisa de definição de produto.
6. **Mentor com ações.** Permitir que o Mentor crie tarefas, mini-projetos e rascunhos de evidência, sempre com confirmação da pessoa (ver [IA.md](IA.md), seção 6).

## Melhorias técnicas recomendadas

- PostgreSQL em produção e armazenamento compartilhado (Redis) para rate limit com várias instâncias.
- Teto global de gasto de IA por dia (além da cota por usuário) e alerta.
- Cotas contadas na mesma transação que registra o uso (hoje, requisições simultâneas podem passar um pouco do limite).
- Limite de tentativas de login por e-mail, além do limite por IP.
- O cadastro informa quando o e-mail já existe (escolha de usabilidade); com verificação de e-mail, dá para trocar por uma resposta neutra.
- Conjunto de avaliação da extração de requisitos com vagas reais revisadas por empresas.
