import { useQuery } from '@tanstack/react-query';

interface WebhookHeartbeat {
  health: 'healthy' | 'warning' | 'unhealthy' | 'unknown';
  lastReceived: string | null;
  lastProcessed: string | null;
  totalReceived: number;
  totalProcessed: number;
  timeSinceLastWebhook: number | null;
  timeSinceLastProcessed: number | null;
}

interface WebhookStatusResponse {
  message: string;
  heartbeat: WebhookHeartbeat;
}

/**
 * Hook to fetch webhook heartbeat status
 * Polls every 10 seconds to show real-time webhook health
 */
export function useWebhookStatus() {
  return useQuery({
    queryKey: ['webhook-status'],
    queryFn: async (): Promise<WebhookStatusResponse> => {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/webhooks/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch webhook status');
      }
      return response.json();
    },
    refetchInterval: 10000, // Poll every 10 seconds for real-time updates
    staleTime: 5000, // Consider data stale after 5 seconds
    retry: 3,
    retryDelay: 2000,
  });
}

/**
 * Utility function to format time since last webhook
 */
export function formatTimeSince(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  
  const now = new Date();
  const lastTime = new Date(timestamp);
  const diffMs = now.getTime() - lastTime.getTime();
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}

/**
 * Get health status color and icon
 */
export function getHealthDisplay(health: string) {
  switch (health) {
    case 'healthy':
      return { color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: '🟢', label: 'Healthy' };
    case 'warning':
      return { color: 'text-amber-600', bgColor: 'bg-amber-100', icon: '🟡', label: 'Warning' };
    case 'unhealthy':
      return { color: 'text-red-600', bgColor: 'bg-red-100', icon: '🔴', label: 'Unhealthy' };
    default:
      return { color: 'text-slate-600', bgColor: 'bg-slate-100', icon: '⚪', label: 'Unknown' };
  }
}
