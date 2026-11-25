import type { Papel } from "@decifra/shared";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Casca } from "./components/Casca";
import { Carregando } from "./components/ui";
import { useSessao } from "./lib/sessao";
import { Landing } from "./pages/Landing";
import { Entrar } from "./pages/Entrar";
const Planos = lazy(() => import("./pages/Planos").then((m) => ({ default: m.Planos })));
const PerfilPublicoPagina = lazy(() => import("./pages/PerfilPublico").then((m) => ({ default: m.PerfilPublicoPagina })));
const Diagnostico = lazy(() => import("./pages/Diagnostico").then((m) => ({ default: m.Diagnostico })));
const Inicio = lazy(() => import("./pages/Inicio").then((m) => ({ default: m.Inicio })));
const RaioX = lazy(() => import("./pages/RaioX").then((m) => ({ default: m.RaioX })));
const RaioDetalhe = lazy(() => import("./pages/RaioDetalhe").then((m) => ({ default: m.RaioDetalhe })));
const Evidencias = lazy(() => import("./pages/Evidencias").then((m) => ({ default: m.Evidencias })));
const EvidenciaForm = lazy(() => import("./pages/EvidenciaForm").then((m) => ({ default: m.EvidenciaForm })));
const Importar = lazy(() => import("./pages/Importar").then((m) => ({ default: m.Importar })));
const Tradutor = lazy(() => import("./pages/Tradutor").then((m) => ({ default: m.Tradutor })));
const Plano = lazy(() => import("./pages/Plano").then((m) => ({ default: m.Plano })));
const Radar = lazy(() => import("./pages/Radar").then((m) => ({ default: m.Radar })));
const Candidaturas = lazy(() => import("./pages/Candidaturas").then((m) => ({ default: m.Candidaturas })));
const Entrevista = lazy(() => import("./pages/Entrevista").then((m) => ({ default: m.Entrevista })));
const Mentor = lazy(() => import("./pages/Mentor").then((m) => ({ default: m.Mentor })));
const Perfil = lazy(() => import("./pages/Perfil").then((m) => ({ default: m.Perfil })));
const Conta = lazy(() => import("./pages/Conta").then((m) => ({ default: m.Conta })));
import { NaoEncontrado } from "./pages/NaoEncontrado";
const VagasEmpresa = lazy(() => import("./pages/empresa/Vagas").then((m) => ({ default: m.VagasEmpresa })));
const DesafiosEmpresa = lazy(() => import("./pages/empresa/Desafios").then((m) => ({ default: m.DesafiosEmpresa })));
const BuscarCandidatos = lazy(() => import("./pages/empresa/Buscar").then((m) => ({ default: m.BuscarCandidatos })));

const TITULOS: Record<string, string> = {
  "/": "DECIFRA",
  "/entrar": "Entrar · DECIFRA",
  "/planos": "Planos · DECIFRA",
  "/diagnostico": "Diagnóstico · DECIFRA",
  "/inicio": "Início · DECIFRA",
  "/raio-x": "Raio-X da Vaga · DECIFRA",
  "/evidencias": "Minhas Evidências · DECIFRA",
  "/tradutor": "Tradutor de Experiência · DECIFRA",
  "/plano": "Plano de Evidências · DECIFRA",
  "/radar": "Radar de Vagas · DECIFRA",
  "/candidaturas": "Candidaturas · DECIFRA",
  "/entrevista": "Entrevista · DECIFRA",
  "/mentor": "Mentor · DECIFRA",
  "/perfil": "Meu Perfil · DECIFRA",
  "/conta": "Minha conta · DECIFRA",
};

function TituloDocumento() {
  const { pathname } = useLocation();
  useEffect(() => {
    const base = "/" + (pathname.split("/")[1] ?? "");
    document.title = TITULOS[pathname] ?? TITULOS[base] ?? "DECIFRA";
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Protege rotas por login e papel; candidato sem diagnóstico vai para o diagnóstico. */
function Protegida({ papel, children, semCasca, semDiagnostico }: { papel?: Papel; children: ReactNode; semCasca?: boolean; semDiagnostico?: boolean }) {
  const { sessao, carregando } = useSessao();
  const loc = useLocation();
  if (carregando) return <main className="faixa secao"><Carregando /></main>;
  if (!sessao) return <Navigate to={`/entrar?volta=${encodeURIComponent(loc.pathname)}`} replace />;
  const p = sessao.usuario.papel;
  if (papel && p !== papel) return <Navigate to={p === "empresa" ? "/empresa/vagas" : "/inicio"} replace />;
  if (p === "candidato" && !sessao.perfil && !semDiagnostico) return <Navigate to="/diagnostico" replace />;
  return semCasca ? <>{children}</> : <Casca>{children}</Casca>;
}

export function App() {
  const C = (el: ReactNode) => <Protegida papel="candidato">{el}</Protegida>;
  const E = (el: ReactNode) => <Protegida papel="empresa">{el}</Protegida>;
  return (
    <>
      <TituloDocumento />
      <Suspense fallback={<main className="faixa secao"><Carregando /></main>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/planos" element={<Planos />} />
        <Route path="/p/:slug" element={<PerfilPublicoPagina />} />
        <Route path="/diagnostico" element={<Protegida papel="candidato" semCasca semDiagnostico><Diagnostico /></Protegida>} />
        <Route path="/inicio" element={C(<Inicio />)} />
        <Route path="/raio-x" element={C(<RaioX />)} />
        <Route path="/raio-x/:id" element={C(<RaioDetalhe />)} />
        <Route path="/evidencias" element={C(<Evidencias />)} />
        <Route path="/evidencias/nova" element={C(<EvidenciaForm />)} />
        <Route path="/evidencias/importar" element={C(<Importar />)} />
        <Route path="/evidencias/:id" element={C(<EvidenciaForm />)} />
        <Route path="/tradutor" element={C(<Tradutor />)} />
        <Route path="/plano" element={C(<Plano />)} />
        <Route path="/radar" element={C(<Radar />)} />
        <Route path="/candidaturas" element={C(<Candidaturas />)} />
        <Route path="/entrevista" element={C(<Entrevista />)} />
        <Route path="/mentor" element={C(<Mentor />)} />
        <Route path="/mentor/:id" element={C(<Mentor />)} />
        <Route path="/perfil" element={C(<Perfil />)} />
        <Route path="/conta" element={<Protegida>{<Conta />}</Protegida>} />
        <Route path="/empresa/vagas" element={E(<VagasEmpresa />)} />
        <Route path="/empresa/desafios" element={E(<DesafiosEmpresa />)} />
        <Route path="/empresa/candidatos" element={E(<BuscarCandidatos />)} />
        <Route path="*" element={<NaoEncontrado />} />
      </Routes>
      </Suspense>
    </>
  );
}
