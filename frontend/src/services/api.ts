import axios, { AxiosError } from 'axios';
import { API_CONFIG } from '../lib/constants';
import type { APIError } from '../types/api';
import type { 
  LearningInsightsResponse, 
  SuccessMetricsResponse, 
  PerformanceTrendResponse 
} from '../types/learning';

// Configure base API URL with environment override
const API_BASE_URL = import.meta.env?.VITE_BACKEND_URL || API_CONFIG.BASE_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use((config) => {
  // Add JWT authentication headers
  const authData = localStorage.getItem('chief_ai_auth_tokens');
  if (authData) {
    try {
      const tokens = JSON.parse(authData);
      if (tokens?.jwt_token) {
        config.headers.Authorization = `Bearer ${tokens.jwt_token}`;
      }
    } catch (error) {
      console.error('Error parsing auth tokens:', error);
    }
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError: APIError = {
      error: 'An unexpected error occurred',
      status: error.response?.status || 500,
    };

    if (error.response?.data) {
      const responseData = error.response.data as any;
      apiError.error = responseData.error || responseData.message || apiError.error;
      apiError.message = responseData.message;
      apiError.code = responseData.code;
    } else if (error.message) {
      apiError.error = error.message;
    }

    return Promise.reject(apiError);
  }
);

// Auth API calls
export const authAPI = {
  // Get Google OAuth URL from backend
  getAuthUrl: async (): Promise<{ authUrl: string }> => {
    const response = await api.get('/auth');
    return response.data;
  },

  // Set tokens after OAuth callback (for testing/manual token setting)
  setTokens: async (accessToken: string, refreshToken: string) => {
    const response = await api.post('/auth/set-tokens', {
      accessToken,
      refreshToken,
    });
    return response.data;
  },

  // Test if tokens are working by fetching email stats
  testConnection: async (accessToken: string, refreshToken: string) => {
    // First set the tokens
    await authAPI.setTokens(accessToken, refreshToken);
    // Then test by fetching emails
    const response = await api.get('/emails');
    return response.data;
  },
};

// Email API calls
export const emailAPI = {
  // Fetch recent emails
  getRecentEmails: async () => {
    const response = await api.get('/emails');
    return response.data;
  },

  // Fetch emails from Gmail (triggers processing)
  fetchEmails: async () => {
    const response = await api.get('/emails/fetch');
    return response.data;
  },
};

// Draft API calls
export const draftAPI = {
  // Get auto-generated drafts
  getAutoDrafts: async () => {
    const response = await api.get('/auto-drafts');
    return response.data;
  },

  // Get specific draft by ID
  getDraftById: async (id: number) => {
    const response = await api.get(`/auto-drafts/${id}`);
    return response.data;
  },

  // Edit draft
  editDraft: async (id: number, subject: string, body: string) => {
    const response = await api.put(`/auto-drafts/${id}`, {
      subject,
      body,
    });
    return response.data;
  },

  // Approve draft
  approveDraft: async (id: number) => {
    const response = await api.post(`/auto-drafts/${id}/approve`);
    return response.data;
  },

  // Send draft
  sendDraft: async (id: number) => {
    const response = await api.post(`/auto-drafts/${id}/send`);
    return response.data;
  },

  // Delete draft
  deleteDraft: async (id: number) => {
    const response = await api.delete(`/auto-drafts/${id}`);
    return response.data;
  },
};

// Promotional Email API calls
export const promotionalEmailAPI = {
  // Get promotional emails with optional filters
  getPromotionalEmails: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    
    const queryString = params.toString();
    const url = queryString ? `/promotional-emails?${queryString}` : '/promotional-emails';
    const response = await api.get(url);
    return response.data;
  },

  // Get promotional email statistics
  getPromotionalEmailStats: async () => {
    const response = await api.get('/promotional-emails/stats');
    return response.data;
  },

  // Mark promotional email as read
  markAsRead: async (id: number) => {
    const response = await api.post(`/promotional-emails/${id}/mark-read`);
    return response.data;
  },

  // Delete promotional email
  deletePromotionalEmail: async (id: number) => {
    const response = await api.delete(`/promotional-emails/${id}`);
    return response.data;
  },
};

// Learning API calls
export const learningAPI = {
  // Get learning insights with confidence scores
  getInsights: async (days: number = 30): Promise<LearningInsightsResponse> => {
    const response = await api.get(`/learning/insights?days=${days}`);
    return response.data;
  },

  // Get success metrics and trends
  getSuccessMetrics: async (days: number = 7): Promise<SuccessMetricsResponse> => {
    const response = await api.get(`/learning/success-metrics?days=${days}`);
    return response.data;
  },

  // Get performance trend over weeks
  getPerformanceTrend: async (weeks: number = 4): Promise<PerformanceTrendResponse> => {
    const response = await api.get(`/learning/performance-trend?weeks=${weeks}`);
    return response.data;
  },

  // Get recent learning activity (for notifications)
  getRecentActivity: async (limit: number = 10) => {
    // This will be added to backend later, for now return mock data
    console.log('Fetching', limit, 'recent activities');
    return {
      activities: [
        {
          id: '1',
          type: 'insight_generated' as const,
          message: 'AI learned: Mixed areas need improvement',
          confidence: 90,
          timestamp: new Date().toISOString()
        }
      ]
    };
  },
};