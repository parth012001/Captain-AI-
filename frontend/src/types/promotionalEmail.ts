/**
 * Promotional Email data model from the backend
 */
export interface PromotionalEmail {
  id: number;
  subject?: string;
  from_email: string;
  date: string; // ISO timestamp
  is_read: boolean;
  classification_reason: string;
  preview: string;
}

/**
 * Promotional email statistics
 */
export interface PromotionalEmailStats {
  total: number;
  unread: number;
  by_classification: {
    [key: string]: number;
  };
}

/**
 * API response for promotional emails endpoint
 */
export interface PromotionalEmailsResponse {
  emails: PromotionalEmail[];
  stats: PromotionalEmailStats;
  filters?: {
    is_read?: boolean;
    classification_reason?: string;
    from_email?: string;
    limit?: number;
    offset?: number;
  };
}

/**
 * API response for promotional email stats endpoint
 */
export interface PromotionalEmailStatsResponse {
  stats: PromotionalEmailStats;
}

/**
 * API response for promotional email actions
 */
export interface PromotionalEmailActionResponse {
  success: boolean;
  message: string;
}

/**
 * Promotional email filters for API requests
 */
export interface PromotionalEmailFilters {
  is_read?: boolean;
  classification_reason?: string;
  from_email?: string;
  limit?: number;
  offset?: number;
}

/**
 * Classification reasons for promotional emails
 */
export type PromotionalEmailClassification = 
  | 'newsletter'
  | 'marketing'
  | 'promotional'
  | 'automated';

/**
 * Tab types for dashboard navigation
 */
export type DashboardTab = 'active' | 'promotional' | 'learning' | 'calendar';
