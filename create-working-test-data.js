// Create Working Test Data with Multiple Records Per Week
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createWorkingTestData() {
  console.log('🔧 CREATING WORKING PHASE 2 TEST DATA');
  console.log('=' .repeat(50));

  const testUserId = `phase2-working-${Date.now()}`;

  try {
    // Clean up any existing test data
    await pool.query(`DELETE FROM edit_analyses WHERE user_id LIKE 'phase2-%'`);
    console.log('   🧹 Cleaned up old test data');

    // Helper function to create multiple records per week
    async function createWeeklyPattern(patternName, weeklyRates, baseDate) {
      console.log(`\n📊 Creating ${patternName} with multiple records per week...`);
      
      for (let week = 0; week < weeklyRates.length; week++) {
        const baseRate = weeklyRates[week];
        
        // Create 3-5 records per week with slight variations
        const recordsPerWeek = 3 + Math.floor(Math.random() * 3); // 3-5 records
        
        for (let record = 0; record < recordsPerWeek; record++) {
          const weekDate = new Date(baseDate);
          weekDate.setDate(weekDate.getDate() - (weeklyRates.length - week - 1) * 7); // Go back weeks
          weekDate.setDate(weekDate.getDate() + record); // Spread within week
          
          // Add small random variation to base rate (±3%)
          const variation = (Math.random() - 0.5) * 6; // -3 to +3
          const actualRate = Math.max(0, Math.min(100, baseRate + variation));
          
          await pool.query(`
            INSERT INTO edit_analyses (
              response_id, original_text, edited_text, edit_type, 
              success_score, user_id, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            uuidv4(),
            `Original ${patternName} test text ${record + 1}`,
            `Edited ${patternName} test text ${record + 1}`, 
            patternName,
            Math.round(actualRate),
            testUserId,
            weekDate
          ]);
        }
        
        console.log(`   Week ${week + 1}: ${recordsPerWeek} records averaging ~${baseRate}%`);
      }
    }

    const baseDate = new Date();
    
    // Test 1: Stable pattern (consistently good performance)
    await createWeeklyPattern('stable_pattern', [85, 88, 82, 87, 90, 84, 89, 86], baseDate);
    
    // Test 2: Unstable pattern (wildly varying performance)
    await createWeeklyPattern('unstable_pattern', [85, 45, 80, 30, 75, 20, 85, 40], baseDate);
    
    // Test 3: Drifting pattern (declining performance)
    await createWeeklyPattern('drifting_pattern', [90, 85, 75, 60, 45, 30, 20, 15], baseDate);

    console.log('\n🧪 Testing stability calculations...');
    
    // Test stability calculations
    const patterns = [
      { name: 'stable_pattern', expected: 'high stability (0.8+), no drift' },
      { name: 'unstable_pattern', expected: 'low stability (<0.5), no drift' },
      { name: 'drifting_pattern', expected: 'low stability (<0.5), drift detected' }
    ];
    
    for (const pattern of patterns) {
      console.log(`\n   📊 Testing ${pattern.name} (expecting: ${pattern.expected})...`);
      
      // First check the weekly aggregation
      const weeklyCheck = await pool.query(`
        SELECT 
            DATE_TRUNC('week', ea.created_at) as week_start,
            AVG(ea.success_score) as week_avg_success,
            COUNT(*) as week_count
        FROM edit_analyses ea
        WHERE ea.edit_type = $1
            AND ea.user_id = $2
            AND ea.created_at >= CURRENT_DATE - INTERVAL '8 weeks'
        GROUP BY DATE_TRUNC('week', ea.created_at)
        HAVING COUNT(*) >= 2
        ORDER BY week_start
      `, [pattern.name, testUserId]);

      console.log(`      Weekly aggregates found: ${weeklyCheck.rows.length}`);
      weeklyCheck.rows.forEach((week, i) => {
        const avg = parseFloat(week.week_avg_success).toFixed(1);
        console.log(`        Week ${i + 1}: ${avg}% (${week.week_count} records)`);
      });

      // Now test the stability function
      try {
        const stabilityResult = await pool.query(`
          SELECT * FROM calculate_pattern_stability('edit_type', $1, $2)
        `, [pattern.name, testUserId]);

        if (stabilityResult.rows.length > 0) {
          const result = stabilityResult.rows[0];
          const score = parseFloat(result.stability_score || 0).toFixed(3);
          const variance = parseFloat(result.pattern_variance || 0).toFixed(3);
          
          console.log(`      📈 Stability Results:`);
          console.log(`        Stability Score: ${score} ${parseFloat(score) >= 0.7 ? '✅ STABLE' : '❌ UNSTABLE'}`);
          console.log(`        Variance: ${variance}`);
          console.log(`        Is Stable: ${result.is_stable ? '✅ YES' : '❌ NO'}`);
          console.log(`        Drift Detected: ${result.drift_detected ? '⚠️ YES' : '✅ NO'}`);
          console.log(`        Weekly Rates: [${result.weekly_rates ? result.weekly_rates.map(r => parseFloat(r).toFixed(1)).join(', ') : 'none'}]`);
          
          // Evaluate if this matches expectations
          const expectedStable = pattern.name === 'stable_pattern';
          const expectedDrift = pattern.name === 'drifting_pattern';
          const actualStable = result.is_stable;
          const actualDrift = result.drift_detected;
          
          const stabilityMatch = expectedStable === actualStable;
          const driftMatch = expectedDrift === actualDrift;
          
          console.log(`        Matches expectations: Stability ${stabilityMatch ? '✅' : '❌'}, Drift ${driftMatch ? '✅' : '❌'}`);
        } else {
          console.log('      ❌ No stability results returned');
        }
      } catch (error) {
        console.log(`      ❌ Stability calculation failed: ${error.message}`);
      }
    }

    // Trigger learning insights
    console.log('\n🧠 Generating learning insights...');
    for (const pattern of patterns) {
      await pool.query(`
        INSERT INTO edit_analyses (
          response_id, original_text, edited_text, edit_type, 
          success_score, user_id
        )
        VALUES ($1, $2, $3, $4, 75, $5)
      `, [
        uuidv4(),
        'Trigger insight',
        'Trigger insight edit',
        pattern.name,
        testUserId
      ]);
    }

    // Wait for triggers to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check final results
    const finalResults = await pool.query(`
      SELECT pattern_value, sample_size, confidence, success_rate,
             stability_score, stability_validated, pattern_drift_detected,
             validation_status, threshold_met
      FROM validated_learning_insights_with_stability
      WHERE pattern_value IN ('stable_pattern', 'unstable_pattern', 'drifting_pattern')
        AND pattern_value LIKE '%_pattern'
      ORDER BY pattern_value
    `);

    console.log('\n📋 FINAL LEARNING INSIGHTS:');
    let correctResults = 0;
    const totalTests = 3;

    if (finalResults.rows.length > 0) {
      finalResults.rows.forEach(insight => {
        const score = insight.stability_score ? parseFloat(insight.stability_score).toFixed(3) : 'NULL';
        const successRate = insight.success_rate ? parseFloat(insight.success_rate).toFixed(1) : 'NULL';
        
        console.log(`\n   🎯 ${insight.pattern_value}:`);
        console.log(`      Samples: ${insight.sample_size}, Success: ${successRate}%, Confidence: ${insight.confidence}%`);
        console.log(`      Stability: ${score}, Validated: ${insight.stability_validated ? 'YES' : 'NO'}, Drift: ${insight.pattern_drift_detected ? 'YES' : 'NO'}`);
        console.log(`      Threshold Met: ${insight.threshold_met ? 'YES' : 'NO'}, Status: ${insight.validation_status}`);

        // Check if Phase 2 would make correct decisions
        const wouldApply = insight.threshold_met && insight.stability_validated && !insight.pattern_drift_detected;
        const shouldApply = insight.pattern_value === 'stable_pattern';
        const correctDecision = wouldApply === shouldApply;
        
        console.log(`      Phase 2 Decision: ${wouldApply ? '✅ APPLY' : '❌ REJECT'} ${correctDecision ? '(CORRECT)' : '(INCORRECT)'}`);
        
        if (correctDecision) correctResults++;
      });
    }

    const passRate = Math.round((correctResults / totalTests) * 100);
    console.log(`\n🎯 PHASE 2 DECISION ACCURACY: ${correctResults}/${totalTests} = ${passRate}%`);
    
    if (passRate >= 80) {
      console.log('✅ PHASE 2 WORKING CORRECTLY!');
    } else {
      console.log('❌ Phase 2 needs further refinement');
    }

    console.log(`\n📝 Test User ID: ${testUserId}`);

  } catch (error) {
    console.error('❌ Test creation failed:', error);
    console.error('Details:', error.message);
  } finally {
    await pool.end();
  }
}

createWorkingTestData();