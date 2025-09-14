import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Badge, Spinner, Button } from '../ui';
import { formatDate, truncateText } from '../../lib/utils';
import { useLatestDraft, useApproveAndSendDraft, useDeleteDraft, useUpdateDraft } from '../../hooks/useDrafts';
import { useToast } from '../../hooks/useToast';
import { useTopLearningInsight, useCurrentSuccessRate } from '../../hooks/useLearning';
import { FileText, Send, Edit3, Trash2, Clock, Target, Volume2, Save, X, Brain, TrendingUp } from 'lucide-react';

export function DraftPanel() {
  const { data, isLoading, error, refetch } = useLatestDraft();
  const { mutate: approveDraft, isPending: isApproving } = useApproveAndSendDraft();
  const { mutate: deleteDraft, isPending: isDeleting } = useDeleteDraft();
  const { mutate: updateDraft, isPending: isUpdating } = useUpdateDraft();
  const { success, error: showError } = useToast();
  const { insight: topInsight, hasHighConfidenceInsight } = useTopLearningInsight();
  const { successRate, trend } = useCurrentSuccessRate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  const latestDraft = data?.drafts?.[0];

  // Initialize edit fields when draft changes or editing starts
  const initializeEditFields = () => {
    if (latestDraft) {
      setEditedSubject(latestDraft.subject || '');
      setEditedBody(latestDraft.body || '');
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = isEditing && latestDraft && (
    editedSubject !== latestDraft.subject ||
    editedBody !== latestDraft.body
  );

  // Warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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


  const handleEdit = () => {
    if (!latestDraft) return;
    initializeEditFields();
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!latestDraft) return;
    
    // Validate inputs
    if (!editedSubject.trim()) {
      showError('Validation Error', 'Subject cannot be empty');
      return;
    }
    
    if (!editedBody.trim()) {
      showError('Validation Error', 'Email body cannot be empty');
      return;
    }

    updateDraft({
      id: latestDraft.id,
      data: {
        subject: editedSubject.trim(),
        body: editedBody.trim()
      }
    }, {
      onSuccess: () => {
        success('Draft Updated', 'Your changes have been saved successfully');
        setIsEditing(false);
        refetch();
      },
      onError: (error: any) => {
        showError('Update Failed', error?.message || 'Could not save your changes');
      },
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original values
    initializeEditFields();
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-slate-900">AI Draft</h2>
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
            <h2 className="text-xl font-semibold text-slate-900">AI Draft</h2>
          </div>
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
            <h2 className="text-xl font-semibold text-slate-900">AI Draft</h2>
          </div>
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
          <h2 className="text-xl font-semibold text-slate-900">AI Draft</h2>
        </div>
        <div className="flex items-center space-x-2">
          {hasHighConfidenceInsight && !isEditing && (
            <Badge variant="success" className="bg-purple-100 text-purple-800 border-purple-200">
              <Brain className="h-3 w-3 mr-1" />
              {topInsight?.confidence}% confident
            </Badge>
          )}
          {isEditing ? (
            <Badge variant="info" className="bg-blue-100 text-blue-800 border-blue-200">
              Editing
            </Badge>
          ) : (
            <Badge variant={latestDraft.status === 'pending' ? 'warning' : 'success'}>
              {latestDraft.status}
            </Badge>
          )}
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
              {isEditing ? (
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter email subject..."
                  disabled={isUpdating}
                />
              ) : (
                <p className="text-sm font-medium text-slate-900 mt-1">
                  {latestDraft.subject}
                </p>
              )}
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                Email Body
              </label>
              {isEditing ? (
                <div className="mt-1">
                  <textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-vertical"
                    placeholder="Enter email body..."
                    rows={8}
                    disabled={isUpdating}
                  />
                  <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                    <span>{editedBody.length} characters</span>
                    <span>Use Shift+Enter for line breaks</span>
                  </div>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          {isEditing ? (
            // Edit Mode Buttons
            <div className="flex items-center space-x-3">
              <Button
                onClick={handleSave}
                disabled={isUpdating || !editedSubject.trim() || !editedBody.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isUpdating ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isUpdating}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              
              {/* Send Edited Version */}
              <Button
                onClick={() => {
                  if (!latestDraft) return;
                  
                  // Validate inputs
                  if (!editedSubject.trim() || !editedBody.trim()) {
                    showError('Validation Error', 'Subject and body cannot be empty');
                    return;
                  }

                  // Save and then send
                  updateDraft({
                    id: latestDraft.id,
                    data: {
                      subject: editedSubject.trim(),
                      body: editedBody.trim()
                    }
                  }, {
                    onSuccess: () => {
                      success('Draft Updated', 'Changes saved successfully');
                      setIsEditing(false);
                      refetch();
                      // After successful save, send the draft
                      approveDraft(latestDraft.id, {
                        onSuccess: () => {
                          success('Email Sent', 'Your edited draft has been sent successfully');
                        },
                        onError: () => {
                          showError('Send Failed', 'Could not send the edited draft');
                        },
                      });
                    },
                    onError: (error: any) => {
                      showError('Update Failed', error?.message || 'Could not save your changes');
                    },
                  });
                }}
                disabled={isUpdating || isApproving || !editedSubject.trim() || !editedBody.trim()}
                variant="outline"
                className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
              >
                {isUpdating || isApproving ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Save & Send
              </Button>
            </div>
          ) : (
            // View Mode Buttons
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
                onClick={handleEdit}
                disabled={isApproving || isDeleting || isUpdating}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          )}

          {/* Delete button (always visible) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting || isApproving || isUpdating}
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

        {/* Learning Stats Footer */}
        {successRate > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                <span className="font-medium">Success Rate: {successRate.toFixed(1)}%</span>
              </div>
              {trend !== 'stable' && (
                <span className={`font-medium ${
                  trend === 'improving' ? 'text-green-600' : 'text-red-600'
                }`}>
                  ({trend})
                </span>
              )}
            </div>
            {topInsight && (
              <div className="flex items-center space-x-1 text-purple-600">
                <Brain className="h-3 w-3" />
                <span className="font-medium">Learning: {topInsight.pattern} patterns</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}