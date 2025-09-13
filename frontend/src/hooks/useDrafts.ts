import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { draftService } from '../services/draftService';
import { useSmartPolling } from './useSmartPolling';
import type { DraftUpdateRequest } from '../types/draft';

/**
 * Hook to fetch all drafts with smart polling
 * Adaptive polling based on webhook activity
 */
export function useDrafts() {
  const pollingConfig = useSmartPolling();
  
  return useQuery({
    queryKey: ['drafts'],
    queryFn: () => draftService.getDrafts(),
    refetchInterval: pollingConfig.refetchInterval,
    staleTime: pollingConfig.staleTime,
    gcTime: pollingConfig.cacheTime,
  });
}

/**
 * Hook to fetch latest draft only with smart polling
 * Adaptive polling based on webhook activity
 */
export function useLatestDraft() {
  const pollingConfig = useSmartPolling();
  
  return useQuery({
    queryKey: ['drafts', 'latest'],
    queryFn: () => draftService.getLatestDraft(),
    refetchInterval: pollingConfig.refetchInterval,
    staleTime: pollingConfig.staleTime,
    gcTime: pollingConfig.cacheTime,
  });
}

/**
 * Hook to fetch specific draft by ID
 */
export function useDraft(id: number) {
  return useQuery({
    queryKey: ['drafts', id],
    queryFn: () => draftService.getDraftById(id),
    enabled: !!id,
  });
}

/**
 * Hook to update draft content
 */
export function useUpdateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DraftUpdateRequest }) =>
      draftService.updateDraft(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}

/**
 * Hook to approve draft
 */
export function useApproveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => draftService.approveDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}

/**
 * Hook to send draft
 */
export function useSendDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => draftService.sendDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}

/**
 * Hook to delete draft
 */
export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => draftService.deleteDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}

/**
 * Hook to approve and send draft in one action
 */
export function useApproveAndSendDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => draftService.approveAndSend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}