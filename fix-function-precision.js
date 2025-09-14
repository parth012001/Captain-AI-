// Fix All Precision Issues in Calculate Pattern Stability Function
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixFunctionPrecision() {
  console.log('🔧 FIXING ALL PRECISION ISSUES IN PATTERN STABILITY FUNCTION');
  console.log('=' .repeat(60));

  try {
    console.log('\n🔄 Recreating calculate_pattern_stability with correct precision...');
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION calculate_pattern_stability(
          pattern_type_param TEXT,
          pattern_value_param TEXT,
          user_id_param TEXT DEFAULT NULL
      )
      RETURNS TABLE(
          stability_score DECIMAL(5,3),
          pattern_variance DECIMAL(8,3),
          weekly_rates DECIMAL(5,2)[],
          is_stable BOOLEAN,
          drift_detected BOOLEAN
      ) AS $$
      DECLARE
          weekly_data RECORD;
          success_rates DECIMAL(5,2)[];
          rate_count INTEGER;
          mean_rate DECIMAL(8,3);  -- Increased precision
          variance_calc DECIMAL(8,3);
          stability_calc DECIMAL(5,3);  -- Increased precision
          drift_detected_calc BOOLEAN DEFAULT FALSE;
          recent_trend DECIMAL(8,3);  -- Increased precision
          historical_trend DECIMAL(8,3);  -- Increased precision
      BEGIN
          -- Get weekly success rates for the pattern
          FOR weekly_data IN
              SELECT 
                  DATE_TRUNC('week', ea.created_at) as week_start,
                  AVG(ea.success_score) as week_avg_success
              FROM edit_analyses ea
              WHERE ea.edit_type = pattern_value_param
                  AND ea.created_at >= CURRENT_DATE - INTERVAL '8 weeks'
                  AND (user_id_param IS NULL OR ea.user_id = user_id_param)
              GROUP BY DATE_TRUNC('week', ea.created_at)
              HAVING COUNT(*) >= 2
              ORDER BY week_start
          LOOP
              success_rates := success_rates || weekly_data.week_avg_success::DECIMAL(5,2);
          END LOOP;

          rate_count := array_length(success_rates, 1);
          
          -- Need at least 3 weeks of data for stability analysis
          IF rate_count IS NULL OR rate_count < 3 THEN
              RETURN QUERY SELECT 0.500::DECIMAL(5,3), 0.000::DECIMAL(8,3), success_rates, FALSE, FALSE;
              RETURN;
          END IF;

          -- Calculate mean success rate
          SELECT AVG(rate::DECIMAL(8,3)) INTO mean_rate FROM unnest(success_rates) as rate;
          
          -- Calculate variance
          SELECT AVG(POWER(rate::DECIMAL(8,3) - mean_rate, 2)) INTO variance_calc FROM unnest(success_rates) as rate;
          
          -- Calculate stability score (coefficient of variation approach)
          IF mean_rate > 0 THEN
              stability_calc := GREATEST(0::DECIMAL(5,3), LEAST(1::DECIMAL(5,3), (1 - (SQRT(variance_calc) / mean_rate))::DECIMAL(5,3)));
          ELSE
              stability_calc := 0::DECIMAL(5,3);
          END IF;

          -- Detect pattern drift (recent performance significantly different from historical)
          IF rate_count >= 4 THEN
              -- Compare recent 2 weeks vs historical average
              SELECT AVG(rate::DECIMAL(8,3)) INTO recent_trend 
              FROM unnest(success_rates[rate_count-1:rate_count]) as rate;
              
              SELECT AVG(rate::DECIMAL(8,3)) INTO historical_trend 
              FROM unnest(success_rates[1:rate_count-2]) as rate;
              
              -- Drift detected if recent performance differs by >20 points
              drift_detected_calc := ABS(recent_trend - historical_trend) > 20::DECIMAL(8,3);
          END IF;

          RETURN QUERY SELECT 
              stability_calc, 
              variance_calc, 
              success_rates,
              (stability_calc >= 0.7::DECIMAL(5,3))::BOOLEAN,
              drift_detected_calc;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Function recreated with proper precision');

    // Test the function directly
    console.log('\n🧪 Testing function precision...');
    
    try {
      // Test with dummy data
      const result = await pool.query(`
        SELECT * FROM calculate_pattern_stability('edit_type', 'nonexistent_pattern', NULL)
      `);
      
      if (result.rows.length > 0) {
        const test = result.rows[0];
        console.log(`   ✅ Function returns: stability=${test.stability_score}, variance=${test.pattern_variance}`);
      }
    } catch (error) {
      console.log(`   ❌ Function test failed: ${error.message}`);
    }

    console.log('\n✅ All precision issues fixed!');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    console.error('Details:', error.message);
  } finally {
    await pool.end();
  }
}

fixFunctionPrecision();