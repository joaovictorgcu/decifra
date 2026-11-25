import { Link } from "react-router-dom";
import { Marca } from "../components/ui";

export function NaoEncontrado() {
  return (
    <>
      <div className="faixa escuro">
        <div className="miolo topo-l">
          <Marca />
        </div>
      </div>
      <main className="faixa secao">
        <div className="miolo pilha" style={{ maxWidth: 560 }}>
          <h1 tabIndex={-1}>Página não encontrada</h1>
          <p className="apoio">O endereço pode ter mudado ou não existir mais.</p>
          <Link className="botao primario" to="/" style={{ justifySelf: "start" }}>
            Ir para o início
          </Link>
        </div>
      </main>
    </>
  );
}
