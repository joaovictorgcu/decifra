import { DECISOES, SITUACOES, type Decisao, type Fonte, type Situacao } from "@decifra/shared";
import { useEffect, useRef, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { ErroRequisicao } from "../api/cliente";

/** Componentes de interface reutilizáveis, com as classes do protótipo original. */

export const LOGO_PATHS = (
  <>
    <path d="M238 107A52 52 0 0 0 226 210A33 33 0 0 1 238 158Z" />
    <path d="M238 158A35 35 0 0 1 273 193V223H238Z" />
    <circle cx="269" cy="137" r="15" />
  </>
);

export function Marca({ para = "/", rotulo = "DECIFRA, ir para o início" }: { para?: string; rotulo?: string }) {
  return (
    <Link to={para} className="marca" aria-label={rotulo} style={{ textDecoration: "none" }}>
      <svg viewBox="187 107 97 116" aria-hidden="true" focusable="false">
        {LOGO_PATHS}
      </svg>
      DECIFRA
    </Link>
  );
}

export function Etiqueta({ rotulo, icone, cor }: { rotulo: string; icone: string; cor: string }) {
  return (
    <span className={`etq ${cor}`}>
      <b aria-hidden="true">{icone}</b>
      {rotulo}
    </span>
  );
}

export const EtqSituacao = ({ s }: { s: Situacao }) => <Etiqueta {...SITUACOES[s]} />;
export const EtqDecisao = ({ d }: { d: Decisao }) => <Etiqueta {...DECISOES[d]} />;

/** Cabeçalho de página: o h1 recebe foco a cada navegação (padrão de acessibilidade do protótipo). */
export function Cabecalho({ titulo, sub, selo, acoes }: { titulo: string; sub?: ReactNode; selo?: string; acoes?: ReactNode }) {
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h1.current?.focus({ preventScroll: true });
  }, [titulo]);
  return (
    <header className="cab">
      {selo && <p className="selo-pos">{selo}</p>}
      <h1 ref={h1} tabIndex={-1}>
        {titulo}
      </h1>
      {sub && <p className="apoio leitura">{sub}</p>}
      {acoes && <div className="linha">{acoes}</div>}
    </header>
  );
}

/* ---------- Formulários ---------- */

export function descritoPor(id: string, ajuda?: ReactNode, erro?: string) {
  return [ajuda ? `a-${id}` : "", erro ? `e-${id}` : ""].filter(Boolean).join(" ") || undefined;
}

export function Campo({ id, rotulo, ajuda, erro, children, contador }: { id: string; rotulo: string; ajuda?: ReactNode; erro?: string; children: ReactNode; contador?: ReactNode }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {ajuda && (
        <p className="apoio" id={`a-${id}`}>
          {ajuda}
        </p>
      )}
      {children}
      {contador && <span className="contador">{contador}</span>}
      {erro && (
        <p className="erro" id={`e-${id}`}>
          {erro}
        </p>
      )}
    </div>
  );
}

type Comum = { id: string; rotulo: string; ajuda?: ReactNode; erro?: string };

export function CampoTexto({ id, rotulo, ajuda, erro, ...p }: Comum & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Campo id={id} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <input type="text" id={id} name={id} aria-invalid={erro ? true : undefined} aria-describedby={descritoPor(id, ajuda, erro)} {...p} />
    </Campo>
  );
}

export function CampoArea({ id, rotulo, ajuda, erro, maxLength, value, ...p }: Comum & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const n = typeof value === "string" ? value.length : 0;
  return (
    <Campo id={id} rotulo={rotulo} ajuda={ajuda} erro={erro} contador={maxLength && n > maxLength * 0.8 ? `${n} de ${maxLength}` : undefined}>
      <textarea id={id} name={id} maxLength={maxLength} value={value} aria-invalid={erro ? true : undefined} aria-describedby={descritoPor(id, ajuda, erro)} {...p} />
    </Campo>
  );
}

