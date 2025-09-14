// Fix Test Scenario Creation with Required Fields
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createValidTestScenarios() {
  console.log('🔧 CREATING VALID PHASE 2 TEST SCENARIOS');
  console.log('=' .repeat(50));

  const testUserId = `phase2-test-${Date.now()}`;

  try {
    // Clean up any existing test data
    await pool.query(`DELETE FROM edit_analyses WHERE user_id LIKE 'phase2-test-%' OR user_id LIKE 'debug-test-%'`);
    console.log('   🧹 Cleaned up old test data');

    // Test 1: Create stable pattern (consistent high performance)
    console.log('\n1️⃣ Creating STABLE pattern scenario...');
    const stableRates = [85, 88, 82, 87, 90, 84, 89]; // 7 weeks of consistent data
    
    for (let i = 0; i < stableRates.length; i++) {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - (stableRates.length - i) * 7); // Weekly intervals
      
      try {
        await pool.query(`
          INSERT INTO edit_analyses (
            response_id, original_text, edited_text, edit_type, 
            success_score, user_id, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          uuidv4(),
          'Original stable test text',
          'Edited stable test text with consistent improvements', 
          'stable_pattern',
          stableRates[i],
          testUserId,
          testDate
        ]);
        console.log(`   ✅ Week ${i + 1}: ${stableRates[i]}% success (${testDate.toISOString().split('T')[0]})`);
      } catch (error) {
        console.log(`   ❌ Failed week ${i + 1}:`, error.message);
      }
    }

    // Test 2: Create unstable pattern (wildly varying performance)
    console.log('\n2️⃣ Creating UNSTABLE pattern scenario...');
    const unstableRates = [85, 45, 80, 30, 75, 20, 85]; // High variance
    
    for (let i = 0; i < unstableRates.length; i++) {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - (unstableRates.length - i) * 7);
      
      try {
        await pool.query(`
          INSERT INTO edit_analyses (
            response_id, original_text, edited_text, edit_type, 
            success_score, user_id, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          uuidv4(),
          'Original unstable test text',
          'Edited unstable test text with inconsistent results',
          'unstable_pattern',
          unstableRates[i],
          testUserId,
          testDate
        ]);
        console.log(`   ✅ Week ${i + 1}: ${unstableRates[i]}% success (${testDate.toISOString().split('T')[0]})`);
      } catch (error) {
        console.log(`   ❌ Failed week ${i + 1}:`, error.message);
      }
    }

    // Test 3: Create drifting pattern (declining performance over time)
    console.log('\n3️⃣ Creating DRIFTING pattern scenario...');
    const driftingRates = [90, 85, 75, 60, 45, 30, 20]; // Clear downward trend
    
    for (let i = 0; i < driftingRates.length; i++) {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - (driftingRates.length - i) * 7);
      
      try {
        await pool.query(`
          INSERT INTO edit_analyses (
            response_id, original_text, edited_text, edit_type, 
            success_score, user_id, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          uuidv4(),
          'Original drifting test text',
          'Edited drifting test text showing pattern degradation',
          'drifting_pattern',
          driftingRates[i],
          testUserId,
          testDate
        ]);
        console.log(`   ✅ Week ${i + 1}: ${driftingRates[i]}% success (${testDate.toISOString().split('T')[0]})`);
      } catch (error) {
        console.log(`   ❌ Failed week ${i + 1}:`, error.message);
      }
    }

    // Test 4: Calculate stability for each pattern
    console.log('\n4️⃣ Testing stability calculations...');
    
    const patterns = [
      { name: 'stable_pattern', expected: 'high stability, no drift' },
      { name: 'unstable_pattern', expected: 'low stability, no drift' },
      { name: 'drifting_pattern', expected: 'low stability, drift detected' }
    ];
    
    for (const pattern of patterns) {
      console.log(`\n   📊 Analyzing ${pattern.name} (expecting: ${pattern.expected})...`);
      
      try {
        const stabilityResult = await pool.query(`
          SELECT * FROM calculate_pattern_stability('edit_type', $1, $2)
        `, [pattern.name, testUserId]);

        if (stabilityResult.rows.length > 0) {
          const result = stabilityResult.rows[0];
          const score = parseFloat(result.stability_score || 0).toFixed(3);
          const variance = parseFloat(result.pattern_variance || 0).toFixed(3);
          
          console.log(`      Stability Score: ${score} ${parseFloat(score) >= 0.7 ? '✅ STABLE' : '❌ UNSTABLE'}`);
          console.log(`      Variance: ${variance}`);
          console.log(`      Is Stable: ${result.is_stable ? '✅ YES' : '❌ NO'}`);
          console.log(`      Drift Detected: ${result.drift_detected ? '⚠️ YES' : '✅ NO'}`);
          console.log(`      Weekly Rates Count: ${result.weekly_rates ? result.weekly_rates.length : 0}`);
          
          if (result.weekly_rates && result.weekly_rates.length > 0) {
            console.log(`      Weekly Rates: [${result.weekly_rates.map(r => parseFloat(r).toFixed(1)).join(', ')}]`);
          }
        } else {
          console.log('      ❌ No stability calculation results (insufficient data)');
        }
      } catch (error) {
        console.log(`      ❌ Stability calculation failed:`, error.message);
      }
    }

    // Test 5: Generate learning insights (trigger the database trigger)
    console.log('\n5️⃣ Generating learning insights...');
    
    for (const pattern of patterns) {
      try {
        // Add one more record to trigger the learning insight generation
        await pool.query(`
          INSERT INTO edit_analyses (
            response_id, original_text, edited_text, edit_type, 
            success_score, user_id
          )
          VALUES ($1, $2, $3, $4, 75, $5)
        `, [
          uuidv4(),
          'Trigger learning insight',
          'Trigger learning insight edit',
          pattern.name,
          testUserId
        ]);
        console.log(`   ✅ Triggered learning insight for ${pattern.name}`);
      } catch (error) {
        console.log(`   ❌ Failed to trigger ${pattern.name}:`, error.message);
      }
    }

    // Wait a moment for triggers to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 6: Check generated learning insights
    const insightsResult = await pool.query(`
      SELECT pattern_value, sample_size, confidence, success_rate,
             stability_score, stability_validated, pattern_drift_detected,
             validation_status, threshold_met
      FROM validated_learning_insights_with_stability
      WHERE pattern_value IN ('stable_pattern', 'unstable_pattern', 'drifting_pattern')
      ORDER BY pattern_value
    `);

    console.log('\n6️⃣ Generated Learning Insights:');
    if (insightsResult.rows.length > 0) {
      insightsResult.rows.forEach(insight => {
        const score = insight.stability_score ? parseFloat(insight.stability_score).toFixed(3) : 'NULL';
        const successRate = insight.success_rate ? parseFloat(insight.success_rate).toFixed(1) : 'NULL';
        console.log(`\n   📊 ${insight.pattern_value}:`);
        console.log(`      Sample Size: ${insight.sample_size}`);
        console.log(`      Success Rate: ${successRate}%`);
        console.log(`      Confidence: ${insight.confidence}%`);
        console.log(`      Stability Score: ${score}`);
        console.log(`      Stable: ${insight.stability_validated ? '✅ YES' : '❌ NO'}`);
        console.log(`      Drift: ${insight.pattern_drift_detected ? '⚠️ YES' : '✅ NO'}`);
        console.log(`      Threshold Met: ${insight.threshold_met ? '✅ YES' : '❌ NO'}`);
        console.log(`      Status: ${insight.validation_status}`);

        // Determine if Phase 2 would accept/reject this pattern
        const wouldApply = insight.threshold_met && insight.stability_validated && !insight.pattern_drift_detected;
        console.log(`      Phase 2 Decision: ${wouldApply ? '✅ APPLY PATTERN' : '❌ REJECT PATTERN'}`);
      });
    } else {
      console.log('   ❌ No learning insights generated');
    }

    console.log('\n✅ Valid test scenarios created successfully!');
    console.log(`\n📋 Summary:`);
    console.log(`   - Stable pattern: Should be accepted (high stability, no drift)`);
    console.log(`   - Unstable pattern: Should be rejected (low stability)`);  
    console.log(`   - Drifting pattern: Should be rejected (drift detected)`);
    console.log(`   - Test User ID: ${testUserId}`);

  } catch (error) {
    console.error('❌ Test creation failed:', error);
    console.error('Details:', error.message);
  } finally {
    await pool.end();
  }
}

createValidTestScenarios();