import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export class AIService {
  public openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Generic completion method for any AI task
  async generateCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: { temperature?: number; maxTokens?: number; model?: string } = {}
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4o-mini',
        messages: messages,
        max_tokens: options.maxTokens || 300,
        temperature: options.temperature || 0.1,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('❌ Error generating completion:', error);
      throw error;
    }
  }

  async categorizeEmail(subject: string, body: string, from: string): Promise<string> {
    try {
      const prompt = `Analyze this email and categorize it into ONE of these types:
- "meeting_request" - asking to schedule a meeting, call, or in-person meeting
- "question" - asking for information, clarification, or help
- "job_application" - related to job applications, interviews, or career opportunities
- "networking" - introductions, connection requests, or relationship building
- "business_inquiry" - sales, partnerships, or business proposals
- "personal" - personal messages from friends/family
- "other" - anything that doesn't fit the above categories

Email Details:
From: ${from}
Subject: ${subject}
Body: ${body.substring(0, 500)}...

Return ONLY the category name, nothing else.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
        temperature: 0.1,
      });

      const category = response.choices[0]?.message?.content?.trim() || 'other';
      console.log(`📧 Email categorized as: ${category}`);
      return category;
    } catch (error) {
      console.error('❌ Error categorizing email:', error);
      return 'other';
    }
  }

  async analyzeToneFromRealEmails(emails: Array<{subject: string, body: string}>): Promise<{profile: string, confidence: number, insights: string}> {
    try {
      if (emails.length === 0) {
        throw new Error('No emails provided for tone analysis');
      }

      // Limit to 30-50 emails max for analysis
      const emailsToAnalyze = emails.slice(0, Math.min(50, emails.length));
      
      console.log(`🧠 Analyzing tone from ${emailsToAnalyze.length} real sent emails...`);

      const emailSamples = emailsToAnalyze.map((email, index) => 
        `Email ${index + 1}:\nSubject: ${email.subject}\nBody: ${email.body.substring(0, 400)}`
      ).join('\n\n---\n\n');

      const prompt = `Analyze these REAL email samples from a person's sent folder and create a comprehensive tone profile:

${emailSamples}

Based on these actual emails, provide a detailed analysis in the following format:

TONE PROFILE:
1. **Formality Level**: [Casual/Semi-professional/Professional/Formal] with examples
2. **Greeting Style**: How they typically start emails (Hi, Hello, Hey, Dear, etc.)
3. **Communication Style**: [Direct/Warm/Detailed/Brief/Conversational] with specific patterns
4. **Common Phrases**: Actual phrases this person frequently uses
5. **Sign-off Preferences**: How they typically end emails
6. **Response Patterns**: How they acknowledge, agree, disagree, or ask questions
7. **Personality Traits**: Professional demeanor, enthusiasm level, helpfulness
8. **Email Structure**: How they organize thoughts (bullets, paragraphs, etc.)

CONFIDENCE INSIGHTS:
- What patterns are most consistent across emails
- Any variations based on context or recipient
- Strength of the writing style patterns (1-100)

Make this profile specific and actionable for generating similar emails.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.2,
      });

      const fullResponse = response.choices[0]?.message?.content || '';
      
      // Extract tone profile and confidence
      const profileMatch = fullResponse.match(/TONE PROFILE:(.*?)CONFIDENCE INSIGHTS:/s);
      const insightsMatch = fullResponse.match(/CONFIDENCE INSIGHTS:(.*)/s);
      
      const profile = profileMatch ? profileMatch[1].trim() : fullResponse;
      const insights = insightsMatch ? insightsMatch[1].trim() : 'Analysis completed successfully';
      
      // Calculate confidence based on number of emails and consistency
      let confidence = Math.min(60 + (emailsToAnalyze.length * 0.8), 95);
      
      console.log(`🎯 Real tone profile generated from ${emailsToAnalyze.length} emails (${confidence}% confidence)`);
      
      return {
        profile,
        confidence: Math.round(confidence),
        insights
      };
    } catch (error) {
      console.error('❌ Error analyzing real email tone:', error);
      return {
        profile: 'Professional and courteous tone with a collaborative approach. Uses clear, direct communication while maintaining warmth.',
        confidence: 50,
        insights: 'Fallback profile due to analysis error'
      };
    }
  }

  // Keep the old method for backward compatibility (fallback)
  async analyzeToneFromEmails(emails: Array<{subject: string, body: string}>): Promise<string> {
    const result = await this.analyzeToneFromRealEmails(emails);
    return result.profile;
  }

  async generateDraft(
    originalEmail: { subject: string, body: string, from: string },
    category: string,
    toneProfile: string,
    context?: string
  ): Promise<{ subject: string, body: string, confidence: number }> {
    try {
      const categoryPrompts = {
        meeting_request: 'This is a meeting request. Suggest available times or ask for their availability.',
        question: 'This is a question. Provide a helpful and informative response.',
        job_application: 'This is job-related. Respond professionally about the application or opportunity.',
        networking: 'This is networking. Respond warmly and show interest in connecting.',
        business_inquiry: 'This is a business inquiry. Respond professionally about the opportunity.',
        personal: 'This is personal. Respond in a friendly and warm manner.',
        other: 'Respond appropriately to the content of this email.'
      };

      const categoryGuidance = categoryPrompts[category as keyof typeof categoryPrompts] || categoryPrompts.other;

      const prompt = `You are responding to an email. Generate a professional email response that matches this person's tone profile.

TONE PROFILE:
${toneProfile}

ORIGINAL EMAIL:
From: ${originalEmail.from}
Subject: ${originalEmail.subject}
Body: ${originalEmail.body.substring(0, 800)}

CATEGORY: ${category}
GUIDANCE: ${categoryGuidance}

${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

Generate a response email with:
1. Appropriate subject line (if replying, use "Re: " prefix)
2. Professional email body that matches the tone profile
3. Addresses the main points of the original email

Format your response as JSON:
{
  "subject": "Subject line here",
  "body": "Email body here",
  "reasoning": "Brief explanation of approach"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from OpenAI');

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid JSON response');
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Calculate confidence based on category recognition and response quality
      const confidence = this.calculateConfidence(category, parsed.body, originalEmail.body);

      console.log(`✨ Draft generated for ${category} email (confidence: ${confidence}%)`);
      
      return {
        subject: parsed.subject,
        body: parsed.body,
        confidence
      };
    } catch (error) {
      console.error('❌ Error generating draft:', error);
      
      // Fallback response
      return {
        subject: `Re: ${originalEmail.subject}`,
        body: `Hi,\n\nThank you for your email. I'll review this and get back to you soon.\n\nBest regards`,
        confidence: 30
      };
    }
  }

  private calculateConfidence(category: string, draftBody: string, originalBody: string): number {
    let confidence = 70; // Base confidence
    
    // Boost confidence for clear categories
    if (['meeting_request', 'question', 'job_application'].includes(category)) {
      confidence += 15;
    }
    
    // Check if draft is reasonable length
    if (draftBody.length > 50 && draftBody.length < 1000) {
      confidence += 10;
    }
    
    // Check if draft has greeting and closing
    if (draftBody.includes('Hi') || draftBody.includes('Hello')) confidence += 5;
    if (draftBody.includes('Best') || draftBody.includes('Thanks')) confidence += 5;
    
    return Math.min(confidence, 95); // Cap at 95%
  }

  async scoreDraft(draft: string, originalEmail: string, category: string): Promise<number> {
    try {
      const prompt = `Score this email draft on a scale of 1-100 based on:
1. Relevance to the original email (30%)
2. Professional tone (25%)
3. Completeness of response (25%)
4. Appropriate length (20%)

Original Email: ${originalEmail.substring(0, 500)}
Category: ${category}
Draft: ${draft}

Return ONLY a number between 1-100.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0.1,
      });

      const score = parseInt(response.choices[0]?.message?.content?.trim() || '70');
      return Math.max(1, Math.min(100, score));
    } catch (error) {
      console.error('❌ Error scoring draft:', error);
      return 70; // Default score
    }
  }

  /**
   * Classify email as personal/business communication vs newsletter/promotional
   * Returns 'personal' for emails that need responses, 'newsletter' for mass marketing
   */
  async classifyEmail(subject: string, body: string, fromEmail: string): Promise<'personal' | 'newsletter'> {
    try {
      console.log(`🤖 AI classifying email: "${subject}" from ${fromEmail}`);
      
      const prompt = `Classify this email as either "personal" or "newsletter":

PERSONAL emails are:
- Direct business communication requiring response
- Personal messages from individuals
- Collaboration requests, meeting invites
- Customer inquiries or support requests
- Business proposals or partnerships

NEWSLETTER emails are:
- Mass marketing campaigns
- Automated promotional content
- Company newsletters sent to many recipients
- Advertising or sales pitches
- Emails with unsubscribe links meant for masses

Email Details:
From: ${fromEmail}
Subject: ${subject}
Body: ${body.substring(0, 800)}

Respond with ONLY one word: "personal" or "newsletter"`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 5,
        temperature: 0.1,
      });

      const classification = response.choices[0]?.message?.content?.trim().toLowerCase();
      
      if (classification === 'newsletter') {
        console.log(`📧 AI classified as: newsletter (will be filtered out)`);
        return 'newsletter';
      } else {
        console.log(`📧 AI classified as: personal (will be processed)`);
        return 'personal';
      }
    } catch (error) {
      console.error('❌ Error classifying email:', error);
      console.log('🔄 Defaulting to personal classification');
      return 'personal'; // Default to processing the email if AI fails
    }
  }
}