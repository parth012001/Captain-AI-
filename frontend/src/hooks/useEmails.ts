import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailService } from '../services/emailService';
import { useSmartPolling } from './useSmartPolling';

/**
 * Hook to fetch all emails with smart polling
 * Adaptive polling based on webhook activity
 */
export function useEmails() {
  const pollingConfig = useSmartPolling();
  
  return useQuery({
    queryKey: ['emails'],
    queryFn: () => emailService.getEmails(),
    refetchInterval: pollingConfig.refetchInterval,
    staleTime: pollingConfig.staleTime,
    gcTime: pollingConfig.cacheTime,
  });
}

/**
 * Hook to fetch latest email only with smart polling
 * Adaptive polling based on webhook activity
 */
export function useLatestEmail() {
  const pollingConfig = useSmartPolling();
  
  return useQuery({
    queryKey: ['emails', 'latest'],
    queryFn: () => emailService.getLatestEmail(),
    refetchInterval: pollingConfig.refetchInterval,
    staleTime: pollingConfig.staleTime,
    gcTime: pollingConfig.cacheTime,
  });
}

/**
 * Hook to manually trigger email fetch from Gmail
 */
export function useFetchEmails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => emailService.fetchFromGmail(),
    onSuccess: () => {
      // Invalidate emails to refetch after manual sync
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}