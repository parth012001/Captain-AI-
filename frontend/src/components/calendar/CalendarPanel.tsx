import { useState } from 'react';
import { Card, CardHeader, CardContent, Badge, Spinner, Button } from '../ui';
import { 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  MoreHorizontal,
  Plus,
  Filter
} from 'lucide-react';
import { useCalendarOverview, useUpdateMeetingRequestStatus } from '../../hooks/useCalendar';
import { useToast } from '../../hooks/useToast';
import type { CalendarEvent, MeetingRequest } from '../../types/calendar';

/**
 * Format time for display
 */
function formatTime(dateTime: string): string {
  return new Date(dateTime).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

/**
 * Format date for display
 */
function formatDate(dateTime: string): string {
  return new Date(dateTime).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get urgency badge color
 */
function getUrgencyBadgeColor(urgency: 'high' | 'medium' | 'low'): string {
  switch (urgency) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

/**
 * Get meeting type badge color
 */
function getMeetingTypeBadgeColor(type: 'urgent' | 'regular' | 'flexible' | 'recurring'): string {
  switch (type) {
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'regular':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'flexible':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'recurring':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

/**
 * Calendar Event Card Component
 */
function CalendarEventCard({ event }: { event: CalendarEvent }) {
  const startTime = event.start.dateTime ? formatTime(event.start.dateTime) : 'All day';
  const date = event.start.dateTime ? formatDate(event.start.dateTime) : 'All day';
  
  return (
    <div className="flex items-start space-x-3 p-4 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex-shrink-0 w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-900 truncate">
            {event.summary}
          </h4>
          <span className="text-xs text-slate-500 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {startTime}
          </span>
        </div>
        {event.description && (
          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
            {event.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-500">{date}</span>
          {event.location && (
            <span className="text-xs text-slate-500 flex items-center">
              <MapPin className="w-3 h-3 mr-1" />
              {event.location}
            </span>
          )}
        </div>
        {event.attendees && event.attendees.length > 1 && (
          <div className="flex items-center mt-2">
            <Users className="w-3 h-3 text-slate-400 mr-1" />
            <span className="text-xs text-slate-500">
              {event.attendees.length} attendees
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Meeting Request Card Component
 */
function MeetingRequestCard({ request }: { request: MeetingRequest }) {
  const { mutate: updateStatus, isPending } = useUpdateMeetingRequestStatus();
  const { addToast } = useToast();

  const handleStatusUpdate = (status: 'scheduled' | 'declined') => {
    updateStatus(
      { requestId: request.id, status },
      {
        onSuccess: () => {
          addToast({
            title: 'Meeting Request Updated',
            description: `Meeting request ${status === 'scheduled' ? 'accepted' : 'declined'} successfully.`,
            type: 'success'
          });
        },
        onError: () => {
          addToast({
            title: 'Update Failed',
            description: 'Failed to update meeting request status.',
            type: 'error'
          });
        }
      }
    );
  };

  const createdDate = formatDate(request.created_at);
  const duration = request.requested_duration ? `${request.requested_duration} min` : 'TBD';

  return (
    <div className="flex items-start space-x-3 p-4 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <Calendar className="w-4 h-4 text-blue-600" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-slate-900">
              {request.subject || 'Meeting Request'}
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              From: {request.sender_email}
            </p>
          </div>
          <Badge 
            variant="muted" 
            className={`text-xs ${getUrgencyBadgeColor(request.urgency_level)}`}
          >
            {request.urgency_level}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2 mt-2">
          <Badge 
            variant="muted" 
            className={`text-xs ${getMeetingTypeBadgeColor(request.meeting_type)}`}
          >
            {request.meeting_type}
          </Badge>
          <span className="text-xs text-slate-500">•</span>
          <span className="text-xs text-slate-500">{duration}</span>
          <span className="text-xs text-slate-500">•</span>
          <span className="text-xs text-slate-500">{createdDate}</span>
        </div>

        {request.special_requirements && (
          <p className="text-xs text-slate-600 mt-2 p-2 bg-slate-50 rounded">
            Requirements: {request.special_requirements}
          </p>
        )}

        <div className="flex items-center space-x-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs"
            onClick={() => handleStatusUpdate('scheduled')}
            disabled={isPending}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => handleStatusUpdate('declined')}
            disabled={isPending}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Decline
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
          >
            <MoreHorizontal className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Calendar Panel Component
 */
export function CalendarPanel() {
  const [activeView, setActiveView] = useState<'overview' | 'events' | 'requests'>('overview');
  const { 
    upcomingEvents, 
    todaysEvents, 
    pendingRequests, 
    isLoading,
    todayMeetingCount,
    upcomingMeetingCount,
    pendingRequestCount
  } = useCalendarOverview();

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          <p className="text-slate-600">Loading calendar data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-16rem)] overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center">
              <Calendar className="w-6 h-6 mr-3 text-emerald-600" />
              Calendar & Meetings
            </h2>
            <p className="text-slate-600 mt-1">
              Manage your schedule and meeting requests
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Event
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-900">
                    Today's Meetings
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {todayMeetingCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-900">
                    Upcoming
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {upcomingMeetingCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-900">
                    Pending Requests
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {pendingRequestCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* View Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', count: null },
            { id: 'events', label: 'Upcoming Events', count: upcomingMeetingCount },
            { id: 'requests', label: 'Meeting Requests', count: pendingRequestCount }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeView === tab.id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <Badge variant="muted" className="bg-slate-100 text-slate-600 text-xs">
                    {tab.count}
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* Today's Events */}
          {todaysEvents.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  Today's Events
                </h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {todaysEvents.slice(0, 3).map((event) => (
                  <CalendarEventCard key={event.id} event={event} />
                ))}
                {todaysEvents.length > 3 && (
                  <p className="text-sm text-slate-500 text-center py-2">
                    And {todaysEvents.length - 3} more events today
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-emerald-600" />
                  Upcoming Events
                </h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingEvents.slice(0, 5).map((event) => (
                  <CalendarEventCard key={event.id} event={event} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
                  Pending Meeting Requests
                </h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingRequests.slice(0, 3).map((request) => (
                  <MeetingRequestCard key={request.id} request={request} />
                ))}
                {pendingRequests.length > 3 && (
                  <p className="text-sm text-slate-500 text-center py-2">
                    And {pendingRequests.length - 3} more pending requests
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {todaysEvents.length === 0 && upcomingEvents.length === 0 && pendingRequests.length === 0 && (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    No Calendar Activity
                  </h3>
                  <p className="text-slate-600 mb-4">
                    Your calendar is empty. Start by adding events or checking for meeting requests.
                  </p>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Event
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeView === 'events' && (
        <div className="space-y-4">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => (
              <CalendarEventCard key={event.id} event={event} />
            ))
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    No Upcoming Events
                  </h3>
                  <p className="text-slate-600">
                    You don't have any upcoming events scheduled.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeView === 'requests' && (
        <div className="space-y-4">
          {pendingRequests.length > 0 ? (
            pendingRequests.map((request) => (
              <MeetingRequestCard key={request.id} request={request} />
            ))
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    No Pending Requests
                  </h3>
                  <p className="text-slate-600">
                    You don't have any pending meeting requests.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
