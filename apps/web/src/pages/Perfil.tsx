import type { Sessao } from "@decifra/shared";
import { Link } from "react-router-dom";
import { api } from "../api/cliente";
import { useAcao, usePerfilPublico } from "../api/consultas";
import { Botao, Cabecalho, Esqueleto, Falha } from "../components/ui";
import { avisar } from "../lib/avisos";
import { useSessao, useSessaoAtiva } from "../lib/sessao";
import { BlocoCompetencias } from "./PerfilPublico";

export function Perfil() {
  const s = useSessaoAtiva();
  const { definir } = useSessao();
  const p = s.perfil!;
  const q = usePerfilPublico(p.slug);
  const publicar = useAcao((v: boolean) => api.patch<Sessao>("/perfil/publico", { publico: v }));
  const url = `${window.location.origin}/p/${p.slug}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      avisar("Link copiado");
    } catch {
      avisar(`Copie o link: ${url}`);
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Meu Perfil"
        sub="Sua página de competências, com as evidências de cada uma, para enviar no lugar de um currículo genérico."
        selo="Prova, não palavra-chave"
      />
      <section className="cartao">
        <h2>{p.publico ? "Seu perfil está público" : "Seu perfil está privado"}</h2>
        <p className="apoio leitura">
          {p.publico
            ? "Qualquer pessoa com o link vê suas competências e evidências, e empresas da DECIFRA podem encontrar você pela busca. Seu e-mail nunca aparece."
            : "Só você vê esta página. Ao publicar, ela ganha um link para enviar a recrutadores e passa a aparecer na busca das empresas da DECIFRA."}
        </p>
        <div className="linha">
          <Botao
            className={p.publico ? "botao" : "botao primario"}
            carregando={publicar.isPending}
            onClick={() =>
              publicar.mutate(!p.publico, {
                onSuccess: (ns) => {
                  definir(ns);
                  avisar(ns.perfil?.publico ? "Perfil publicado" : "Perfil agora é privado");
                },
                onError: (e) => avisar(e.message, "erro"),
              })
            }
          >
            {p.publico ? "Tornar privado" : "Publicar perfil"}
          </Botao>
          {p.publico && (
            <button type="button" className="botao primario" onClick={copiar}>
              Copiar link público
            </button>
          )}
          <Link className="botao" to={`/p/${p.slug}`}>
            Ver como recrutador
          </Link>
        </div>
      </section>
      {q.isLoading && <Esqueleto />}
      {q.isError && <Falha erro={q.error} tentar={() => q.refetch()} />}
      {q.data && <BlocoCompetencias perfil={q.data} />}
    </>
  );
}
