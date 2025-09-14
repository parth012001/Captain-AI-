/**
 * Learning system data models from the backend
 */

export interface LearningInsight {
  pattern: 'tone' | 'content' | 'length' | 'structure' | 'mixed';
  frequency: number;
  successRate: number;
  recommendation: string;
  confidence: number;
}

export interface LearningInsightsResponse {
  message: string;
  period: string;
  insights: LearningInsight[];
  count: number;
}

export interface SuccessMetrics {
  totalResponses: number;
  noEdits: number;
  minorEdits: number;
  majorRewrites: number;
  deletedDrafts: number;
  overallSuccessRate: number;
  trendDirection: 'improving' | 'stable' | 'declining';
}

export interface SuccessMetricsResponse {
  message: string;
  period: string;
  metrics: SuccessMetrics;
}

export interface PerformanceTrendPoint {
  week: string; // ISO date
  totalResponses: number;
  avgConfidence: number;
  successRate: number;
  avgRating: number;
}

export interface PerformanceTrendResponse {
  message: string;
  period: string;
  trend: PerformanceTrendPoint[];
  dataPoints: number;
}

export interface ToneAdjustment {
  tone: string;
  length: string;
  content: string;
  structure: string;
}

export interface ToneProfileAdjustment {
  adjustments: ToneAdjustment;
  reasoning: string;
  confidence: number;
}

/**
 * Combined learning dashboard data
 */
export interface LearningDashboardData {
  insights: LearningInsight[];
  successMetrics: SuccessMetrics;
  performanceTrend: PerformanceTrendPoint[];
  toneAdjustments?: ToneProfileAdjustment;
}

/**
 * Learning activity for real-time updates
 */
export interface LearningActivity {
  id: string;
  type: 'insight_generated' | 'tone_adjusted' | 'success_improved';
  message: string;
  confidence?: number;
  timestamp: string;
}