import { AREAS, AREA_IDS, ATRAPALHA, SITUACOES_ATUAIS, TEMPOS_TRANSICAO, type Sessao } from "@decifra/shared";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/cliente";
import { Botao, Cabecalho, CampoTexto, ErroForm, Grupo } from "../components/ui";
import { avisar } from "../lib/avisos";
import { useSessao, useSessaoAtiva } from "../lib/sessao";

export function Diagnostico() {
  const s = useSessaoAtiva();
  const { definir } = useSessao();
  const nav = useNavigate();
  const p = s.perfil;
  const [destino, setDestino] = useState(p?.destino ?? "");
  const [origem, setOrigem] = useState(p?.origem ?? "");
  const [situacao, setSituacao] = useState(p?.situacao ?? "");
  const [tempo, setTempo] = useState(p?.tempo ?? "");
  const [candidatou, setCandidatou] = useState(p?.candidatou ?? "");
  const [atrapalha, setAtrapalha] = useState<string[]>(p?.atrapalha ?? []);
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!destino || !origem.trim() || !situacao || !tempo || !candidatou || !atrapalha.length) {
      setErro(new Error("Responda às 6 perguntas para ver sua etapa."));
      return;
    }
    if (atrapalha.length > 3) {
      setErro(new Error("Escolha até 3 opções na pergunta 6."));
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const nova = await api.put<Sessao>("/perfil/diagnostico", { destino, origem, situacao, tempo, candidatou, atrapalha });
      definir(nova);
      avisar(`Sua etapa: ${nova.perfil?.etapa}`);
      nav("/inicio");
    } catch (x) {
      setErro(x);
      setEnviando(false);
    }
  }

  return (
    <main className="faixa secao">
      <div className="miolo pilha-g" style={{ maxWidth: 620 }}>
        <Cabecalho titulo="Em que momento você está?" sub="São 6 perguntas. Suas respostas adaptam a tela inicial." selo="Cada etapa da transição tem uma necessidade diferente" />
        <form className="pilha-g" onSubmit={enviar} noValidate>
          <Grupo legenda="1. Para qual área você quer ir?" nome="destino" opcoes={AREA_IDS.map((k) => [k, AREAS[k].nome] as const)} valor={destino} aoMudar={(v) => setDestino(v as string)} />
          <CampoTexto id="origem" rotulo="2. De qual área você vem?" placeholder="Ex.: assistente administrativa" value={origem} onChange={(e) => setOrigem(e.target.value)} maxLength={120} />
          <Grupo legenda="3. Qual é sua situação atual?" nome="situacao" opcoes={SITUACOES_ATUAIS} valor={situacao} aoMudar={(v) => setSituacao(v as string)} />
          <Grupo legenda="4. Há quanto tempo está em transição?" nome="tempo" opcoes={TEMPOS_TRANSICAO} valor={tempo} aoMudar={(v) => setTempo(v as string)} />
          <Grupo legenda="5. Já se candidatou a alguma vaga na nova área?" nome="candidatou" opcoes={[["sim", "Sim"], ["nao", "Ainda não"]]} valor={candidatou} aoMudar={(v) => setCandidatou(v as string)} />
          <Grupo
            legenda={`6. O que mais atrapalha? Escolha até 3.${atrapalha.length ? ` (${atrapalha.length} de 3)` : ""}`}
            nome="atrapalha"
            tipo="checkbox"
            opcoes={ATRAPALHA.map((x) => [x, x] as const)}
            valor={atrapalha}
            aoMudar={(v) => setAtrapalha(v as string[])}
          />
          <ErroForm erro={erro} />
          <div className="linha">
            <Botao type="submit" className="botao primario" carregando={enviando}>
              Ver minha etapa
            </Botao>
            {p && (
              <Link className="botao" to="/inicio">
                Cancelar
              </Link>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
