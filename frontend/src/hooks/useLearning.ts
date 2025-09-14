import { useQuery } from '@tanstack/react-query';
import { learningAPI } from '../services/api';
// Learning hooks for fetching AI insights and performance data

/**
 * Hook to fetch learning insights with confidence scores
 */
export function useLearningInsights(days: number = 30) {
  return useQuery({
    queryKey: ['learning-insights', days],
    queryFn: () => learningAPI.getInsights(days),
    staleTime: 5 * 60 * 1000, // 5 minutes - learning data doesn't change frequently
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 3,
  });
}

/**
 * Hook to fetch success metrics and trends
 */
export function useSuccessMetrics(days: number = 7) {
  return useQuery({
    queryKey: ['success-metrics', days],
    queryFn: () => learningAPI.getSuccessMetrics(days),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 3,
  });
}

/**
 * Hook to fetch performance trend data
 */
export function usePerformanceTrend(weeks: number = 4) {
  return useQuery({
    queryKey: ['performance-trend', weeks],
    queryFn: () => learningAPI.getPerformanceTrend(weeks),
    staleTime: 10 * 60 * 1000, // 10 minutes - trend data is more stable
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 3,
  });
}

/**
 * Hook to fetch recent learning activity for notifications
 */
export function useRecentLearningActivity(limit: number = 10) {
  return useQuery({
    queryKey: ['learning-activity', limit],
    queryFn: () => learningAPI.getRecentActivity(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes - activity should be fresh
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
}

/**
 * Combined hook for learning dashboard data
 * Fetches all learning data needed for the dashboard
 */
export function useLearningDashboard() {
  const insights = useLearningInsights(30);
  const successMetrics = useSuccessMetrics(7);
  const performanceTrend = usePerformanceTrend(4);
  const recentActivity = useRecentLearningActivity(5);

  return {
    insights,
    successMetrics,
    performanceTrend,
    recentActivity,
    isLoading: insights.isLoading || successMetrics.isLoading || performanceTrend.isLoading,
    isError: insights.isError || successMetrics.isError || performanceTrend.isError,
    error: insights.error || successMetrics.error || performanceTrend.error,
  };
}

/**
 * Hook to get the highest confidence learning insight
 * For showing in the draft panel
 */
export function useTopLearningInsight() {
  const { data } = useLearningInsights(14); // Last 2 weeks for fresher insights
  
  const topInsight = data?.insights
    .filter(insight => insight.confidence >= 70) // Only high-confidence insights
    .sort((a, b) => b.confidence - a.confidence)[0];

  return {
    insight: topInsight,
    hasHighConfidenceInsight: !!topInsight && topInsight.confidence >= 80,
  };
}

/**
 * Hook to get current success rate for display
 */
export function useCurrentSuccessRate() {
  const { data } = useSuccessMetrics(7);
  
  return {
    successRate: data?.metrics?.overallSuccessRate || 0,
    trend: data?.metrics?.trendDirection || 'stable',
    totalResponses: data?.metrics?.totalResponses || 0,
  };
}