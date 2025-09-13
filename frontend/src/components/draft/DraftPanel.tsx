import { useState } from 'react';
import { Card, CardHeader, CardContent, Badge, Spinner, Button } from '../ui';
import { formatDate, truncateText } from '../../lib/utils';
import { useLatestDraft, useApproveAndSendDraft, useDeleteDraft } from '../../hooks/useDrafts';
import { useToast } from '../../hooks/useToast';
import { FileText, Send, Edit3, Trash2, RefreshCw, Clock, Target, Volume2 } from 'lucide-react';

export function DraftPanel() {
  const { data, isLoading, error, refetch } = useLatestDraft();
  const { mutate: approveDraft, isPending: isApproving } = useApproveAndSendDraft();
  const { mutate: deleteDraft, isPending: isDeleting } = useDeleteDraft();
  const { success, error: showError } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  const latestDraft = data?.drafts?.[0];

  const handleApprove = () => {
    if (!latestDraft) return;
    
    approveDraft(latestDraft.id, {
      onSuccess: () => {
        success('Draft Approved', 'Email has been sent successfully');
        refetch();
      },
      onError: () => {
        showError('Failed to Send', 'Could not approve and send the draft');
      },
    });
  };

  const handleDelete = () => {
    if (!latestDraft) return;
    
    deleteDraft(latestDraft.id, {
      onSuccess: () => {
        success('Draft Deleted', 'Draft has been removed');
        refetch();
      },
      onError: () => {
        showError('Failed to Delete', 'Could not delete the draft');
      },
    });
  };

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-semibold">AI Draft</h2>
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
            <FileText className="h-5 w-5 text-red-600" />
            <h2 className="text-xl font-semibold">AI Draft</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">📝</div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Failed to load drafts
            </h3>
            <p className="text-slate-500 mb-4">
              Could not connect to draft service
            </p>
            <Button onClick={handleRefresh}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!latestDraft) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-slate-400" />
            <h2 className="text-xl font-semibold">AI Draft</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-slate-300 text-6xl mb-4">📄</div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No drafts available
            </h3>
            <p className="text-slate-500 mb-4">
              AI drafts will appear here when emails are processed
            </p>
            <Button onClick={handleRefresh}>
              Check for Drafts
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-emerald-600" />
          <h2 className="text-xl font-semibold">AI Draft</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={latestDraft.status === 'pending' ? 'warning' : 'success'}>
            {latestDraft.status}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Draft Metadata */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center space-x-2 text-sm">
            <Volume2 className="h-4 w-4 text-blue-500" />
            <span className="text-slate-600">Tone:</span>
            <Badge variant="outline" className="text-xs">
              {latestDraft.tone || 'Professional'}
            </Badge>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <Target className="h-4 w-4 text-amber-500" />
            <span className="text-slate-600">Urgency:</span>
            <Badge variant="outline" className="text-xs">
              {latestDraft.urgencyLevel || 'Medium'}
            </Badge>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-slate-600">Generated:</span>
            <span className="text-xs text-slate-500">
              {formatDate(latestDraft.createdAt)}
            </span>
          </div>
        </div>

        {/* Draft Content */}
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                Subject
              </label>
              <p className="text-sm font-medium text-slate-900 mt-1">
                {latestDraft.subject}
              </p>
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                Email Body
              </label>
              <div className="mt-1">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {isExpanded 
                    ? latestDraft.body 
                    : truncateText(latestDraft.body, 300)
                  }
                </p>
                {latestDraft.body && latestDraft.body.length > 300 && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-blue-600 text-xs mt-2 hover:underline"
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleApprove}
              disabled={isApproving || latestDraft.status !== 'pending'}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isApproving ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Approve & Send
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              disabled={isApproving || isDeleting}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting || isApproving}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {isDeleting ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete
          </Button>
        </div>

        {/* Draft Stats */}
        <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
          <div className="flex items-center space-x-4">
            <span>ID: {latestDraft.id}</span>
            {latestDraft.originalEmailId && (
              <span>Reply to: #{latestDraft.originalEmailId}</span>
            )}
          </div>
          <span>Processing time: {latestDraft.processingTime || '0ms'}</span>
        </div>
      </CardContent>
    </Card>
  );
}