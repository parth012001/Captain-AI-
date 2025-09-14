import { CalendarService, AvailabilityCheck } from './calendar';

export interface TimeSlotSuggestion {
  start: string;
  end: string;
  confidence: number;
  reason: string;
}

export interface BusinessHours {
  start: string; // "09:00"
  end: string;   // "17:00"
  timezone: string; // "America/Los_Angeles"
  workingDays: number[]; // [1,2,3,4,5] for Monday-Friday
}

export interface AvailabilityRequest {
  duration: number; // minutes
  preferredDate?: string; // ISO date string
  businessHours?: BusinessHours;
  maxSuggestions?: number;
  excludeWeekends?: boolean;
}

export class SmartAvailabilityService {
  private calendarService: CalendarService;
  private defaultBusinessHours: BusinessHours = {
    start: "09:00",
    end: "17:00", 
    timezone: "America/Los_Angeles", // PST
    workingDays: [1, 2, 3, 4, 5] // Monday-Friday
  };

  constructor(calendarService: CalendarService) {
    this.calendarService = calendarService;
  }

  /**
   * Generate smart time slot suggestions based on availability and business hours
   */
  async generateTimeSlotSuggestions(
    request: AvailabilityRequest,
    userId: string
  ): Promise<TimeSlotSuggestion[]> {
    try {
      console.log(`📅 Generating time slots for ${request.duration}min meeting...`);
      
      // Initialize calendar service with user tokens
      await this.initializeCalendarForUser(userId);
      
      const businessHours = request.businessHours || this.defaultBusinessHours;
      const maxSuggestions = request.maxSuggestions || 3;
      
      // Determine the date range to check
      const dateRange = this.calculateDateRange(request.preferredDate, businessHours);
      
      // Get all available time slots in the range
      const allSlots = await this.findAvailableSlots(
        dateRange.start,
        dateRange.end,
        request.duration,
        businessHours,
        userId
      );
      
      // Rank and select the best slots
      const rankedSlots = this.rankTimeSlots(allSlots, businessHours);
      
      // Return top suggestions
      const suggestions = rankedSlots.slice(0, maxSuggestions);
      
      console.log(`📅 Generated ${suggestions.length} time slot suggestions`);
      return suggestions;
      
    } catch (error) {
      console.error('❌ Error generating time slot suggestions:', error);
      return [];
    }
  }

  /**
   * Check if a specific time slot is available
   */
  async checkSpecificTimeSlot(
    startTime: string,
    duration: number,
    userId: string
  ): Promise<AvailabilityCheck> {
    try {
      // Initialize calendar service with user tokens
      await this.initializeCalendarForUser(userId);
      
      const start = new Date(startTime);
      const end = new Date(start.getTime() + (duration * 60 * 1000));
      
      return await this.calendarService.checkAvailability(
        start.toISOString(),
        end.toISOString()
      );
    } catch (error) {
      console.error('❌ Error checking specific time slot:', error);
      throw error;
    }
  }

