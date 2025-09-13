/**
 * API Configuration
 */
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
} as const;

/**
 * Smart Polling Configuration
 * Adaptive polling based on webhook activity
 */
export const POLLING_CONFIG = {
  // Active polling when webhooks are healthy/recent
  ACTIVE_INTERVAL: 8000, // 8 seconds - when webhooks are active
  ACTIVE_STALE_TIME: 5000, // 5 seconds
  
  // Idle polling when no recent webhook activity
  IDLE_INTERVAL: 30000, // 30 seconds - when webhooks are idle
  IDLE_STALE_TIME: 25000, // 25 seconds
  
  // Cache time
  CACHE_TIME: 5 * 60 * 1000, // 5 minutes
  
  // Webhook activity thresholds (milliseconds)
  RECENT_WEBHOOK_THRESHOLD: 60000, // 1 minute - consider webhook "recent"
  HEALTHY_WEBHOOK_THRESHOLD: 300000, // 5 minutes - consider webhook "healthy"
} as const;

/**
 * UI Constants
 */
export const UI_CONFIG = {
  TOAST_DURATION: 4000,
  ANIMATION_DURATION: 200,
  DEBOUNCE_DELAY: 300,
  MAX_EMAIL_PREVIEW_LENGTH: 200,
  MAX_SUBJECT_LENGTH: 60,
} as const;

/**
 * Draft Status Types
 */
export const DRAFT_STATUS = {
  PENDING: 'pending',
  REVIEWED: 'reviewed', 
  EDITED: 'edited',
  SENT: 'sent',
  DELETED: 'deleted',
} as const;

/**
 * Urgency Levels
 */
export const URGENCY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium', 
  LOW: 'low',
} as const;

/**
 * Status Colors for UI
 */
export const STATUS_COLORS = {
  SUCCESS: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  WARNING: 'text-amber-600 bg-amber-50 border-amber-200',
  ERROR: 'text-red-600 bg-red-50 border-red-200',
  INFO: 'text-blue-600 bg-blue-50 border-blue-200',
  MUTED: 'text-slate-500 bg-slate-50 border-slate-200',
} as const;