export function CampoSelecao({ id, rotulo, ajuda, erro, opcoes, ...p }: Comum & SelectHTMLAttributes<HTMLSelectElement> & { opcoes: readonly (readonly [string, string])[] }) {
  return (
    <Campo id={id} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <select id={id} name={id} aria-invalid={erro ? true : undefined} aria-describedby={descritoPor(id, ajuda, erro)} {...p}>
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </Campo>
  );
}

export function Grupo({ legenda, nome, opcoes, tipo = "radio", valor, aoMudar }: {
  legenda: string;
  nome: string;
  opcoes: readonly (readonly [string, string])[];
  tipo?: "radio" | "checkbox";
  valor: string | string[];
  aoMudar: (v: string | string[]) => void;
}) {
  return (
    <fieldset>
      <legend>{legenda}</legend>
      <div className="opcoes">
        {opcoes.map(([v, r]) => {
          const marcado = Array.isArray(valor) ? valor.includes(v) : valor === v;
          return (
            <label className="opcao" key={v}>
              <input
                type={tipo}
                name={nome}
                value={v}
                checked={marcado}
                onChange={(e) => {
                  if (tipo === "radio") aoMudar(v);
                  else {
                    const atual = Array.isArray(valor) ? valor : [];
                    aoMudar(e.target.checked ? [...atual, v] : atual.filter((x) => x !== v));
                  }
                }}
              />
              {r}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Mensagem de erro de formulário vinda da API. */
export function ErroForm({ erro }: { erro: unknown }) {
  if (!erro) return null;
  const msg = erro instanceof Error ? erro.message : String(erro);
  return (
    <p className="erro" role="alert">
      {msg}
    </p>
  );
}

export function erroDoCampo(erro: unknown, campo: string): string | undefined {
  return erro instanceof ErroRequisicao && erro.campo === campo ? erro.message : undefined;
}

/* ---------- Estados ---------- */

export function Botao({ carregando, children, className = "botao", disabled, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { carregando?: boolean }) {
  return (
    <button type="button" className={className} disabled={disabled || carregando} aria-busy={carregando || undefined} {...p}>
      {carregando && <span className="girando" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <p className="carregando" role="status">
      <span className="girando" aria-hidden="true" />
      {texto}
    </p>
  );
}

export function Esqueleto({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="esqueleto" aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

export function Falha({ erro, tentar }: { erro: unknown; tentar?: () => void }) {
  const msg = erro instanceof Error ? erro.message : "Não foi possível carregar.";
  return (
    <div className="falha" role="alert">
      <strong>Não deu certo.</strong>
      <span>{msg}</span>
      {tentar && (
        <button type="button" className="link" style={{ color: "inherit" }} onClick={tentar}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function Vazio({ titulo, children, acao }: { titulo: string; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="vazio">
      <h3>{titulo}</h3>
      {children && <p className="apoio leitura">{children}</p>}
      {acao}
    </div>
  );
}

/** Mostra de onde veio o resultado: modelo de IA, motor de regras ou dados da empresa. */
export function OrigemResultado({ fonte }: { fonte: Fonte }) {
  const t = { ia: "Análise feita com IA e conferida pelas regras da DECIFRA", regras: "Análise feita pelo motor de regras da DECIFRA", empresa: "Requisitos e pesos revisados pela própria empresa" }[fonte];
  return (
    <p className="fonte">
      <b aria-hidden="true">{fonte === "ia" ? "✦" : "•"}</b>
      {t}
    </p>
  );
}

export function Trava({ recurso }: { recurso: string }) {
  return (
    <div className="foco escuro">
      <p className="olho">Candidato Plus</p>
      <h2>{recurso} faz parte do Plus</h2>
      <p>Veja o que muda em cada plano.</p>
      <Link className="botao primario" to="/planos">
        Ver planos
      </Link>
    </div>
  );
}
