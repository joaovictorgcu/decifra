import { TIPOS_EVIDENCIA, type Evidencia, type EvidenciaInput, type TipoEvidencia } from "@decifra/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/cliente";
import { useAcao, useEvidencia } from "../api/consultas";
import { Botao, Cabecalho, CampoArea, CampoSelecao, CampoTexto, Carregando, ErroForm, Falha, erroDoCampo } from "../components/ui";
import { avisar } from "../lib/avisos";

const VAZIA: EvidenciaInput = { titulo: "", tipo: "Projeto", concluido: false, link: "", competencias: [], problema: "", fez: "", ferramentas: "", resultado: "" };

/** Campos de uma evidência, reutilizados no cadastro manual e na revisão da importação. */
export function CamposEvidencia({ v, set, erro, prefixo = "" }: { v: EvidenciaInput; set: (v: EvidenciaInput) => void; erro?: unknown; prefixo?: string }) {
  const [comps, setComps] = useState(v.competencias.join(", "));
  const id = (c: string) => `${prefixo}${c}`;
  return (
    <>
      <CampoTexto id={id("titulo")} rotulo="Título" value={v.titulo} onChange={(e) => set({ ...v, titulo: e.target.value })} erro={erroDoCampo(erro, "titulo")} maxLength={140} />
      <CampoSelecao id={id("tipo")} rotulo="Tipo" opcoes={TIPOS_EVIDENCIA.map((x) => [x, x] as const)} value={v.tipo} onChange={(e) => set({ ...v, tipo: e.target.value as TipoEvidencia })} />
      {(v.tipo === "Curso" || v.tipo === "Certificado") && (
        <label className="opcao">
          <input type="checkbox" checked={v.concluido} onChange={(e) => set({ ...v, concluido: e.target.checked })} />
          Curso ou certificado concluído
        </label>
      )}
      <CampoTexto id={id("link")} type="url" rotulo="Link (opcional)" placeholder="https://" value={v.link} onChange={(e) => set({ ...v, link: e.target.value })} erro={erroDoCampo(erro, "link")} />
      <CampoTexto
        id={id("competencias")}
        rotulo="Competências que comprova"
        ajuda="Separe por vírgula. Ex.: SQL, análise de indicadores."
        value={comps}
        onChange={(e) => {
          setComps(e.target.value);
          set({ ...v, competencias: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) });
        }}
        erro={erroDoCampo(erro, "competencias")}
      />
      <CampoArea id={id("problema")} rotulo="Problema" ajuda="Qual era o problema ou contexto?" value={v.problema} onChange={(e) => set({ ...v, problema: e.target.value })} maxLength={2000} />
      <CampoArea id={id("fez")} rotulo="O que eu fiz" value={v.fez} onChange={(e) => set({ ...v, fez: e.target.value })} maxLength={2000} />
      <CampoTexto id={id("ferramentas")} rotulo="Ferramentas" value={v.ferramentas} onChange={(e) => set({ ...v, ferramentas: e.target.value })} maxLength={300} />
      <CampoArea id={id("resultado")} rotulo="Resultado" ajuda="Use apenas o que você consegue demonstrar." value={v.resultado} onChange={(e) => set({ ...v, resultado: e.target.value })} maxLength={2000} />
    </>
  );
}

export function EvidenciaForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const q = useEvidencia(id);
  const [v, setV] = useState<EvidenciaInput | null>(id ? null : VAZIA);
  const salvar = useAcao((d: EvidenciaInput) => (id ? api.put<Evidencia>(`/evidencias/${id}`, d) : api.post<Evidencia>("/evidencias", d)));

  useEffect(() => {
    if (q.data && !v) {
      const { titulo, tipo, concluido, link, competencias, problema, fez, ferramentas, resultado } = q.data;
      setV({ titulo, tipo, concluido, link, competencias, problema, fez, ferramentas, resultado });
    }
  }, [q.data, v]);

  if (id && q.isLoading) return <Carregando />;
  if (id && q.isError) return <Falha erro={q.error} />;
  if (!v) return null;

  function enviar(e: FormEvent) {
    e.preventDefault();
    salvar.mutate(v!, {
      onSuccess: () => {
        avisar("Evidência salva");
        nav("/evidencias");
      },
    });
  }

  const campoComErro = ["titulo", "link", "competencias"].some((c) => erroDoCampo(salvar.error, c));
  return (
    <>
      <Cabecalho titulo={id ? "Editar evidência" : "Nova evidência"} sub="Registre só o que você consegue demonstrar." selo="Prova, não palavra-chave" />
      {id && q.data && q.data.faltas.length > 0 && (
        <p className="info">
          Para ficar bem documentada, falta: {q.data.faltas.join(", ")}. Evidências completas contam como “Você comprova” no Raio-X.
        </p>
      )}
      <form className="pilha" onSubmit={enviar} noValidate>
        <CamposEvidencia v={v} set={setV} erro={salvar.error} />
        {!campoComErro && <ErroForm erro={salvar.error} />}
        <div className="linha">
          <Botao type="submit" className="botao primario" carregando={salvar.isPending}>
            Salvar evidência
          </Botao>
          <Link className="botao" to="/evidencias">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
