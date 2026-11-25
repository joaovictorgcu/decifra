import type { Papel, Sessao } from "@decifra/shared";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/cliente";
import { Botao, CampoTexto, ErroForm, Grupo, Marca, erroDoCampo } from "../components/ui";
import { avisar } from "../lib/avisos";
import { useSessao } from "../lib/sessao";

export function Entrar() {
  const [params] = useSearchParams();
  const { sessao, definir } = useSessao();
  const nav = useNavigate();
  const [modo, setModo] = useState<"entrar" | "cadastro">(params.get("modo") === "cadastro" ? "cadastro" : "entrar");
  const [papel, setPapel] = useState<Papel>(params.get("papel") === "empresa" ? "empresa" : "candidato");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  const destino = (s: Sessao) => {
    const volta = params.get("volta");
    // Só caminhos internos: evita redirecionamento aberto ("//site" ou "/\site").
    if (volta && /^\/(?![/\\])/.test(volta)) return volta;
    if (s.usuario.papel === "empresa") return "/empresa/vagas";
    return s.perfil ? "/inicio" : "/diagnostico";
  };
  if (sessao && !enviando) return <Navigate to={destino(sessao)} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const s =
        modo === "entrar" ? await api.post<Sessao>("/auth/login", { email, senha }) : await api.post<Sessao>("/auth/cadastro", { nome, email, senha, papel });
      avisar(modo === "entrar" ? `Olá, ${s.usuario.nome}` : "Conta criada");
      definir(s);
      nav(destino(s), { replace: true });
    } catch (x) {
      setErro(x);
      setEnviando(false);
    }
  }

  const cadastro = modo === "cadastro";
  const erroDeCampo = ["nome", "email", "senha"].some((c) => erroDoCampo(erro, c));
  return (
    <>
      <div className="faixa escuro">
        <div className="miolo topo-l">
          <Marca />
        </div>
      </div>
      <main className="faixa secao">
        <div className="miolo pilha-g" style={{ maxWidth: 460 }}>
          <div className="pilha">
            <h1 tabIndex={-1}>{cadastro ? "Criar sua conta" : "Entrar na DECIFRA"}</h1>
            <div className="abas" role="group" aria-label="Entrar ou criar conta">
              <button type="button" className="aba" aria-current={!cadastro ? "true" : undefined} onClick={() => (setModo("entrar"), setErro(null))}>
                Entrar
              </button>
              <button type="button" className="aba" aria-current={cadastro ? "true" : undefined} onClick={() => (setModo("cadastro"), setErro(null))}>
                Criar conta
              </button>
            </div>
          </div>
          <form className="pilha" onSubmit={enviar} noValidate>
            {cadastro && (
              <>
                <Grupo legenda="Você é" nome="papel" opcoes={[["candidato", "Candidato"], ["empresa", "Empresa"]]} valor={papel} aoMudar={(v) => setPapel(v as Papel)} />
                <CampoTexto
                  id="nome"
                  rotulo={papel === "empresa" ? "Nome da empresa" : "Seu nome"}
                  autoComplete={papel === "empresa" ? "organization" : "name"}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  erro={erroDoCampo(erro, "nome")}
                  maxLength={80}
                />
              </>
            )}
            <CampoTexto id="email" type="email" rotulo="E-mail" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={erroDoCampo(erro, "email")} />
            <CampoTexto
              id="senha"
              type="password"
              rotulo="Senha"
              autoComplete={cadastro ? "new-password" : "current-password"}
              ajuda={cadastro ? "Pelo menos 8 caracteres." : undefined}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              erro={erroDoCampo(erro, "senha")}
            />
            {!erroDeCampo && <ErroForm erro={erro} />}
            <Botao type="submit" className="botao primario" carregando={enviando}>
              {cadastro ? "Criar conta" : "Entrar"}
            </Botao>
          </form>
          <p className="apoio">
            Seus dados são usados só para operar a DECIFRA. Seu Perfil de Evidências fica privado até você decidir publicá-lo. <Link to="/">Voltar ao início</Link>
          </p>
        </div>
      </main>
    </>
  );
}
