import { useMemo } from 'react';
import { useWebhookStatus } from './useWebhookStatus';
import { POLLING_CONFIG } from '../lib/constants';

/**
 * Hook to determine smart polling configuration based on webhook activity
 * Returns adaptive polling intervals based on webhook health and activity
 */
export function useSmartPolling() {
  const { data: webhookData } = useWebhookStatus();
  
  const pollingConfig = useMemo(() => {
    if (!webhookData?.heartbeat) {
      // No webhook data available - use idle polling
      return {
        refetchInterval: POLLING_CONFIG.IDLE_INTERVAL,
        staleTime: POLLING_CONFIG.IDLE_STALE_TIME,
        cacheTime: POLLING_CONFIG.CACHE_TIME,
        reason: 'no-webhook-data'
      };
    }

    const { health, timeSinceLastWebhook } = webhookData.heartbeat;
    
    // Determine if webhook is active based on health and timing
    const isWebhookActive = 
      health === 'healthy' || 
      (health === 'warning' && timeSinceLastWebhook && timeSinceLastWebhook < POLLING_CONFIG.RECENT_WEBHOOK_THRESHOLD);
    
    if (isWebhookActive) {
      // Webhook is active - poll more frequently
      return {
        refetchInterval: POLLING_CONFIG.ACTIVE_INTERVAL,
        staleTime: POLLING_CONFIG.ACTIVE_STALE_TIME,
        cacheTime: POLLING_CONFIG.CACHE_TIME,
        reason: 'webhook-active'
      };
    } else {
      // Webhook is idle - poll less frequently
      return {
        refetchInterval: POLLING_CONFIG.IDLE_INTERVAL,
        staleTime: POLLING_CONFIG.IDLE_STALE_TIME,
        cacheTime: POLLING_CONFIG.CACHE_TIME,
        reason: 'webhook-idle'
      };
    }
  }, [webhookData?.heartbeat]);

  return pollingConfig;
}

/**
 * Hook to get polling status for debugging/display
 */
export function usePollingStatus() {
  const { data: webhookData } = useWebhookStatus();
  const pollingConfig = useSmartPolling();
  
  return {
    isActive: pollingConfig.reason === 'webhook-active',
    interval: pollingConfig.refetchInterval,
    reason: pollingConfig.reason,
    webhookHealth: webhookData?.heartbeat?.health || 'unknown',
    timeSinceLastWebhook: webhookData?.heartbeat?.timeSinceLastWebhook || null
  };
}
