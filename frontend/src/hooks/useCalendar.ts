import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarService } from '../services/calendarService';
import type { 
  CalendarPreferences 
} from '../types/calendar';

/**
 * Query keys for calendar data
 */
export const calendarQueryKeys = {
  all: ['calendar'] as const,
  events: () => [...calendarQueryKeys.all, 'events'] as const,
  upcomingEvents: () => [...calendarQueryKeys.events(), 'upcoming'] as const,
  todaysEvents: () => [...calendarQueryKeys.events(), 'today'] as const,
  meetingRequests: () => [...calendarQueryKeys.all, 'meeting-requests'] as const,
  pendingRequests: () => [...calendarQueryKeys.meetingRequests(), 'pending'] as const,
  stats: () => [...calendarQueryKeys.all, 'stats'] as const,
  preferences: () => [...calendarQueryKeys.all, 'preferences'] as const,
};

/**
 * Hook to fetch upcoming calendar events (next 7 days)
 */
export function useUpcomingEvents() {
  return useQuery({
    queryKey: calendarQueryKeys.upcomingEvents(),
    queryFn: () => calendarService.getUpcomingEvents(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

/**
 * Hook to fetch today's calendar events
 */
export function useTodaysEvents() {
  return useQuery({
    queryKey: calendarQueryKeys.todaysEvents(),
    queryFn: () => calendarService.getTodaysEvents(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to fetch all meeting requests
 */
export function useMeetingRequests() {
  return useQuery({
    queryKey: calendarQueryKeys.meetingRequests(),
    queryFn: () => calendarService.getMeetingRequests(),
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

/**
 * Hook to fetch pending meeting requests
 */
export function usePendingMeetingRequests() {
  return useQuery({
    queryKey: calendarQueryKeys.pendingRequests(),
    queryFn: () => calendarService.getPendingMeetingRequests(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to fetch calendar statistics
 */
export function useCalendarStats() {
  return useQuery({
    queryKey: calendarQueryKeys.stats(),
    queryFn: () => calendarService.getCalendarStats(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch calendar preferences
 */
export function useCalendarPreferences() {
  return useQuery({
    queryKey: calendarQueryKeys.preferences(),
    queryFn: () => calendarService.getCalendarPreferences(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to update meeting request status
 */
export function useUpdateMeetingRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      requestId, 
      status 
    }: { 
      requestId: number; 
      status: 'pending' | 'scheduled' | 'declined' | 'cancelled' 
    }) => calendarService.updateMeetingRequestStatus(requestId, status),
    onSuccess: () => {
      // Invalidate and refetch meeting requests
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.meetingRequests() });
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.pendingRequests() });
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.stats() });
    },
  });
}

/**
 * Hook to update calendar preferences
 */
export function useUpdateCalendarPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preferences: Partial<CalendarPreferences>) => 
      calendarService.updateCalendarPreferences(preferences),
    onSuccess: () => {
      // Invalidate preferences query
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.preferences() });
    },
  });
}

/**
 * Hook to check calendar availability
 */
export function useCheckAvailability() {
  return useMutation({
    mutationFn: ({ startTime, endTime }: { startTime: string; endTime: string }) =>
      calendarService.checkAvailability(startTime, endTime),
  });
}

/**
 * Hook to suggest meeting times
 */
export function useSuggestMeetingTimes() {
  return useMutation({
    mutationFn: ({ 
      duration, 
      preferredDates, 
      attendees 
    }: { 
      duration: number; 
      preferredDates?: string[]; 
      attendees?: string[] 
    }) => calendarService.suggestMeetingTimes(duration, preferredDates, attendees),
  });
}

/**
 * Custom hook to get calendar overview data
 */
export function useCalendarOverview() {
  const { data: upcomingEvents, isLoading: upcomingLoading } = useUpcomingEvents();
  const { data: todaysEvents, isLoading: todayLoading } = useTodaysEvents();
  const { data: pendingRequests, isLoading: pendingLoading } = usePendingMeetingRequests();
  const { data: stats, isLoading: statsLoading } = useCalendarStats();

  return {
    upcomingEvents: upcomingEvents?.events || [],
    todaysEvents: todaysEvents?.events || [],
    pendingRequests: pendingRequests?.requests || [],
    stats: stats?.stats,
    isLoading: upcomingLoading || todayLoading || pendingLoading || statsLoading,
    // Quick stats for UI
    todayMeetingCount: todaysEvents?.events?.length || 0,
    upcomingMeetingCount: upcomingEvents?.events?.length || 0,
    pendingRequestCount: pendingRequests?.requests?.length || 0,
  };
}
