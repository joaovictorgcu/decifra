import type {
  Candidatura,
  CandidatoBusca,
  Desafio,
  Evidencia,
  EvidenciaInput,
  Historia,
  ItemRadar,
  Paginado,
  PerfilPublico,
  Requisito,
  Sessao,
  Tarefa,
  VagaDetalhe,
  VagaEmpresa,
  VagaResumo,
  Conversa,
  MensagemMentor,
} from "@decifra/shared";
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { api, ErroRequisicao } from "./cliente";

/** Consultas (react-query) de cada recurso da API. */

export function useSessaoQuery() {
  return useQuery<Sessao | null>({
    queryKey: ["sessao"],
    queryFn: async () => {
      try {
        return await api.get<Sessao>("/auth/sessao");
      } catch (e) {
        if (e instanceof ErroRequisicao && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 30_000,
  });
}

const useLista = <T,>(chave: unknown[], url: string, opcoes: Partial<UseQueryOptions<T[]>> = {}) =>
  useQuery<T[]>({ queryKey: chave, queryFn: async () => (await api.get<Paginado<T>>(url)).itens, ...opcoes });

export const useEvidencias = () => useLista<Evidencia>(["evidencias"], "/evidencias");
export const useVagas = () => useLista<VagaResumo>(["vagas"], "/vagas");
export const useTarefas = () => useLista<Tarefa>(["tarefas"], "/tarefas");
export const useSugestoes = () => useLista<{ competencia: string; texto: string; vagas: number }>(["sugestoes"], "/plano/sugestoes");
export const useCandidaturas = () => useLista<Candidatura>(["candidaturas"], "/candidaturas");
export const useHistorias = (ativo: boolean) => useLista<Historia>(["historias"], "/historias", { enabled: ativo });
export const useConversas = () => useLista<Conversa>(["conversas"], "/mentor/conversas");
export const useDesafiosAbertos = () => useLista<Desafio>(["desafios"], "/desafios");
export const useVagasAbertas = () =>
  useLista<{ id: string; titulo: string; empresa: string; selo: boolean; requisitos: number; criadaEm: string; minhaVagaId: string | null }>(
    ["vagas-abertas"],
    "/vagas-abertas",
  );
export const useVagasEmpresa = () => useLista<VagaEmpresa & { publicada: boolean; analises: number }>(["empresa", "vagas"], "/empresa/vagas");
export const useDesafiosEmpresa = () => useLista<Desafio>(["empresa", "desafios"], "/empresa/desafios");
export const useBuscaCandidatos = (q: string) =>
  useLista<CandidatoBusca>(["empresa", "candidatos", q], `/empresa/candidatos?q=${encodeURIComponent(q)}`);

export function useVaga(id: string | undefined) {
  return useQuery<VagaDetalhe>({ queryKey: ["vaga", id], queryFn: () => api.get<VagaDetalhe>(`/vagas/${id}`), enabled: !!id });
}

export function useEvidencia(id: string | undefined) {
  return useQuery<Evidencia>({ queryKey: ["evidencia", id], queryFn: () => api.get<Evidencia>(`/evidencias/${id}`), enabled: !!id });
}

export function useRadar(ativo: boolean) {
  return useQuery<{ itens: ItemRadar[]; prioridade: ItemRadar | null; totalVagas: number }>({
    queryKey: ["radar"],
    queryFn: () => api.get("/radar"),
    enabled: ativo,
  });
}

export function useConversa(id: string | undefined) {
  return useQuery<{ id: string; titulo: string; mensagens: MensagemMentor[] }>({
    queryKey: ["conversa", id],
    queryFn: () => api.get(`/mentor/conversas/${id}`),
    enabled: !!id,
  });
}

export function usePerfilPublico(slug: string | undefined) {
  return useQuery<PerfilPublico & { publico: boolean }>({
    queryKey: ["perfil-publico", slug],
    queryFn: () => api.get(`/publico/perfis/${slug}`),
    enabled: !!slug,
    retry: false,
  });
}

/**
 * Mutação que, ao terminar, revalida os dados do usuário. Evidências mudam
 * decisões de Raio-X, radar e sugestões, então a revalidação é ampla.
 */
export function useAcao<E, R>(fn: (e: E) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation<R, ErroRequisicao, E>({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries(),
  });
}

export type { EvidenciaInput, Requisito };
