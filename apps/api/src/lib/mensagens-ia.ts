import type { ErroIA } from "../ai/tipos";

/** Tradução de falhas da IA em respostas HTTP com mensagens claras para a pessoa. */
export function respostaErroIA(e: ErroIA): { status: number; codigo: string; erro: string } {
  const min = e.aposMs ? Math.max(1, Math.ceil(e.aposMs / 60000)) : null;
  const espera = min ? ` Tente de novo em cerca de ${min} minuto${min > 1 ? "s" : ""}.` : " Tente de novo em instantes.";
  switch (e.motivo) {
    case "desativada":
      return { status: 503, codigo: "ia_desativada", erro: "Este recurso usa IA, que não está configurada neste ambiente." };
    case "privacidade":
      return {
        status: 503,
        codigo: "ia_privacidade",
        erro: "Por privacidade, este recurso só pode usar provedores de IA que não treinam com seus dados, e nenhum deles está configurado aqui.",
      };
    case "cota":
      return { status: 429, codigo: "ia_cota", erro: "Você atingiu o limite diário de uso da IA. Ele renova amanhã." };
    case "limite":
      return { status: 429, codigo: "ia_limite", erro: `A cota gratuita de IA acabou por enquanto.${espera}` };
    case "indisponivel":
      return { status: 503, codigo: "ia_indisponivel", erro: `A IA está indisponível agora.${espera}` };
    case "recusa":
      return { status: 422, codigo: "ia_recusa", erro: "A IA não pôde responder a este pedido. Reformule e tente de novo." };
    case "invalido":
      return { status: 502, codigo: "ia_invalido", erro: "A IA devolveu uma resposta fora do formato esperado. Tente de novo." };
    case "cancelado":
      return { status: 400, codigo: "ia_cancelado", erro: "Geração cancelada." };
    default:
      return { status: 502, codigo: "ia_falha", erro: `A IA não respondeu agora.${espera}` };
  }
}
