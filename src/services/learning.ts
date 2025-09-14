import { pool } from '../database/connection';
import { AIService } from './ai';

export interface EditAnalysis {
  responseId: string;
  originalText: string;
  editedText: string;
  editType: 'tone' | 'content' | 'length' | 'structure' | 'mixed';
  editPercentage: number;
  editDescription: string;
  successScore: number; // 0-100 based on edit amount
  learningInsight: string;
}

export interface SuccessMetrics {
  totalResponses: number;
  noEdits: number; // 100% success
  minorEdits: number; // 75% success (<20% changed)
  majorRewrites: number; // 25% success (20-70% changed)
  deletedDrafts: number; // 0% success (>70% changed or deleted)
  overallSuccessRate: number;
  trendDirection: 'improving' | 'stable' | 'declining';
}

export interface LearningInsight {
  pattern: string;
  frequency: number;
  successRate: number;
  recommendation: string;
  confidence: number;
}

export class LearningService {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  // Analyze user edits to understand patterns
  async analyzeEdit(
    responseId: string, 
    originalText: string, 
    editedText: string,
    userId?: string
  ): Promise<EditAnalysis> {
    try {
      console.log(`🔍 Analyzing edit for response ${responseId}...`);

      // Calculate edit percentage using simple text diff
      const editPercentage = this.calculateEditPercentage(originalText, editedText);
      
      // Use AI to categorize the edit type and extract insights
      const aiAnalysis = await this.getAIEditAnalysis(originalText, editedText);
      
      // Calculate success score based on edit amount
      const successScore = this.calculateSuccessScore(editPercentage);
      
      const analysis: EditAnalysis = {
        responseId,
        originalText,
        editedText,
        editType: aiAnalysis.editType,
        editPercentage,
        editDescription: aiAnalysis.description,
        successScore,
        learningInsight: aiAnalysis.insight
      };

      // Store the analysis for learning
      await this.storeEditAnalysis(analysis, userId);
      
      console.log(`✅ Edit analysis completed: ${editPercentage}% edit, ${successScore} success score`);
      return analysis;

    } catch (error) {
      console.error('❌ Error analyzing edit:', error);
      throw error;
    }
  }

  // Calculate overall success metrics for performance tracking
  async calculateSuccessMetrics(days: number = 7, includeTrend: boolean = true, userId?: string): Promise<SuccessMetrics> {
    try {
      // Sanitize the days parameter to prevent SQL injection
      const safeDays = Math.max(1, Math.floor(Math.abs(days || 7)));
      
      let query: string;
      let queryParams: any[];

      if (userId) {
        query = `
          SELECT 
            COUNT(*) as total_responses,
            COUNT(*) FILTER (WHERE edit_percentage = 0 OR edit_percentage IS NULL) as no_edits,
            COUNT(*) FILTER (WHERE edit_percentage > 0 AND edit_percentage <= 20) as minor_edits,
            COUNT(*) FILTER (WHERE edit_percentage > 20 AND edit_percentage <= 70) as major_rewrites,
            COUNT(*) FILTER (WHERE edit_percentage > 70 OR was_sent = false) as deleted_drafts,
            AVG(CASE 
              WHEN edit_percentage = 0 OR edit_percentage IS NULL THEN 100
              WHEN edit_percentage <= 20 THEN 75 
              WHEN edit_percentage <= 70 THEN 25
              ELSE 0
            END) as avg_success_rate
          FROM generated_responses 
          WHERE generated_at >= CURRENT_DATE - INTERVAL '${safeDays} days'
            AND user_edited IS NOT NULL
            AND user_id = \$1;
        `;
        queryParams = [userId];
      } else {
        query = `
          SELECT 
            COUNT(*) as total_responses,
            COUNT(*) FILTER (WHERE edit_percentage = 0 OR edit_percentage IS NULL) as no_edits,
            COUNT(*) FILTER (WHERE edit_percentage > 0 AND edit_percentage <= 20) as minor_edits,
            COUNT(*) FILTER (WHERE edit_percentage > 20 AND edit_percentage <= 70) as major_rewrites,
            COUNT(*) FILTER (WHERE edit_percentage > 70 OR was_sent = false) as deleted_drafts,
            AVG(CASE 
              WHEN edit_percentage = 0 OR edit_percentage IS NULL THEN 100
              WHEN edit_percentage <= 20 THEN 75 
              WHEN edit_percentage <= 70 THEN 25
              ELSE 0
            END) as avg_success_rate
          FROM generated_responses 
          WHERE generated_at >= CURRENT_DATE - INTERVAL '${safeDays} days'
            AND user_edited IS NOT NULL;
        `;
        queryParams = [];
      }

      const result = await pool.query(query, queryParams);
      const row = result.rows[0];

      const metrics: SuccessMetrics = {
        totalResponses: parseInt(row.total_responses) || 0,
        noEdits: parseInt(row.no_edits) || 0,
        minorEdits: parseInt(row.minor_edits) || 0,
        majorRewrites: parseInt(row.major_rewrites) || 0,
        deletedDrafts: parseInt(row.deleted_drafts) || 0,
        overallSuccessRate: parseFloat(row.avg_success_rate) || 0,
        trendDirection: includeTrend ? await this.calculateTrend(days, userId) : 'stable'
      };

      console.log(`📊 Success metrics calculated: ${metrics.overallSuccessRate.toFixed(1)}% success rate`);
      return metrics;

    } catch (error) {
      console.error('❌ Error calculating success metrics:', error);
      throw error;
    }
  }

