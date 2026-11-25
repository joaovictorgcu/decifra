import { useEffect, useRef, type ReactNode } from "react";

/** Diálogo modal nativo (<dialog>) para confirmar ações destrutivas. */
export function Confirmar({ aberto, titulo, children, confirmar = "Excluir", aoConfirmar, aoFechar, carregando }: {
  aberto: boolean;
  titulo: string;
  children?: ReactNode;
  confirmar?: string;
  aoConfirmar: () => void;
  aoFechar: () => void;
  carregando?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog ref={ref} className="dialogo" aria-labelledby="dialogo-titulo" onClose={aoFechar} onCancel={aoFechar}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          aoConfirmar();
        }}
      >
        <h2 id="dialogo-titulo">{titulo}</h2>
        {children}
        <div className="linha">
          <button type="submit" className="botao perigo" disabled={carregando}>
            {carregando && <span className="girando" aria-hidden="true" />}
            {confirmar}
          </button>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
