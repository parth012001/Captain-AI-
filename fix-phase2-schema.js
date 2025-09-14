// Fix Phase 2 Schema Data Type Issues
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixPhase2Schema() {
  console.log('🔧 FIXING PHASE 2 SCHEMA DATA TYPE ISSUES');
  console.log('=' .repeat(50));

  try {
    // Fix DECIMAL precision issues - increase precision to handle larger values
    console.log('\n📊 Fixing data type precision...');
    
    // Change stability_score from DECIMAL(3,2) to DECIMAL(5,3) to handle values like 0.97 properly
    await pool.query(`
      ALTER TABLE learning_insights 
      ALTER COLUMN stability_score TYPE DECIMAL(5,3);
    `);
    console.log('   ✅ Fixed stability_score precision');

    // Change pattern_variance from DECIMAL(5,3) to DECIMAL(8,3) to handle larger variance values
    await pool.query(`
      ALTER TABLE learning_insights 
      ALTER COLUMN pattern_variance TYPE DECIMAL(8,3);
    `);
    console.log('   ✅ Fixed pattern_variance precision');

    // Update the calculate_pattern_stability function to match new data types
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
          mean_rate DECIMAL(5,2);
          variance_calc DECIMAL(8,3);
          stability_calc DECIMAL(5,3);
          drift_detected_calc BOOLEAN DEFAULT FALSE;
          recent_trend DECIMAL(3,2);
          historical_trend DECIMAL(3,2);
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
              success_rates := success_rates || weekly_data.week_avg_success;
          END LOOP;

          rate_count := array_length(success_rates, 1);
          
          -- Need at least 3 weeks of data for stability analysis
          IF rate_count < 3 THEN
              RETURN QUERY SELECT 0.500::DECIMAL(5,3), 0.000::DECIMAL(8,3), success_rates, FALSE, FALSE;
              RETURN;
          END IF;

          -- Calculate mean success rate
          SELECT AVG(rate) INTO mean_rate FROM unnest(success_rates) as rate;
          
          -- Calculate variance
          SELECT AVG(POWER(rate - mean_rate, 2)) INTO variance_calc FROM unnest(success_rates) as rate;
          
          -- Calculate stability score (coefficient of variation approach)
          IF mean_rate > 0 THEN
              stability_calc := GREATEST(0, LEAST(1, 1 - (SQRT(variance_calc) / mean_rate)))::DECIMAL(5,3);
          ELSE
              stability_calc := 0;
          END IF;

          -- Detect pattern drift (recent performance significantly different from historical)
          IF rate_count >= 4 THEN
              -- Compare recent 2 weeks vs historical average
              SELECT AVG(rate) INTO recent_trend 
              FROM unnest(success_rates[rate_count-1:rate_count]) as rate;
              
              SELECT AVG(rate) INTO historical_trend 
              FROM unnest(success_rates[1:rate_count-2]) as rate;
              
              -- Drift detected if recent performance differs by >20 points
              drift_detected_calc := ABS(recent_trend - historical_trend) > 20;
          END IF;

          RETURN QUERY SELECT 
              stability_calc, 
              variance_calc, 
              success_rates,
              (stability_calc >= 0.7)::BOOLEAN,
              drift_detected_calc;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ Updated calculate_pattern_stability function');

    // Test the fixed data types
    console.log('\n🧪 Testing fixed data types...');
    
    try {
      await pool.query('SELECT 0.999::DECIMAL(5,3)');
      console.log('   ✅ DECIMAL(5,3) test passed');
    } catch (error) {
      console.log('   ❌ DECIMAL(5,3) still failing:', error.message);
    }

    try {
      await pool.query('SELECT 999.999::DECIMAL(8,3)');
      console.log('   ✅ DECIMAL(8,3) test passed');
    } catch (error) {
      console.log('   ❌ DECIMAL(8,3) still failing:', error.message);
    }

    // Recalculate stability for existing patterns
    console.log('\n🔄 Recalculating stability for existing patterns...');
    const existingPatterns = await pool.query(`
      SELECT DISTINCT pattern_value FROM learning_insights WHERE pattern_type = 'edit_type'
    `);

    for (const pattern of existingPatterns.rows) {
      try {
        const stabilityResult = await pool.query(`
          SELECT * FROM calculate_pattern_stability('edit_type', $1)
        `, [pattern.pattern_value]);

        if (stabilityResult.rows.length > 0) {
          const stability = stabilityResult.rows[0];
          await pool.query(`
            UPDATE learning_insights 
            SET stability_score = $1, 
                pattern_variance = $2,
                weekly_success_rates = $3,
                stability_validated = $4,
                pattern_drift_detected = $5
            WHERE pattern_type = 'edit_type' AND pattern_value = $6
          `, [
            stability.stability_score,
            stability.pattern_variance,
            stability.weekly_rates,
            stability.is_stable,
            stability.drift_detected,
            pattern.pattern_value
          ]);
          
          console.log(`   ✅ Updated ${pattern.pattern_value}: stability=${parseFloat(stability.stability_score).toFixed(3)}, variance=${parseFloat(stability.pattern_variance).toFixed(3)}`);
        }
      } catch (error) {
        console.log(`   ❌ Failed to update ${pattern.pattern_value}:`, error.message);
      }
    }

    console.log('\n✅ Phase 2 schema fixes completed successfully!');

  } catch (error) {
    console.error('❌ Schema fix failed:', error);
    console.error('Details:', error.message);
  } finally {
    await pool.end();
  }
}

fixPhase2Schema();