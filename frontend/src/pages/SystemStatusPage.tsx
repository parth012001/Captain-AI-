// React import not needed for modern JSX transform
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui';
import { formatDate } from '../lib/utils';
import { useLatestEmail } from '../hooks/useEmails';
import { useLatestDraft } from '../hooks/useDrafts';
import { useWebhookStatus, formatTimeSince, getHealthDisplay } from '../hooks/useWebhookStatus';
import { usePollingStatus } from '../hooks/useSmartPolling';

export default function SystemStatusPage() {
  const navigate = useNavigate();
  const { data: emailData, isLoading: emailLoading } = useLatestEmail();
  const { data: draftData, isLoading: draftLoading } = useLatestDraft();
  const { data: webhookData, isLoading: webhookLoading } = useWebhookStatus();
  const pollingStatus = usePollingStatus();

  const latestEmail = (emailData as any)?.emails?.[0];
  const latestDraft = (draftData as any)?.drafts?.[0];
  const webhookStatus = webhookData?.heartbeat;

  const systemStatus = emailLoading || draftLoading ? 'loading' : 'active';
  const lastUpdated = new Date();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center text-slate-600 hover:text-slate-900 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">System Status</h1>
            <div></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Webhook Status Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Webhook Status
            </h2>
            
            {webhookLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            ) : webhookStatus ? (
              <div className="space-y-4">
                {(() => {
                  const healthDisplay = getHealthDisplay(webhookStatus.health);
                  return (
                    <div className="flex items-center space-x-3">
                      <div className={`h-3 w-3 rounded-full ${healthDisplay.bgColor}`} />
                      <div>
                        <span className={`font-medium ${healthDisplay.color}`}>
                          {healthDisplay.label}
                        </span>
                        <p className="text-sm text-slate-500">
                          Last received: {formatTimeSince(webhookStatus.lastReceived)}
                        </p>
                      </div>
                    </div>
                  );
                })()}
                
                <div className="pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Total Received</span>
                      <p className="font-medium text-slate-900">{webhookStatus.totalReceived}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Total Processed</span>
                      <p className="font-medium text-slate-900">{webhookStatus.totalProcessed}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No webhook data available</p>
            )}
          </div>

          {/* System Status Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              System Status
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {systemStatus === 'loading' ? (
                  <>
                    <div className="h-3 w-3 bg-amber-500 rounded-full animate-pulse" />
                    <span className="font-medium text-amber-600">Processing...</span>
                  </>
                ) : (
                  <>
                    <div className="h-3 w-3 bg-emerald-500 rounded-full" />
                    <span className="font-medium text-emerald-600">Live</span>
                  </>
                )}
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Auto-refresh</span>
                    <span className="font-medium text-slate-900">
                      {pollingStatus.isActive ? '8s' : '30s'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Refresh reason</span>
                    <span className="font-medium text-slate-900">{pollingStatus.reason}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last updated</span>
                    <span className="font-medium text-slate-900">{formatDate(lastUpdated)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Email Status Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Latest Email
            </h2>
            
            {emailLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            ) : latestEmail ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📧</span>
                  <div>
                    <p className="font-medium text-slate-900">Email received</p>
                    <p className="text-sm text-slate-500">{formatDate(latestEmail.date)}</p>
                  </div>
                  {!latestEmail.isRead && (
                    <Badge variant="info" className="text-xs ml-auto">New</Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No emails available</p>
            )}
          </div>

          {/* Draft Status Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Latest Draft
            </h2>
            
            {draftLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            ) : latestDraft ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📝</span>
                  <div>
                    <p className="font-medium text-slate-900">Draft ready</p>
                    <p className="text-sm text-slate-500">{formatDate(latestDraft.createdAt)}</p>
                  </div>
                  {latestDraft.status === 'pending' && (
                    <Badge variant="warning" className="text-xs ml-auto">Needs Review</Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No drafts available</p>
            )}
          </div>
        </div>

        {/* Additional System Information */}
        <div className="mt-8 bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            System Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <h3 className="font-medium text-slate-900">Email Processing</h3>
              <p className="text-slate-600">
                {emailLoading ? 'Loading...' : 'Ready'}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-slate-900">Draft Generation</h3>
              <p className="text-slate-600">
                {draftLoading ? 'Loading...' : 'Ready'}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-slate-900">Webhook Integration</h3>
              <p className="text-slate-600">
                {webhookLoading ? 'Loading...' : webhookStatus ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}