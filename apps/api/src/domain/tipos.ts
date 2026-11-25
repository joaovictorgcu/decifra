import type { KindFormal, TipoEvidencia, TipoRequisito } from "@decifra/shared";

/** Forma interna (de domínio) das entidades usadas pelo motor de análise. */

export interface EvidenciaDom {
  id: string;
  titulo: string;
  tipo: TipoEvidencia | string;
  concluido: boolean;
  link: string;
  competencias: string[];
  problema: string;
  fez: string;
  ferramentas: string;
  resultado: string;
}

export interface RequisitoDom {
  id: string;
  requisito: string;
  curto: string;
  tipo: TipoRequisito;
  kind: KindFormal | null;
  obrig: boolean;
  evId: string | null;
  /** Posição da empresa sobre exigência formal, quando a vaga veio da DECIFRA. */
  aceita: "" | "sim" | "nao";
}

export interface VagaDom {
  id: string;
  titulo: string;
  reqs: RequisitoDom[];
}
