// Fix Trigger Function Precision Issues
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixTriggerPrecision() {
  console.log('🔧 FIXING TRIGGER FUNCTION PRECISION ISSUES');
  console.log('=' .repeat(50));

  try {
    // Update the trigger function to use correct data types
    console.log('\n🔄 Updating trigger function with correct precision...');
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_learning_insights_with_stability()
      RETURNS TRIGGER AS $$
      DECLARE
          existing_insight RECORD;
          stability_data RECORD;
          time_span_days INTEGER;
          meets_threshold BOOLEAN DEFAULT FALSE;
          meets_stability BOOLEAN DEFAULT FALSE;
      BEGIN
          -- Get existing insight if it exists
          SELECT * INTO existing_insight
          FROM learning_insights 
          WHERE pattern_type = 'edit_type' AND pattern_value = NEW.edit_type;
          
          -- Update the basic learning insight first (from Phase 1)
          INSERT INTO learning_insights (
              pattern_type, pattern_value, frequency, success_rate, recommendation, confidence,
              sample_size, time_span_days, first_occurrence, threshold_met
          )
          VALUES (
              'edit_type', NEW.edit_type, 1, NEW.success_score, 
              CASE 
                  WHEN NEW.success_score >= 75 THEN 'Current approach working well'
                  WHEN NEW.success_score >= 50 THEN 'Minor adjustments needed'
                  ELSE 'Significant improvements required'
              END, 
              50, 1, 1, CURRENT_TIMESTAMP, FALSE
          )
          ON CONFLICT (pattern_type, pattern_value) 
          DO UPDATE SET 
              frequency = GREATEST(learning_insights.frequency + 1, 1),
              success_rate = CASE 
                  WHEN learning_insights.frequency > 0 THEN 
                      (learning_insights.success_rate * learning_insights.frequency + NEW.success_score) / (learning_insights.frequency + 1)
                  ELSE NEW.success_score
              END,
              confidence = LEAST(90, learning_insights.confidence + 2),
              sample_size = learning_insights.frequency + 1,
              time_span_days = GREATEST(1, EXTRACT(DAY FROM (CURRENT_TIMESTAMP - learning_insights.first_occurrence))),
              threshold_met = (
                  (learning_insights.frequency + 1) >= 5 AND 
                  LEAST(90, learning_insights.confidence + 2) >= 65 AND
                  GREATEST(1, EXTRACT(DAY FROM (CURRENT_TIMESTAMP - learning_insights.first_occurrence))) >= 3
              ),
              last_updated = CURRENT_TIMESTAMP;

          -- Now calculate stability if we have enough data
          SELECT * INTO stability_data 
          FROM calculate_pattern_stability('edit_type', NEW.edit_type, NEW.user_id);

          -- Update stability information with correct data types
          UPDATE learning_insights 
          SET 
              stability_score = stability_data.stability_score::DECIMAL(5,3),
              pattern_variance = stability_data.pattern_variance::DECIMAL(8,3),
              weekly_success_rates = stability_data.weekly_rates,
              stability_validated = stability_data.is_stable,
              pattern_drift_detected = stability_data.drift_detected
          WHERE pattern_type = 'edit_type' AND pattern_value = NEW.edit_type;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Trigger function updated with correct precision');

    // Test the trigger with a simple insert
    console.log('\n🧪 Testing updated trigger...');
    
    try {
      const testUserId = `trigger-test-${Date.now()}`;
      await pool.query(`
        INSERT INTO edit_analyses (
          response_id, original_text, edited_text, edit_type, 
          success_score, user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'test-trigger-fix',
        'Test original text',
        'Test edited text',
        'trigger_test',
        85,
        testUserId
      ]);
      
      console.log('✅ Trigger test passed - no precision errors');
      
      // Check the result
      const result = await pool.query(`
        SELECT pattern_value, stability_score, pattern_variance
        FROM learning_insights 
        WHERE pattern_value = 'trigger_test'
      `);
      
      if (result.rows.length > 0) {
        const insight = result.rows[0];
        console.log(`   Generated insight: stability=${insight.stability_score}, variance=${insight.pattern_variance}`);
      }
      
    } catch (error) {
      console.log(`❌ Trigger test failed: ${error.message}`);
    }

    console.log('\n✅ Trigger function precision fix completed');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    console.error('Details:', error.message);
  } finally {
    await pool.end();
  }
}

fixTriggerPrecision();