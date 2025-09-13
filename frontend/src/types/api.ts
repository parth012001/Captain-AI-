/**
 * Generic API response wrapper
 */
export interface APIResponse<T = any> {
  data?: T;
  message: string;
  error?: string;
  success?: boolean;
}

/**
 * API error response
 */
export interface APIError {
  error: string;
  message?: string;
  code?: string;
  status?: number;
}

/**
 * Loading state for UI components
 */
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  lastUpdated?: Date;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Filter parameters for API requests
 */
export interface FilterParams {
  status?: string;
  urgency?: string;
  from?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}