  /**
   * Calculate the date range to check for availability
   */
  private calculateDateRange(
    preferredDate?: string,
    businessHours: BusinessHours = this.defaultBusinessHours
  ): { start: string; end: string } {
    const now = new Date();
    const pstNow = this.convertToPST(now);
    
    let startDate: Date;
    let endDate: Date;
    
    if (preferredDate) {
      // If specific date requested, check that day and next few days
      startDate = new Date(preferredDate);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7); // Check next 7 days
    } else {
      // Default: check from tomorrow for next 14 days
      startDate = new Date(pstNow);
      startDate.setDate(startDate.getDate() + 1); // Start from tomorrow
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 14); // Check next 14 days
    }
    
    // Ensure we start from a working day
    startDate = this.getNextWorkingDay(startDate, businessHours.workingDays);
    
    return {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    };
  }

  /**
   * Find all available time slots in a date range
   */
  private async findAvailableSlots(
    startDate: string,
    endDate: string,
    duration: number,
    businessHours: BusinessHours,
    userId: string
  ): Promise<TimeSlotSuggestion[]> {
    const slots: TimeSlotSuggestion[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    // Check each day in the range
    while (current < end) {
      // Skip weekends if configured
      const dayOfWeek = current.getDay();
      if (businessHours.workingDays.includes(dayOfWeek)) {
        const daySlots = await this.findSlotsForDay(
          current,
          duration,
          businessHours,
          userId
        );
        slots.push(...daySlots);
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return slots;
  }

  /**
   * Find available slots for a specific day
   */
  private async findSlotsForDay(
    date: Date,
    duration: number,
    businessHours: BusinessHours,
    userId: string
  ): Promise<TimeSlotSuggestion[]> {
    const slots: TimeSlotSuggestion[] = [];
    
    // Create time slots every 30 minutes during business hours
    const slotInterval = 30; // minutes
    const startHour = parseInt(businessHours.start.split(':')[0]);
    const endHour = parseInt(businessHours.end.split(':')[0]);
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        // Skip if slot would go beyond business hours
        const slotEndHour = hour + Math.floor((minute + duration) / 60);
        const slotEndMinute = (minute + duration) % 60;
        
        if (slotEndHour > endHour || (slotEndHour === endHour && slotEndMinute > 0)) {
          continue;
        }
        
        // Create the time slot
        let slotStart = new Date(date);
        slotStart.setHours(hour, minute, 0, 0);
        slotStart = this.convertToPST(slotStart);
        
        const slotEnd = new Date(slotStart.getTime() + (duration * 60 * 1000));
        
        // Check availability for this slot
        try {
          const availability = await this.calendarService.checkAvailability(
            slotStart.toISOString(),
            slotEnd.toISOString()
          );
          
          if (availability.isAvailable) {
            slots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              confidence: this.calculateSlotConfidence(slotStart, businessHours),
              reason: this.getSlotReason(slotStart, businessHours)
            });
          }
        } catch (error) {
          console.warn(`⚠️ Error checking slot ${slotStart.toISOString()}:`, error);
        }
      }
    }
    
    return slots;
  }

  /**
   * Rank time slots by preference
   */
  private rankTimeSlots(
    slots: TimeSlotSuggestion[],
    businessHours: BusinessHours
  ): TimeSlotSuggestion[] {
    return slots.sort((a, b) => {
      // Higher confidence first
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      
      // Earlier times first (within same confidence)
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
  }

  /**
   * Calculate confidence score for a time slot
   */
  private calculateSlotConfidence(
    slotStart: Date,
    businessHours: BusinessHours
  ): number {
    let confidence = 50; // Base confidence
    
    const hour = slotStart.getHours();
    const dayOfWeek = slotStart.getDay();
    
    // Boost confidence for preferred times
    if (hour >= 10 && hour <= 11) {
      confidence += 20; // Morning meetings
    } else if (hour >= 14 && hour <= 15) {
      confidence += 15; // Afternoon meetings
    } else if (hour >= 9 && hour <= 17) {
      confidence += 10; // Business hours
    }
    
    // Boost confidence for weekdays
    if (businessHours.workingDays.includes(dayOfWeek)) {
      confidence += 10;
    }
    
    // Reduce confidence for very early or late times
    if (hour < 9 || hour > 16) {
      confidence -= 15;
    }
    
    return Math.min(95, Math.max(5, confidence));
  }

  /**
   * Get human-readable reason for slot preference
   */
  private getSlotReason(
    slotStart: Date,
    businessHours: BusinessHours
  ): string {
    const hour = slotStart.getHours();
    
    if (hour >= 10 && hour <= 11) {
      return "Optimal morning time";
    } else if (hour >= 14 && hour <= 15) {
      return "Good afternoon slot";
    } else if (hour >= 9 && hour <= 17) {
      return "Business hours";
    } else {
      return "Available time";
    }
  }

  /**
   * Convert date to PST timezone
   */
  private convertToPST(date: Date): Date {
    // Simple PST conversion (UTC-8)
    // In production, you'd want to use a proper timezone library
    const pstOffset = -8 * 60; // PST is UTC-8
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    return new Date(utc + (pstOffset * 60000));
  }

  /**
   * Get the next working day
   */
  private getNextWorkingDay(
    date: Date,
    workingDays: number[]
  ): Date {
    let nextDay = new Date(date);
    
    while (!workingDays.includes(nextDay.getDay())) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return nextDay;
  }

  /**
   * Initialize calendar service with user tokens
   */
  private async initializeCalendarForUser(userId: string): Promise<void> {
    try {
      // Import the token storage service
      const { TokenStorageService } = await import('./tokenStorage');
      const tokenStorageService = new TokenStorageService();
      
      // Get user credentials
      const credentials = await tokenStorageService.getDecryptedCredentials(userId);
      if (!credentials) {
        throw new Error(`No calendar access tokens found for user: ${userId}`);
      }

      // Set tokens in calendar service
      await this.calendarService.setStoredTokens(credentials.accessToken, credentials.refreshToken);
      
    } catch (error) {
      console.error('❌ Error initializing calendar for user:', error);
      throw error;
    }
  }

  /**
   * Format time slot for display
   */
  formatTimeSlot(slot: TimeSlotSuggestion): string {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'short'
    };
    
    const startStr = start.toLocaleString('en-US', options);
    const endStr = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Los_Angeles'
    });
    
    return `${startStr} - ${endStr} PST`;
  }
}
