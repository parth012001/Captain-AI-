// React import not needed for modern JSX transform
import { useState } from 'react';
import { Card, CardHeader, CardContent, Badge, Spinner } from '../ui';
import { formatDate, truncateText } from '../../lib/utils';
import { useLatestDraft } from '../../hooks/useDrafts';
import { Mail, User } from 'lucide-react';

export function EmailPanel() {
  const { data, isLoading, error } = useLatestDraft();
  const [isExpanded, setIsExpanded] = useState(false);

  const latestDraft = data?.drafts?.[0];
  const latestEmail = latestDraft?.originalEmail;


  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-900">Latest Email</h2>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-3">
            <Spinner size="lg" />
            <p className="text-slate-500">Loading latest draft...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-red-600" />
            <h2 className="text-xl font-semibold text-slate-900">Latest Email</h2>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">📧</div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Failed to load drafts
            </h3>
            <p className="text-slate-500 mb-4">
              Could not connect to draft service
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!latestEmail) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-slate-400" />
            <h2 className="text-xl font-semibold text-slate-900">Latest Email</h2>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-slate-300 text-6xl mb-4">📬</div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No processed emails found
            </h3>
            <p className="text-slate-500 mb-4">
              Waiting for webhook to process new emails
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mail className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">Latest Email</h2>
        </div>
        <div className="flex items-center space-x-2">
          {!latestEmail.isRead && (
            <Badge variant="info">New</Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Email Header */}
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {latestEmail.from}
                </p>
                <p className="text-xs text-slate-500 flex-shrink-0 ml-2">
                  {formatDate(latestEmail.date)}
                </p>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mt-1 leading-tight">
                {truncateText(latestEmail.subject, 60)}
              </h3>
            </div>
          </div>
        </div>

        {/* Email Content */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-slate-900 mb-2">Email Content</h4>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {isExpanded 
              ? latestEmail.preview 
              : truncateText(latestEmail.preview, 300)
            }
          </div>
          {latestEmail.preview && latestEmail.preview.length > 300 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 text-xs mt-2 hover:underline"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Email Stats */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-4 text-xs text-slate-500">
            <span>Draft: #{latestDraft.id}</span>
            {latestEmail.gmailId && (
              <span>Gmail: {latestEmail.gmailId.substring(0, 8)}...</span>
            )}
          </div>
          <Badge variant={latestEmail.isRead ? 'muted' : 'info'}>
            {latestEmail.isRead ? 'Read' : 'Unread'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}