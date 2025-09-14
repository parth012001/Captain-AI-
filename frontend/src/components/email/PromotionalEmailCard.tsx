import { useState } from 'react';
import { Check, Trash2, ChevronDown, ChevronUp, Clock, User } from 'lucide-react';
import { Button } from '../ui';
import { formatDate, truncateText } from '../../lib/utils';
import { useMarkPromotionalEmailAsRead, useDeletePromotionalEmail } from '../../hooks/usePromotionalEmails';
import { useToast } from '../../hooks/useToast';
import type { PromotionalEmail } from '../../types/promotionalEmail';

interface PromotionalEmailCardProps {
  email: PromotionalEmail;
}

export function PromotionalEmailCard({ email }: PromotionalEmailCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { mutate: markAsRead } = useMarkPromotionalEmailAsRead();
  const { mutate: deleteEmail } = useDeletePromotionalEmail();
  const { success, error: showError } = useToast();

  const handleMarkAsRead = async () => {
    if (email.is_read) return;
    
    setIsMarkingAsRead(true);
    markAsRead(email.id, {
      onSuccess: () => {
        success('Email marked as read', 'Promotional email has been marked as read');
      },
      onError: (error: any) => {
        showError('Failed to mark as read', error?.message || 'Could not mark email as read');
      },
      onSettled: () => {
        setIsMarkingAsRead(false);
      }
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    deleteEmail(email.id, {
      onSuccess: () => {
        success('Email deleted', 'Promotional email has been deleted');
      },
      onError: (error: any) => {
        showError('Failed to delete', error?.message || 'Could not delete email');
      },
      onSettled: () => {
        setIsDeleting(false);
      }
    });
  };

  const getClassificationColor = (reason: string) => {
    switch (reason) {
      case 'newsletter':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'marketing':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'promotional':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getClassificationIcon = (reason: string) => {
    switch (reason) {
      case 'newsletter':
        return '📰';
      case 'marketing':
        return '📢';
      case 'promotional':
        return '🎯';
      default:
        return '📧';
    }
  };

  return (
    <div className={`
      border rounded-lg transition-all duration-200 hover:shadow-sm
      ${email.is_read 
        ? 'bg-slate-50 border-slate-200' 
        : 'bg-white border-slate-300 shadow-sm'
      }
    `}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Header with subject and status */}
            <div className="flex items-center space-x-2 mb-2">
              <h4 className={`
                text-sm font-medium truncate
                ${email.is_read ? 'text-slate-600' : 'text-slate-900'}
              `}>
                {email.subject || 'No Subject'}
              </h4>
              {!email.is_read && (
                <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
              )}
            </div>
            
            {/* Metadata */}
            <div className="flex items-center space-x-4 text-xs text-slate-500 mb-3">
              <div className="flex items-center space-x-1">
                <User className="h-3 w-3" />
                <span className="truncate max-w-48">{email.from_email}</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{formatDate(email.date)}</span>
              </div>
            </div>

            {/* Classification badge */}
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-xs">{getClassificationIcon(email.classification_reason)}</span>
              <span className={`
                inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
                ${getClassificationColor(email.classification_reason)}
              `}>
                {email.classification_reason}
              </span>
            </div>

            {/* Preview text */}
            <p className="text-xs text-slate-600 leading-relaxed">
              {truncateText(email.preview, isExpanded ? 500 : 100)}
            </p>
            
            {/* Expanded content */}
            {isExpanded && (
              <div className="mt-3 p-3 bg-slate-100 rounded text-xs text-slate-700 leading-relaxed">
                <div className="space-y-2">
                  <div>
                    <span className="font-medium text-slate-800">From:</span> {email.from_email}
                  </div>
                  <div>
                    <span className="font-medium text-slate-800">Date:</span> {formatDate(email.date)}
                  </div>
                  <div>
                    <span className="font-medium text-slate-800">Type:</span> {email.classification_reason}
                  </div>
                  {email.preview && (
                    <div className="mt-2 pt-2 border-t border-slate-300">
                      <span className="font-medium text-slate-800">Content:</span>
                      <div className="mt-1 whitespace-pre-wrap">{email.preview}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center space-x-1 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-slate-500 hover:text-slate-700"
              title={isExpanded ? 'Show less' : 'Show more'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {!email.is_read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAsRead}
                disabled={isMarkingAsRead}
                className="text-slate-500 hover:text-slate-700"
                title="Mark as read"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              title="Delete email"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
