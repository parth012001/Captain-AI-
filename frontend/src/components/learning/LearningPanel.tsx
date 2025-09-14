import { Card, CardHeader, CardContent, Badge, Spinner } from '../ui';
import { useLearningDashboard, useTopLearningInsight, useCurrentSuccessRate } from '../../hooks/useLearning';
import { formatDate } from '../../lib/utils';
import { 
  Brain, 
  TrendingUp, 
  Target, 
  BarChart3, 
  Lightbulb, 
  Activity,
  Zap
} from 'lucide-react';

export function LearningPanel() {
  const { insights, performanceTrend, isLoading, isError } = useLearningDashboard();
  const { insight: topInsight, hasHighConfidenceInsight } = useTopLearningInsight();
  const { successRate, trend, totalResponses } = useCurrentSuccessRate();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="h-64">
          <CardContent className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center space-y-3">
              <Spinner size="lg" />
              <p className="text-slate-500">Loading AI insights...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Card className="h-64">
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">🧠</div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                Failed to load learning data
              </h3>
              <p className="text-slate-500 mb-4">
                Could not connect to learning service
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const insightsData = insights?.data?.insights || [];
  const trendData = performanceTrend?.data?.trend || [];

  // Handle case where data is loaded but empty (no learning data yet)
  const hasAnyData = insightsData.length > 0 || trendData.length > 0 || (successRate !== undefined && successRate > 0);
  
  if (!hasAnyData) {
    return (
      <div className="space-y-6">
        <Card className="h-64">
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-blue-500 text-6xl mb-4">🧠</div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                AI Learning in Progress
              </h3>
              <p className="text-slate-500 mb-4">
                Start editing AI drafts to build your personalized insights
              </p>
              <div className="text-sm text-slate-400">
                The AI will learn from your edits and preferences over time
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Brain className="h-7 w-7 text-purple-600" />
            <span className="text-slate-900">AI Learning Dashboard</span>
          </h2>
          <p className="text-slate-600 mt-1">
            Monitor how your AI assistant learns and improves from your feedback
          </p>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Success Rate Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Success Rate</p>
                <p className="text-3xl font-bold text-slate-900">
                  {successRate.toFixed(1)}%
                </p>
                <div className="flex items-center mt-2">
                  {trend === 'improving' ? (
                    <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  ) : trend === 'declining' ? (
                    <TrendingUp className="h-4 w-4 text-red-600 mr-1 rotate-180" />
                  ) : (
                    <Activity className="h-4 w-4 text-slate-600 mr-1" />
                  )}
                  <span className={`text-sm ${
                    trend === 'improving' ? 'text-green-600' : 
                    trend === 'declining' ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {trend}
                  </span>
                </div>
              </div>
              <Target className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total Responses Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Responses</p>
                <p className="text-3xl font-bold text-slate-900">
                  {totalResponses.toLocaleString()}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Drafts processed
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Top Insight Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-600" />
                <p className="text-sm font-medium text-slate-600">Top Insight</p>
              </div>
              {hasHighConfidenceInsight && (
                <Badge variant="success" className="text-xs">
                  {topInsight?.confidence}% confident
                </Badge>
              )}
            </div>
            {topInsight ? (
              <div>
                <p className="text-sm font-medium text-slate-900 mb-1 capitalize">
                  {topInsight.pattern} Pattern
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {topInsight.recommendation}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Gathering insights...
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Learning Insights Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-slate-900">Learning Patterns</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {insightsData.length} patterns detected
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {insightsData.length > 0 ? (
            insightsData.map((insight, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      insight.confidence >= 80 ? 'bg-green-100' :
                      insight.confidence >= 60 ? 'bg-yellow-100' : 'bg-gray-100'
                    }`}>
                      <Zap className={`h-4 w-4 ${
                        insight.confidence >= 80 ? 'text-green-600' :
                        insight.confidence >= 60 ? 'text-yellow-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 capitalize">
                        {insight.pattern} Adjustments
                      </h4>
                      <p className="text-sm text-slate-600">
                        {insight.frequency} occurrences • {insight.successRate.toFixed(1)}% success rate
                      </p>
                    </div>
                  </div>
                  <Badge variant={insight.confidence >= 80 ? 'success' : insight.confidence >= 60 ? 'warning' : 'outline'}>
                    {insight.confidence}% confident
                  </Badge>
                </div>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md">
                  {insight.recommendation}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-slate-900 mb-2">
                Learning in Progress
              </h4>
              <p className="text-slate-500">
                AI is gathering data from your interactions to generate insights
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Trend */}
      {trendData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-slate-900">Performance Trend</h3>
            </div>
            <Badge variant="outline" className="text-xs">
              Last 4 weeks
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {trendData.map((point, index) => (
                <div key={index} className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    Week of {formatDate(point.week).split(',')[0]}
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">Confidence</span>
                      <span className="text-sm font-medium text-slate-900">{point.avgConfidence.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">Success Rate</span>
                      <span className="text-sm font-medium text-slate-900">{point.successRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">Responses</span>
                      <span className="text-sm font-medium text-slate-900">{point.totalResponses}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}