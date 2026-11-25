import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Captura erros de renderização para a tela não ficar em branco.
 * Mostra uma mensagem no visual da DECIFRA e permite recarregar.
 */
export class BarreiraErro extends Component<{ children: ReactNode }, { erro: Error | null }> {
  override state = { erro: null as Error | null };

  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }

  override componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("Erro de interface", erro, info.componentStack);
  }

  override render() {
    if (!this.state.erro) return this.props.children;
    return (
      <main className="faixa secao">
        <div className="miolo pilha" style={{ maxWidth: 560 }}>
          <h1 tabIndex={-1}>Algo deu errado nesta tela</h1>
          <p className="apoio">Seus dados estão salvos. Recarregue a página para continuar. Se o problema voltar, tente de novo em alguns minutos.</p>
          <div className="linha">
            <button type="button" className="botao primario" onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <a className="botao" href="/">
              Ir para o início
            </a>
          </div>
        </div>
      </main>
    );
  }
}
