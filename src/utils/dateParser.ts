// Robust Date Parsing Utility - Phase 1 Fix
// Handles all date parsing edge cases to prevent RangeError crashes

export interface ParsedDate {
  date: Date | null;
  isValid: boolean;
  originalInput: string;
  errorMessage?: string;
  confidence: number; // 0-100
}

export class RobustDateParser {
  
  /**
   * Safely parse any date string without throwing RangeError
   */
  static safeParseDate(dateInput: string | Date | number | null | undefined): ParsedDate {
    const originalInput = String(dateInput || '');
    
    try {
      // Handle null/undefined
      if (!dateInput || dateInput === 'null' || dateInput === 'undefined') {
        return {
          date: null,
          isValid: false,
          originalInput,
          errorMessage: 'Input is null or undefined',
          confidence: 0
        };
      }

      // Handle empty strings
      if (typeof dateInput === 'string' && dateInput.trim() === '') {
        return {
          date: null,
          isValid: false,
          originalInput,
          errorMessage: 'Input is empty string',
          confidence: 0
        };
      }

      // If already a Date object, validate it
      if (dateInput instanceof Date) {
        const isValid = !isNaN(dateInput.getTime());
        return {
          date: isValid ? dateInput : null,
          isValid,
          originalInput,
          errorMessage: isValid ? undefined : 'Invalid Date object',
          confidence: isValid ? 100 : 0
        };
      }

      // If it's a number, treat as timestamp
      if (typeof dateInput === 'number') {
        const date = new Date(dateInput);
        const isValid = !isNaN(date.getTime());
        return {
          date: isValid ? date : null,
          isValid,
          originalInput,
          errorMessage: isValid ? undefined : 'Invalid timestamp',
          confidence: isValid ? 95 : 0
        };
      }

      // String parsing with various strategies
      const dateStr = String(dateInput).trim();
      
      // Try relative date parsing first
      const relativeResult = this.parseRelativeDate(dateStr);
      if (relativeResult.isValid) {
        return relativeResult;
      }

      // Try standard date parsing
      const standardResult = this.parseStandardDate(dateStr);
      if (standardResult.isValid) {
        return standardResult;
      }

      // Try fuzzy date parsing
      const fuzzyResult = this.parseFuzzyDate(dateStr);
      if (fuzzyResult.isValid) {
        return fuzzyResult;
      }

      // All parsing failed
      return {
        date: null,
        isValid: false,
        originalInput,
        errorMessage: 'Could not parse date with any strategy',
        confidence: 0
      };

    } catch (error) {
      return {
        date: null,
        isValid: false,
        originalInput,
        errorMessage: `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0
      };
    }
  }

  /**
   * Parse relative dates like "tomorrow", "next week", etc.
   */
  private static parseRelativeDate(dateStr: string): ParsedDate {
    const lowerStr = dateStr.toLowerCase();
    const now = new Date();

    try {
      // Today
      if (lowerStr.includes('today')) {
        return {
          date: new Date(now),
          isValid: true,
          originalInput: dateStr,
          confidence: 95
        };
      }

      // Tomorrow
      if (lowerStr.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return {
          date: tomorrow,
          isValid: true,
          originalInput: dateStr,
          confidence: 95
        };
      }

      // This week
      if (lowerStr.includes('this week')) {
        const thisWeek = new Date(now);
        // Default to next business day this week
        thisWeek.setDate(thisWeek.getDate() + 1);
        return {
          date: thisWeek,
          isValid: true,
          originalInput: dateStr,
          confidence: 80
        };
      }

      // Next week
      if (lowerStr.includes('next week')) {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return {
          date: nextWeek,
          isValid: true,
          originalInput: dateStr,
          confidence: 85
        };
      }

      // Days of the week
      const dayMap = {
        'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
        'friday': 5, 'saturday': 6, 'sunday': 0,
        'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 0
      };

      for (const [dayName, dayNum] of Object.entries(dayMap)) {
        if (lowerStr.includes(dayName)) {
          const targetDate = this.getNextDayOfWeek(now, dayNum);
          return {
            date: targetDate,
            isValid: true,
            originalInput: dateStr,
            confidence: 90
          };
        }
      }

      return {
        date: null,
        isValid: false,
        originalInput: dateStr,
        errorMessage: 'No relative date patterns matched',
        confidence: 0
      };

    } catch (error) {
      return {
        date: null,
        isValid: false,
        originalInput: dateStr,
        errorMessage: `Relative date parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0
      };
    }
  }