  // Generate learning insights from edit patterns with Phase 1 threshold validation
  async generateLearningInsights(days: number = 30, userId?: string): Promise<LearningInsight[]> {
    try {
      console.log(`🧠 [PHASE 1 ENHANCED] Generating learning insights with statistical thresholds${userId ? ` for user ${userId.substring(0, 8)}...` : ' (global)...'}`);
      
      // Use the new validated insights method with backward compatibility fallback
      const validatedInsights = await this.generateValidatedLearningInsights(days, userId);
      
      if (validatedInsights.length > 0) {
        console.log(`✅ Using ${validatedInsights.length} validated insights (Phase 1 thresholds applied)`);
        return validatedInsights;
      }
      
      // Fallback to legacy method if no validated insights (maintains backward compatibility)
      console.log(`📊 No validated insights found, using legacy method as fallback`);
      return await this.generateLegacyLearningInsights(days, userId);

    } catch (error) {
      console.error('❌ Error in enhanced learning insights generation:', error);
      // Fallback to legacy method on error to maintain reliability
      console.log('🔄 Falling back to legacy learning insights method');
      return await this.generateLegacyLearningInsights(days, userId);
    }
  }

  // NEW: Phase 2 Enhanced - Generate validated learning insights with stability analysis
  async generateValidatedLearningInsights(days: number = 30, userId?: string): Promise<LearningInsight[]> {
    try {
      console.log(`🎯 [PHASE 2 ENHANCED] Generating insights with statistical thresholds + stability analysis`);
      
      // Sanitize the days parameter to prevent SQL injection
      const safeDays = Math.max(1, Math.floor(Math.abs(days || 30)));

      let query: string;
      let queryParams: any[];

      if (userId) {
        // Use enhanced stability view with user-specific edit_analyses
        query = `
          SELECT 
            vli.pattern_value as edit_type,
            vli.sample_size as frequency,
            vli.success_rate as avg_success_rate,
            vli.confidence,
            vli.threshold_met,
            vli.stability_score,
            vli.stability_validated,
            vli.pattern_drift_detected,
            vli.validation_status,
            vli.time_span_days,
            STRING_AGG(DISTINCT ea.learning_insight, ' | ') as insights
          FROM validated_learning_insights_with_stability vli
          LEFT JOIN edit_analyses ea ON ea.edit_type = vli.pattern_value 
            AND ea.user_id = $1 
            AND ea.created_at >= CURRENT_DATE - INTERVAL '${safeDays} days'
          WHERE vli.pattern_type = 'edit_type'
            AND vli.validation_status = 'FULLY_VALIDATED'
          GROUP BY vli.id, vli.pattern_value, vli.sample_size, vli.success_rate, 
                   vli.confidence, vli.threshold_met, vli.stability_score,
                   vli.stability_validated, vli.pattern_drift_detected, 
                   vli.validation_status, vli.time_span_days
          ORDER BY vli.stability_score DESC, vli.confidence DESC, vli.sample_size DESC;
        `;
        queryParams = [userId];
      } else {
        // Global validated insights with stability
        query = `
          SELECT 
            pattern_value as edit_type,
            sample_size as frequency,
            success_rate as avg_success_rate,
            confidence,
            threshold_met,
            stability_score,
            stability_validated,
            pattern_drift_detected,
            validation_status,
            time_span_days,
            recommendation as insights
          FROM validated_learning_insights_with_stability
          WHERE pattern_type = 'edit_type'
            AND validation_status = 'FULLY_VALIDATED'
          ORDER BY stability_score DESC, confidence DESC, sample_size DESC;
        `;
        queryParams = [];
      }

      console.log(`🔍 Executing Phase 2 enhanced query (thresholds + stability validation)`);
      const result = await pool.query(query, queryParams);
      console.log(`📊 Found ${result.rows.length} fully validated insights (Phase 1 + 2)`);
      
      const insights: LearningInsight[] = [];

      for (const row of result.rows) {
        // Enhanced confidence calculation including stability factors
        const enhancedConfidence = this.calculateStabilityEnhancedConfidence(
          row.frequency,
          row.confidence,
          row.time_span_days,
          row.avg_success_rate,
          row.stability_score
        );

        const insight: LearningInsight = {
          pattern: row.edit_type,
          frequency: parseInt(row.frequency),
          successRate: parseFloat(row.avg_success_rate),
          recommendation: await this.generateRecommendation(row.edit_type, row.avg_success_rate, row.insights),
          confidence: enhancedConfidence
        };
        
        insights.push(insight);
        
        const stabilityScore = row.stability_score ? (parseFloat(row.stability_score) * 100).toFixed(1) : 'N/A';
        console.log(`   ✓ ${insight.pattern}: ${insight.frequency} samples, ${insight.confidence}% confidence, ${stabilityScore}% stability`);
      }

      console.log(`✅ Generated ${insights.length} stability-validated learning insights (Phase 2)`);
      return insights;

    } catch (error) {
      console.error('❌ Error generating stability-validated learning insights:', error);
      return [];
    }
  }

