import type { Sessao } from "@decifra/shared";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/cliente";
import { useAcao } from "../api/consultas";
import { Confirmar } from "../components/Confirmar";
import { Botao, Cabecalho, CampoTexto, ErroForm, erroDoCampo } from "../components/ui";
import { avisar } from "../lib/avisos";
import { useSessao, useSessaoAtiva } from "../lib/sessao";

export function Conta() {
  const s = useSessaoAtiva();
  const { definir } = useSessao();
  const nav = useNavigate();
  const [nome, setNome] = useState(s.usuario.nome);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [excluir, setExcluir] = useState(false);
  const [senhaExcluir, setSenhaExcluir] = useState("");
  const salvarNome = useAcao((n: string) => api.patch<Sessao>("/conta", { nome: n }));
  const trocarSenha = useAcao((d: { senhaAtual: string; novaSenha: string }) => api.post("/conta/senha", d));
  const apagar = useAcao((senha: string) => api.del("/conta", { senha }));

  function enviarNome(e: FormEvent) {
    e.preventDefault();
    salvarNome.mutate(nome, { onSuccess: (ns) => (definir(ns), avisar("Nome atualizado")) });
  }
  function enviarSenha(e: FormEvent) {
    e.preventDefault();
    trocarSenha.mutate(
      { senhaAtual: atual, novaSenha: nova },
      {
        onSuccess: () => {
          setAtual("");
          setNova("");
          avisar("Senha alterada. As outras sessões foram encerradas.");
        },
      },
    );
  }

  return (
    <>
      <Cabecalho titulo="Minha conta" sub={`Conectado como ${s.usuario.email}.`} />
      <form className="cartao" onSubmit={enviarNome} noValidate>
        <h2>Dados</h2>
        <CampoTexto id="nome" rotulo={s.usuario.papel === "empresa" ? "Nome da empresa" : "Seu nome"} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} erro={erroDoCampo(salvarNome.error, "nome")} />
        <div className="linha">
          <Botao type="submit" className="botao primario peq" carregando={salvarNome.isPending}>
            Salvar nome
          </Botao>
          {s.usuario.papel === "candidato" && (
            <Link className="botao peq" to="/diagnostico">
              Refazer o diagnóstico
            </Link>
          )}
        </div>
      </form>
      <form className="cartao" onSubmit={enviarSenha} noValidate>
        <h2>Senha</h2>
        <CampoTexto id="senhaAtual" type="password" rotulo="Senha atual" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} erro={erroDoCampo(trocarSenha.error, "senhaAtual")} />
        <CampoTexto id="novaSenha" type="password" rotulo="Nova senha" ajuda="Pelo menos 8 caracteres." autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} erro={erroDoCampo(trocarSenha.error, "novaSenha")} />
        {!erroDoCampo(trocarSenha.error, "senhaAtual") && !erroDoCampo(trocarSenha.error, "novaSenha") && <ErroForm erro={trocarSenha.error} />}
        <div className="linha">
          <Botao type="submit" className="botao peq" carregando={trocarSenha.isPending}>
            Trocar senha
          </Botao>
        </div>
      </form>
      <section className="cartao">
        <h2>Seus dados</h2>
        <p className="apoio leitura">Baixe uma cópia de tudo o que a DECIFRA guarda sobre você, ou exclua sua conta e todos os dados.</p>
        <div className="linha">
          <a className="botao peq" href="/api/conta/exportar" download="decifra-meus-dados.json">
            Baixar meus dados
          </a>
          <button type="button" className="botao perigo peq" onClick={() => setExcluir(true)}>
            Excluir conta
          </button>
        </div>
      </section>
      <Confirmar
        aberto={excluir}
        titulo="Excluir sua conta?"
        confirmar="Excluir para sempre"
        carregando={apagar.isPending}
        aoFechar={() => setExcluir(false)}
        aoConfirmar={() =>
          apagar.mutate(senhaExcluir, {
            onSuccess: () => {
              definir(null);
              avisar("Conta excluída");
              nav("/");
            },
          })
        }
      >
        <p>Todas as evidências, vagas, planos, conversas e o perfil público serão apagados. Isso não pode ser desfeito.</p>
        <CampoTexto id="senhaExcluir" type="password" rotulo="Confirme com sua senha" autoComplete="current-password" value={senhaExcluir} onChange={(e) => setSenhaExcluir(e.target.value)} />
        <ErroForm erro={apagar.error} />
      </Confirmar>
    </>
  );
}
