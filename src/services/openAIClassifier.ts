// OpenAI Meeting Classification Service - Phase 2
// Intelligent meeting detection using OpenAI GPT models

import OpenAI from 'openai';
import { ParsedEmail } from '../types';

export interface EmailClassification {
  isMeeting: boolean;
  confidence: number; // 0-100
  reasoning: string;
  meetingType?: 'call' | 'in-person' | 'lunch' | 'coffee' | 'business' | 'social' | 'unclear' | null;
  urgencyLevel?: 'high' | 'medium' | 'low' | null;
  timeFrame?: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'flexible' | 'unclear' | null;
  extractedTimes?: string[];
  fallbackUsed?: boolean;
}

export class OpenAIMeetingClassifier {
  private openai: OpenAI;
  private model: string;
  private maxRetries: number;
  private requestTimeout: number;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 10000 // 10 second timeout
    });
    
    // Start with GPT-3.5-Turbo for cost efficiency
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.maxRetries = 3;
    this.requestTimeout = 8000; // 8 seconds
  }

  /**
   * Classify email using OpenAI with comprehensive meeting detection
   */
  async classifyEmailType(email: ParsedEmail): Promise<EmailClassification> {
    const startTime = Date.now();
    
    try {
      console.log(`🧠 [OPENAI CLASSIFIER] Analyzing email: "${email.subject}" from ${email.from}`);
      
      // Build comprehensive prompt
      const prompt = this.buildClassificationPrompt(email);
      
      // Make OpenAI API call with retry logic
      const response = await this.makeOpenAIRequest(prompt);
      
      const processingTime = Date.now() - startTime;
      console.log(`⚡ [OPENAI CLASSIFIER] Processed in ${processingTime}ms`);
      
      return response;
      
    } catch (error) {
      console.error('❌ [OPENAI CLASSIFIER] Error:', error);
      
      // Fallback to keyword-based classification
      console.log('🔄 [OPENAI CLASSIFIER] Falling back to keyword classification');
      return this.fallbackKeywordClassification(email);
    }
  }

  /**
   * Build comprehensive classification prompt
   */
  private buildClassificationPrompt(email: ParsedEmail): string {
    return `You are an expert email classifier specializing in meeting request detection. Analyze this email to determine if it's requesting a meeting, call, appointment, or any scheduled interaction.

EMAIL DETAILS:
Subject: "${email.subject}"
From: ${email.from}
To: ${email.to || 'Not specified'}
Body: "${email.body}"

CLASSIFICATION TASK:
Determine if this email is requesting a meeting, call, appointment, or any form of scheduled interaction.

MEETING REQUEST INDICATORS (look for these):
✅ EXPLICIT REQUESTS:
- "let's meet", "can we meet", "schedule a meeting"
- "are you free", "available for", "when are you free"
- "let's schedule", "book a time", "set up a meeting"
- "hop on a call", "quick call", "zoom meeting"

✅ SOCIAL/BUSINESS MEETUPS:
- "coffee", "lunch", "dinner", "drinks"
- "catch up", "sync up", "touch base"
- "get together", "meet up"

✅ TIME COORDINATION:
- Mentions specific times: "2 PM", "tomorrow", "next week"
- Calendar-related language: "calendar", "schedule", "appointment"
- Availability questions: "when works", "what time"

✅ MEETING PLATFORMS:
- "zoom", "teams", "google meet", "skype"
- "conference room", "office", "location"

❌ NOT MEETING REQUESTS:
- Newsletter/promotional content
- Information sharing without scheduling
- Questions that don't require face-to-face interaction
- File sharing or document requests
- Status updates or reports
- Automated notifications
- CONFIRMATIONS of existing meetings (not new requests)
- Calendar notifications/reminders (not requests)
- Meeting room booking confirmations
- Invites that are notifications, not requests

ANALYSIS INSTRUCTIONS:
1. Look for INTENT to coordinate NEW time/schedule (not confirm existing)
2. Consider CONTEXT of the relationship and sender
3. Evaluate URGENCY based on language
4. Extract any TIME references
5. Determine MEETING TYPE if applicable
6. DISTINGUISH between requests vs confirmations/notifications

IMPORTANT DISTINCTIONS:
- "Can we meet?" = MEETING REQUEST ✅
- "Meeting confirmed for Monday" = NOT a request ❌ 
- "Calendar invite sent" = NOT a request ❌
- "Your booking is confirmed" = NOT a request ❌

Return JSON with this exact structure:
{
  "is_meeting_request": boolean,
  "confidence": number (0-100),
  "reasoning": "brief explanation of decision in 1-2 sentences",
  "meeting_type": "call|in-person|lunch|coffee|business|social|unclear" or null,
  "urgency_level": "high|medium|low" or null,
  "time_frame": "today|tomorrow|this_week|next_week|flexible|unclear" or null,
  "extracted_times": ["list", "of", "time", "mentions"] or []
}

EXAMPLES:

Email: "Are you free for coffee tomorrow at 2 PM?"
Response: {"is_meeting_request": true, "confidence": 98, "reasoning": "Direct invitation for coffee with specific time", "meeting_type": "coffee", "urgency_level": "medium", "time_frame": "tomorrow", "extracted_times": ["tomorrow at 2 PM"]}

Email: "Can you send me the quarterly report?"
Response: {"is_meeting_request": false, "confidence": 95, "reasoning": "Request for document delivery, no scheduling involved", "meeting_type": null, "urgency_level": null, "time_frame": null, "extracted_times": []}

Email: "Let's sync up on the project when you have time"
Response: {"is_meeting_request": true, "confidence": 90, "reasoning": "Request to coordinate and sync, implies scheduled discussion", "meeting_type": "business", "urgency_level": "medium", "time_frame": "flexible", "extracted_times": []}

Email: "Meeting invite sent for 'Project Review' on Monday 10 AM. Please accept or decline."
Response: {"is_meeting_request": false, "confidence": 90, "reasoning": "This is a notification about an invite already sent, not a new request for meeting", "meeting_type": null, "urgency_level": null, "time_frame": null, "extracted_times": ["Monday 10 AM"]}

Now analyze the email above and return JSON:`;
  }

  /**
   * Make OpenAI API request with retry logic and proper error handling
   */
  private async makeOpenAIRequest(prompt: string): Promise<EmailClassification> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 [OPENAI] Attempt ${attempt}/${this.maxRetries} with model ${this.model}`);
        
        const response = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: "system",
              content: "You are an expert email classifier. Always respond with valid JSON only, no additional text or formatting."
            },
            {
              role: "user", 
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent classification
          max_tokens: 400,
          response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        // Parse JSON response
        const result = JSON.parse(content);
        
        // Validate response structure
        this.validateOpenAIResponse(result);
        
        // Convert to our interface
        const classification: EmailClassification = {
          isMeeting: result.is_meeting_request,
          confidence: Math.min(100, Math.max(0, result.confidence)),
          reasoning: result.reasoning || 'No reasoning provided',
          meetingType: result.meeting_type || null,
          urgencyLevel: result.urgency_level || null,
          timeFrame: result.time_frame || null,
          extractedTimes: result.extracted_times || [],
          fallbackUsed: false
        };

        console.log(`✅ [OPENAI] Classification: ${classification.isMeeting ? 'MEETING' : 'NO-MEETING'} (${classification.confidence}%)`);
        console.log(`💭 [OPENAI] Reasoning: ${classification.reasoning}`);
        
        return classification;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ [OPENAI] Attempt ${attempt} failed:`, error instanceof Error ? error.message : 'Unknown error');
        
        // If we're running out of attempts, try GPT-4 as fallback
        if (attempt === this.maxRetries - 1 && this.model === 'gpt-3.5-turbo') {
          console.log('🔄 [OPENAI] Trying GPT-4 as final fallback');
          this.model = 'gpt-4';
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // All attempts failed
    throw lastError || new Error('OpenAI classification failed after all retries');
  }

  /**
   * Validate OpenAI response structure
   */
  private validateOpenAIResponse(result: any): void {
    if (typeof result.is_meeting_request !== 'boolean') {
      throw new Error('Invalid response: is_meeting_request must be boolean');
    }
    
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 100) {
      throw new Error('Invalid response: confidence must be number 0-100');
    }
    
    if (typeof result.reasoning !== 'string') {
      throw new Error('Invalid response: reasoning must be string');
    }
  }

  /**
   * Fallback keyword-based classification when OpenAI fails
   */
  private fallbackKeywordClassification(email: ParsedEmail): EmailClassification {
    console.log('🔄 [FALLBACK] Using keyword-based classification');
    
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    const combinedText = `${subject} ${body}`;

    // Meeting keywords with weights
    const meetingKeywords = [
      { words: ['meeting', 'meet'], weight: 3 },
      { words: ['lunch', 'coffee', 'dinner'], weight: 3 },
      { words: ['call', 'zoom', 'teams'], weight: 3 },
      { words: ['schedule', 'calendar'], weight: 2 },
      { words: ['available', 'free'], weight: 2 },
      { words: ['catch up', 'sync up', 'touch base'], weight: 2 },
      { words: ['appointment', 'booking'], weight: 2 }
    ];

    // Time indicators
    const timeKeywords = [
      'tomorrow', 'today', 'next week', 'this week',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
      'am', 'pm', 'o\'clock', ':00', ':30'
    ];

    let meetingScore = 0;
    let hasTimeReference = false;
    let foundKeywords: string[] = [];

    // Calculate meeting score
    meetingKeywords.forEach(({ words, weight }) => {
      words.forEach(word => {
        if (combinedText.includes(word)) {
          meetingScore += weight;
          foundKeywords.push(word);
        }
      });
    });

    // Check for time references
    hasTimeReference = timeKeywords.some(keyword => combinedText.includes(keyword));

    // Calculate confidence based on score and time reference
    let confidence = Math.min(90, meetingScore * 15); // Max 90% for keyword matching
    if (hasTimeReference) confidence += 10;
    confidence = Math.min(95, confidence); // Cap at 95% for fallback

    const isMeeting = meetingScore >= 2 && confidence >= 60;

    return {
      isMeeting,
      confidence,
      reasoning: `Fallback keyword analysis: ${foundKeywords.join(', ')} (score: ${meetingScore}, time: ${hasTimeReference})`,
      meetingType: isMeeting ? 'unclear' : null,
      urgencyLevel: isMeeting ? 'medium' : null,
      timeFrame: hasTimeReference ? 'unclear' : null,
      extractedTimes: [],
      fallbackUsed: true
    };
  }

  /**
   * Test the classifier with a batch of emails
   */
  async testClassification(testEmails: ParsedEmail[]): Promise<EmailClassification[]> {
    console.log(`🧪 [OPENAI CLASSIFIER] Testing with ${testEmails.length} emails`);
    
    const results: EmailClassification[] = [];
    
    for (const email of testEmails) {
      try {
        const result = await this.classifyEmailType(email);
        results.push(result);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ [TEST] Failed to classify email "${email.subject}":`, error);
        
        // Add fallback result
        results.push({
          isMeeting: false,
          confidence: 0,
          reasoning: 'Classification failed',
          fallbackUsed: true
        });
      }
    }
    
    return results;
  }

  /**
   * Get classification statistics
   */
  getClassificationStats(results: EmailClassification[]) {
    const total = results.length;
    const meetings = results.filter(r => r.isMeeting).length;
    const fallbacks = results.filter(r => r.fallbackUsed).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / total;

    return {
      total,
      meetingsDetected: meetings,
      nonMeetings: total - meetings,
      fallbacksUsed: fallbacks,
      openAISuccessRate: ((total - fallbacks) / total * 100).toFixed(1),
      averageConfidence: avgConfidence.toFixed(1)
    };
  }
}