  // LEGACY: Original method preserved for backward compatibility
  private async generateLegacyLearningInsights(days: number = 30, userId?: string): Promise<LearningInsight[]> {
    try {
      console.log(`📊 Using legacy learning insights (original 2-sample method)`);
      
      // Sanitize the days parameter to prevent SQL injection
      const safeDays = Math.max(1, Math.floor(Math.abs(days || 30)));

      let query: string;
      let queryParams: any[];

      if (userId) {
        query = `
          SELECT 
            edit_type,
            COUNT(*) as frequency,
            AVG(success_score) as avg_success_rate,
            STRING_AGG(DISTINCT learning_insight, ' | ') as insights
          FROM edit_analyses 
          WHERE created_at >= CURRENT_DATE - INTERVAL '${safeDays} days'
            AND user_id = \$1
          GROUP BY edit_type
          HAVING COUNT(*) >= 2
          ORDER BY frequency DESC;
        `;
        queryParams = [userId];
      } else {
        query = `
          SELECT 
            edit_type,
            COUNT(*) as frequency,
            AVG(success_score) as avg_success_rate,
            STRING_AGG(DISTINCT learning_insight, ' | ') as insights
          FROM edit_analyses 
          WHERE created_at >= CURRENT_DATE - INTERVAL '${safeDays} days'
          GROUP BY edit_type
          HAVING COUNT(*) >= 2
          ORDER BY frequency DESC;
        `;
        queryParams = [];
      }

      const result = await pool.query(query, queryParams);
      const insights: LearningInsight[] = [];

      for (const row of result.rows) {
        const insight: LearningInsight = {
          pattern: row.edit_type,
          frequency: parseInt(row.frequency),
          successRate: parseFloat(row.avg_success_rate),
          recommendation: await this.generateRecommendation(row.edit_type, row.avg_success_rate, row.insights),
          confidence: Math.min(row.frequency * 10, 90) // Original confidence calculation
        };
        insights.push(insight);
      }

      console.log(`📊 Generated ${insights.length} legacy learning insights`);
      return insights;

    } catch (error) {
      console.error('❌ Error generating legacy learning insights:', error);
      return [];
    }
  }

