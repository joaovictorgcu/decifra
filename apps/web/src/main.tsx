import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ErroRequisicao } from "./api/cliente";
import { App } from "./App";
import { ProvedorSessao } from "./lib/sessao";
import "./styles/global.css";

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      // Não repete erros de regra de negócio (4xx); repete uma vez falhas de rede/servidor.
      retry: (n, e) => n < 1 && !(e instanceof ErroRequisicao && e.status >= 400 && e.status < 500),
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ProvedorSessao>
          <App />
        </ProvedorSessao>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
