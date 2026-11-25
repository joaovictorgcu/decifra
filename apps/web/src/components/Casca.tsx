import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/cliente";
import { avisar } from "../lib/avisos";
import { useSessaoAtiva, useSessao } from "../lib/sessao";
import { Marca } from "./ui";

type Item = { para: string; rotulo: string; curto?: string; ativoEm?: string[] };

// No celular, os 4 primeiros itens ficam na barra inferior; o resto aparece em "Mais".
const MENU_CANDIDATO: Item[] = [
  { para: "/inicio", rotulo: "Início" },
  { para: "/raio-x", rotulo: "Raio-X" },
  { para: "/evidencias", rotulo: "Minhas Evidências", curto: "Evidências", ativoEm: ["/evidencias", "/tradutor"] },
  { para: "/plano", rotulo: "Plano" },
  { para: "/mentor", rotulo: "Mentor" },
  { para: "/radar", rotulo: "Radar de Vagas" },
  { para: "/candidaturas", rotulo: "Candidaturas" },
  { para: "/entrevista", rotulo: "Entrevista" },
  { para: "/perfil", rotulo: "Meu Perfil" },
];
const MENU_EMPRESA: Item[] = [
  { para: "/empresa/vagas", rotulo: "Vagas" },
  { para: "/empresa/desafios", rotulo: "Desafios" },
  { para: "/empresa/candidatos", rotulo: "Buscar candidatos", curto: "Candidatos" },
];

/** Estrutura do app: menu lateral no desktop e barra inferior no celular (layout do protótipo). */
export function Casca({ children }: { children: ReactNode }) {
  const s = useSessaoAtiva();
  const { definir } = useSessao();
  const qc = useQueryClient();
  const nav = useNavigate();
  const loc = useLocation();
  const [aberto, setAberto] = useState(false);
  const emp = s.usuario.papel === "empresa";
  const lista = emp ? MENU_EMPRESA : MENU_CANDIDATO;

  async function sair() {
    try {
      await api.post("/auth/logout");
    } finally {
      definir(null);
      qc.clear();
      nav("/");
      avisar("Você saiu da sua conta");
    }
  }

  return (
    <div className="app">
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <aside className={`lateral escuro ${aberto ? "aberto" : ""} ${emp ? "empresa" : ""}`}>
        <Marca para={emp ? "/empresa/vagas" : "/inicio"} />
        <nav aria-label="Principal">
          <ul className="menu">
            {lista.map((m, i) => {
              const sec = !emp && i > 3;
              const ativo = (m.ativoEm ?? [m.para]).some((p) => loc.pathname === p || loc.pathname.startsWith(`${p}/`));
              return (
                <li key={m.para} className={sec ? "sec" : ""}>
                  <NavLink
                    to={m.para}
                    className={`item-menu ${sec ? "sec" : ""}`}
                    aria-current={ativo ? "page" : undefined}
                    onClick={() => setAberto(false)}
                    style={{ textDecoration: "none" }}
                  >
                    <span className="rot-longo">{m.rotulo}</span>
                    {m.curto && <span className="rot-curto">{m.curto}</span>}
                  </NavLink>
                </li>
              );
            })}
            <li className="mais-bt">
              <button type="button" className="item-menu" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
                Mais
              </button>
            </li>
          </ul>
        </nav>
        <div className="rodape-menu">
          <p className="quem">
            {s.usuario.nome}
            {!emp && ` · ${s.usuario.plano === "plus" ? "Plus" : "Grátis"}`}
          </p>
          <NavLink to="/planos" className="item-menu" style={{ textDecoration: "none" }} onClick={() => setAberto(false)}>
            Planos
          </NavLink>
          <NavLink to="/conta" className="item-menu" style={{ textDecoration: "none" }} onClick={() => setAberto(false)}>
            Minha conta
          </NavLink>
          <button type="button" className="item-menu" onClick={sair}>
            Sair
          </button>
        </div>
      </aside>
      <main className="principal" id="conteudo" tabIndex={-1}>
        <div className="conteudo">{children}</div>
      </main>
    </div>
  );
}