  // Adjust tone profile based on learning patterns
  async adjustToneProfile(): Promise<any> {
    try {
      console.log('⚡ Adjusting tone profile based on learning patterns...');

      // Get recent learning insights
      const insights = await this.generateLearningInsights(14);
      
      if (insights.length === 0) {
        console.log('ℹ️ No learning insights available for tone adjustment');
        return null;
      }

      // Get current tone profile
      const currentProfile = await this.getCurrentToneProfile();
      
      // Generate adjustment recommendations using AI
      const adjustmentPrompt = `Based on these user edit patterns, suggest tone profile adjustments:

Current Tone Profile: ${currentProfile ? currentProfile.profile_text : 'Default professional'}

Edit Patterns:
${insights.map(i => `- ${i.pattern}: ${i.frequency} occurrences, ${i.successRate.toFixed(1)}% success rate - ${i.recommendation}`).join('\n')}

Provide specific, actionable adjustments to improve response quality. Focus on:
1. Tone adjustments (more/less formal, warmer/cooler)
2. Length preferences (more/less concise)
3. Structure improvements (greeting/closing patterns)
4. Content focus areas

Return as JSON with keys: adjustments, reasoning, confidence`;

      const aiResponse = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: adjustmentPrompt }],
        temperature: 0.3
      });

      const adjustmentData = this.parseAIResponse(aiResponse.choices[0]?.message?.content || '{}');
      
      // Create new tone profile with adjustments
      const newProfile = await this.createAdjustedToneProfile(currentProfile, adjustmentData);
      
      console.log('✅ Tone profile adjusted based on learning insights');
      return newProfile;

    } catch (error) {
      console.error('❌ Error adjusting tone profile:', error);
      return null;
    }
  }

  // Calculate weekly performance trends
  async getPerformanceTrend(weeks: number = 4, userId?: string): Promise<any[]> {
    try {
      // Sanitize the weeks parameter to prevent SQL injection
      const safeWeeks = Math.max(1, Math.floor(Math.abs(weeks || 4)));
      
      let query: string;
      let queryParams: any[];

      if (userId) {
        query = `
          SELECT 
            DATE_TRUNC('week', generated_at) as week,
            COUNT(*) as total_responses,
            AVG(confidence) as avg_confidence,
            AVG(CASE 
              WHEN edit_percentage = 0 OR edit_percentage IS NULL THEN 100
              WHEN edit_percentage <= 20 THEN 75 
              WHEN edit_percentage <= 70 THEN 25
              ELSE 0
            END) as success_rate,
            AVG(user_rating) as avg_rating
          FROM generated_responses 
          WHERE generated_at >= CURRENT_DATE - INTERVAL '${safeWeeks} weeks'
            AND user_edited IS NOT NULL
            AND user_id = \$1
          GROUP BY DATE_TRUNC('week', generated_at)
          ORDER BY week DESC;
        `;
        queryParams = [userId];
      } else {
        query = `
          SELECT 
            DATE_TRUNC('week', generated_at) as week,
            COUNT(*) as total_responses,
            AVG(confidence) as avg_confidence,
            AVG(CASE 
              WHEN edit_percentage = 0 OR edit_percentage IS NULL THEN 100
              WHEN edit_percentage <= 20 THEN 75 
              WHEN edit_percentage <= 70 THEN 25
              ELSE 0
            END) as success_rate,
            AVG(user_rating) as avg_rating
          FROM generated_responses 
          WHERE generated_at >= CURRENT_DATE - INTERVAL '${safeWeeks} weeks'
            AND user_edited IS NOT NULL
          GROUP BY DATE_TRUNC('week', generated_at)
          ORDER BY week DESC;
        `;
        queryParams = [];
      }

      const result = await pool.query(query, queryParams);
      const trends = result.rows.map(row => ({
        week: row.week,
        totalResponses: parseInt(row.total_responses),
        avgConfidence: parseFloat(row.avg_confidence) || 0,
        successRate: parseFloat(row.success_rate) || 0,
        avgRating: parseFloat(row.avg_rating) || 0
      }));

      console.log(`📈 Performance trend calculated for ${trends.length} weeks`);
      return trends;

    } catch (error) {
      console.error('❌ Error calculating performance trend:', error);
      return [];
    }
  }

  // Private helper methods
  private calculateEditPercentage(original: string, edited: string): number {
    if (original === edited) return 0;
    if (!edited || edited.trim() === '') return 100;
    
    // Simple character-based diff calculation
    const originalWords = original.split(/\s+/);
    const editedWords = edited.split(/\s+/);
    
    let changes = Math.abs(originalWords.length - editedWords.length);
    const minLength = Math.min(originalWords.length, editedWords.length);
    
    for (let i = 0; i < minLength; i++) {
      if (originalWords[i] !== editedWords[i]) {
        changes++;
      }
    }
    
    const maxLength = Math.max(originalWords.length, editedWords.length);
    return Math.min(Math.round((changes / maxLength) * 100), 100);
  }

  private calculateSuccessScore(editPercentage: number): number {
    if (editPercentage === 0) return 100; // No edits = perfect
    if (editPercentage <= 20) return 75;  // Minor edits = good
    if (editPercentage <= 70) return 25;  // Major rewrite = needs work
    return 0; // Mostly rewritten = failed
  }

  private async getAIEditAnalysis(original: string, edited: string): Promise<any> {
    try {
      const prompt = `Analyze the differences between these two email responses:

ORIGINAL:
${original}

EDITED VERSION:
${edited}

Categorize the edit type as one of: tone, content, length, structure, mixed
Provide a brief description of what was changed and why it might have been improved.
Return as JSON with keys: editType, description, insight`;

      const response = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      });

      return this.parseAIResponse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      console.error('❌ Error in AI edit analysis:', error);
      return {
        editType: 'mixed',
        description: 'Unable to analyze edit',
        insight: 'Analysis failed'
      };
    }
  }

  private async calculateTrend(currentDays: number, userId?: string): Promise<'improving' | 'stable' | 'declining'> {
    try {
      // Break infinite recursion by calling with includeTrend: false
      const currentMetrics = await this.calculateSuccessMetrics(currentDays, false, userId);
      const previousMetrics = await this.calculateSuccessMetrics(currentDays * 2, false, userId);
      
      const currentRate = currentMetrics.overallSuccessRate;
      const previousRate = previousMetrics.overallSuccessRate;
      
      const difference = currentRate - previousRate;
      
      if (difference > 5) return 'improving';
      if (difference < -5) return 'declining';
      return 'stable';
    } catch (error) {
      console.error('❌ Error calculating trend:', error);
      return 'stable';
    }
  }

  private async storeEditAnalysis(analysis: EditAnalysis, userId?: string): Promise<void> {
    try {
      const query = `
        INSERT INTO edit_analyses (
          response_id, original_text, edited_text, edit_type, 
          edit_percentage, edit_description, success_score, learning_insight, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      await pool.query(query, [
        analysis.responseId,
        analysis.originalText,
        analysis.editedText,
        analysis.editType,
        analysis.editPercentage,
        analysis.editDescription,
        analysis.successScore,
        analysis.learningInsight,
        userId
      ]);
    } catch (error) {
      console.error('❌ Error storing edit analysis:', error);
    }
  }

  private async getCurrentToneProfile(): Promise<any> {
    try {
      const query = `
        SELECT * FROM tone_profiles 
        WHERE is_real_data = TRUE 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const result = await pool.query(query);
      return result.rows[0] || null;
    } catch (error) {
      return null;
    }
  }

  private async createAdjustedToneProfile(currentProfile: any, adjustments: any): Promise<any> {
    // Implementation for creating new tone profile with adjustments
    // This would integrate with the existing tone profile system
    console.log('Creating adjusted tone profile with:', adjustments);
    return { adjusted: true, improvements: adjustments };
  }

  private async generateRecommendation(editType: string, successRate: number, insights: string): Promise<string> {
    const recommendations = {
      tone: successRate < 60 ? 'Consider more formal/informal tone based on relationship' : 'Tone adjustments are working well',
      content: successRate < 60 ? 'Add more specific context or details' : 'Content level is appropriate',
      length: successRate < 60 ? 'Adjust response length - may be too brief or verbose' : 'Response length is optimal',
      structure: successRate < 60 ? 'Improve greeting/closing patterns' : 'Response structure is effective',
      mixed: successRate < 60 ? 'Multiple areas need improvement - review overall approach' : 'General approach is successful'
    };

    return recommendations[editType as keyof typeof recommendations] || 'Continue current approach';
  }

  // NEW: Phase 2 - Stability-enhanced confidence calculation
  private calculateStabilityEnhancedConfidence(
    sampleSize: number, 
    baseConfidence: number, 
    timeSpanDays: number, 
    successRate: number,
    stabilityScore: number
  ): number {
    try {
      // Start with Phase 1 enhanced confidence
      let enhancedConfidence = this.calculateEnhancedConfidence(
        sampleSize, baseConfidence, timeSpanDays, successRate
      );
      
      // Phase 2 Addition: Stability factor (most important for reliability)
      if (stabilityScore !== null && stabilityScore !== undefined) {
        const stabilityBonus = Math.round(parseFloat(stabilityScore.toString()) * 15); // Up to +15 points
        enhancedConfidence += stabilityBonus;
        
        // Extra bonus for very stable patterns (stability > 0.9)
        if (parseFloat(stabilityScore.toString()) >= 0.9) {
          enhancedConfidence += 5; // Super stable pattern bonus
        }
        
        // Penalty for unstable patterns (stability < 0.5)
        if (parseFloat(stabilityScore.toString()) < 0.5) {
          enhancedConfidence *= 0.8; // Reduce confidence for unstable patterns
        }
      }
      
      // Cap confidence between 0 and 95 (never 100% certain)
      return Math.max(0, Math.min(95, Math.round(enhancedConfidence)));
      
    } catch (error) {
      console.error('❌ Error calculating stability-enhanced confidence:', error);
      return this.calculateEnhancedConfidence(sampleSize, baseConfidence, timeSpanDays, successRate);
    }
  }

  // LEGACY: Phase 1 Enhanced confidence calculation (preserved for fallback)
  private calculateEnhancedConfidence(
    sampleSize: number, 
    baseConfidence: number, 
    timeSpanDays: number, 
    successRate: number
  ): number {
    try {
      // Start with base confidence from database
      let enhancedConfidence = baseConfidence;
      
      // Sample size factor (more samples = higher confidence, with diminishing returns)
      const sampleSizeBonus = Math.min(20, Math.log10(sampleSize) * 15);
      enhancedConfidence += sampleSizeBonus;
      
      // Time span factor (longer observation period = more reliable)
      const timeSpanBonus = Math.min(10, timeSpanDays * 0.5);
      enhancedConfidence += timeSpanBonus;
      
      // Success rate factor (higher success = more confidence in pattern)
      if (successRate >= 80) {
        enhancedConfidence += 10; // High success rate bonus
      } else if (successRate <= 40) {
        enhancedConfidence -= 5;  // Low success rate penalty
      }
      
      // Statistical significance factor (prevents overconfidence with small samples)
      if (sampleSize < 10) {
        enhancedConfidence *= 0.9; // Slight penalty for small samples
      } else if (sampleSize >= 20) {
        enhancedConfidence *= 1.05; // Small bonus for large samples
      }
      
      // Cap confidence between 0 and 95 (never 100% certain)
      return Math.max(0, Math.min(95, Math.round(enhancedConfidence)));
      
    } catch (error) {
      console.error('❌ Error calculating enhanced confidence:', error);
      return Math.max(0, Math.min(95, baseConfidence)); // Fallback to base confidence
    }
  }

  private parseAIResponse(content: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { error: 'Could not parse AI response' };
    } catch (error) {
      return { error: 'Invalid JSON in AI response' };
    }
  }
}