import type { Sessao } from "@decifra/shared";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { useSessaoQuery } from "../api/consultas";

interface ValorSessao {
  sessao: Sessao | null;
  carregando: boolean;
  definir: (s: Sessao | null) => void;
}

const Ctx = createContext<ValorSessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const q = useSessaoQuery();
  const qc = useQueryClient();
  const valor: ValorSessao = {
    sessao: q.data ?? null,
    carregando: q.isLoading,
    definir: (s) => {
      if (!s) qc.clear();
      qc.setQueryData(["sessao"], s);
    },
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao(): ValorSessao {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSessao fora do ProvedorSessao");
  return v;
}

/** Sessão garantida (usar só dentro de rotas protegidas). */
export function useSessaoAtiva(): Sessao {
  const { sessao } = useSessao();
  if (!sessao) throw new Error("Sessão ausente em rota protegida");
  return sessao;
}