  /**
   * Parse standard date formats
   */
  private static parseStandardDate(dateStr: string): ParsedDate {
    try {
      // Common date formats to try
      const formats = [
        // ISO formats
        dateStr,
        
        // US formats
        dateStr.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, '$3-$1-$2'),
        dateStr.replace(/(\d{1,2})\/(\d{1,2})\/(\d{2})/, '20$3-$1-$2'),
        
        // European formats  
        dateStr.replace(/(\d{1,2})\.(\d{1,2})\.(\d{4})/, '$3-$2-$1'),
        
        // Natural language cleanup
        dateStr.replace(/(\d{1,2})(st|nd|rd|th)/, '$1'),
        
        // Add current year if missing
        new Date().getFullYear() + '-' + dateStr,
        
        // Try with time zones
        dateStr + 'T00:00:00Z',
        dateStr + ' PST',
        dateStr + ' UTC'
      ];

      for (const format of formats) {
        try {
          const date = new Date(format);
          if (!isNaN(date.getTime())) {
            // Additional validation: date should be reasonable
            const currentYear = new Date().getFullYear();
            const dateYear = date.getFullYear();
            
            if (dateYear >= currentYear - 1 && dateYear <= currentYear + 5) {
              return {
                date,
                isValid: true,
                originalInput: dateStr,
                confidence: 85
              };
            }
          }
        } catch {
          // Continue to next format
          continue;
        }
      }

      return {
        date: null,
        isValid: false,
        originalInput: dateStr,
        errorMessage: 'No standard date formats matched',
        confidence: 0
      };

    } catch (error) {
      return {
        date: null,
        isValid: false,
        originalInput: dateStr,
        errorMessage: `Standard date parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0
      };
    }
  }

  /**
   * Parse fuzzy/natural language dates
   */
  private static parseFuzzyDate(dateStr: string): ParsedDate {
    try {
      const lowerStr = dateStr.toLowerCase();
      const now = new Date();

      // Time patterns
      const timePatterns = [
        /(\d{1,2}):(\d{2})\s*(am|pm)/i,
        /(\d{1,2})\s*(am|pm)/i,
        /(\d{1,2}):\d{2}/
      ];

      // If contains time but no date, assume today or tomorrow
      const hasTime = timePatterns.some(pattern => pattern.test(dateStr));
      
      if (hasTime && !lowerStr.includes('today') && !lowerStr.includes('tomorrow')) {
        // If it's past business hours, assume tomorrow
        const currentHour = now.getHours();
        const targetDate = currentHour >= 17 ? this.addDays(now, 1) : new Date(now);
        
        return {
          date: targetDate,
          isValid: true,
          originalInput: dateStr,
          confidence: 70
        };
      }

      // Month names
      const months = ['january', 'february', 'march', 'april', 'may', 'june',
                     'july', 'august', 'september', 'october', 'november', 'december'];
      
      for (let i = 0; i < months.length; i++) {
        if (lowerStr.includes(months[i])) {
          // Try to extract day number
          const dayMatch = dateStr.match(/\b(\d{1,2})\b/);
          if (dayMatch) {
            const day = parseInt(dayMatch[1]);
            const year = now.getFullYear();
            const date = new Date(year, i, day);
            
            if (!isNaN(date.getTime())) {
              return {
                date,
                isValid: true,
                originalInput: dateStr,
                confidence: 75
              };
            }
          }
        }
      }

      return {
        date: null,
        isValid: false,
        originalInput: dateStr,
        errorMessage: 'No fuzzy date patterns matched',
        confidence: 0
      };

    } catch (error) {
      return {
        date: null,
        isValid: false,
        originalInput: dateStr,
        errorMessage: `Fuzzy date parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0
      };
    }
  }

  // Utility methods
  private static getNextDayOfWeek(startDate: Date, targetDay: number): Date {
    const date = new Date(startDate);
    const currentDay = date.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    date.setDate(date.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
    return date;
  }

  private static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

/**
 * Convenient wrapper functions for common use cases
 */
export function safeParseDate(input: any): Date | null {
  return RobustDateParser.safeParseDate(input).date;
}

export function safeParseDateWithValidation(input: any): ParsedDate {
  return RobustDateParser.safeParseDate(input);
}

export function isValidDate(input: any): boolean {
  return RobustDateParser.safeParseDate(input).isValid;
}