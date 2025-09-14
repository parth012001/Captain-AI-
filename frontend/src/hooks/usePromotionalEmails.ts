import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promotionalEmailService } from '../services/promotionalEmailService';
import { useSmartPolling } from './useSmartPolling';
import type { PromotionalEmailFilters } from '../types/promotionalEmail';

/**
 * Hook to fetch promotional emails with smart polling
 * Adaptive polling based on webhook activity
 */
export function usePromotionalEmails(filters?: PromotionalEmailFilters) {
  const pollingConfig = useSmartPolling();
  
  return useQuery({
    queryKey: ['promotional-emails', filters],
    queryFn: () => promotionalEmailService.getPromotionalEmails(filters),
    refetchInterval: pollingConfig.refetchInterval,
    staleTime: pollingConfig.staleTime,
    gcTime: pollingConfig.cacheTime,
  });
}

/**
 * Hook to fetch promotional email statistics
 */
export function usePromotionalEmailStats() {
  const pollingConfig = useSmartPolling();
  
  return useQuery({
    queryKey: ['promotional-email-stats'],
    queryFn: () => promotionalEmailService.getPromotionalEmailStats(),
    refetchInterval: pollingConfig.refetchInterval * 2, // Less frequent than emails
    staleTime: pollingConfig.staleTime,
    gcTime: pollingConfig.cacheTime,
  });
}

/**
 * Hook to mark a promotional email as read
 */
export function useMarkPromotionalEmailAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (emailId: number) => promotionalEmailService.markAsRead(emailId),
    onSuccess: () => {
      // Invalidate and refetch promotional emails and stats
      queryClient.invalidateQueries({ queryKey: ['promotional-emails'] });
      queryClient.invalidateQueries({ queryKey: ['promotional-email-stats'] });
    },
    onError: (error) => {
      console.error('Failed to mark promotional email as read:', error);
    },
  });
}

/**
 * Hook to delete a promotional email
 */
export function useDeletePromotionalEmail() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (emailId: number) => promotionalEmailService.deletePromotionalEmail(emailId),
    onSuccess: () => {
      // Invalidate and refetch promotional emails and stats
      queryClient.invalidateQueries({ queryKey: ['promotional-emails'] });
      queryClient.invalidateQueries({ queryKey: ['promotional-email-stats'] });
    },
    onError: (error) => {
      console.error('Failed to delete promotional email:', error);
    },
  });
}

/**
 * Hook to get unread promotional email count for notifications
 */
export function useUnreadPromotionalEmailCount() {
  const { data: statsData } = usePromotionalEmailStats();
  
  return {
    unreadCount: statsData?.stats.unread || 0,
    totalCount: statsData?.stats.total || 0,
    isLoading: !statsData
  };
}
