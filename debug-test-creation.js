// Debug Test Scenario Creation Issues
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugTestCreation() {
  console.log('🔍 DEBUGGING TEST SCENARIO CREATION');
  console.log('=' .repeat(50));

  const testUserId = `debug-test-${Date.now()}`;

  try {
    // Test 1: Create simple stable pattern
    console.log('\n1️⃣ Testing stable pattern creation...');
    const stableRates = [85, 88, 82, 87, 90];
    
    for (let i = 0; i < stableRates.length; i++) {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - (stableRates.length - i) * 7); // Weekly intervals
      
      try {
        await pool.query(`
          INSERT INTO edit_analyses (edit_type, success_score, user_id, created_at)
          VALUES ($1, $2, $3, $4)
        `, ['stable_debug', stableRates[i], testUserId, testDate]);
        console.log(`   ✅ Week ${i + 1}: ${stableRates[i]}% success`);
      } catch (error) {
        console.log(`   ❌ Failed week ${i + 1}:`, error.message);
      }
    }

    // Test 2: Create unstable pattern  
    console.log('\n2️⃣ Testing unstable pattern creation...');
    const unstableRates = [85, 45, 80, 30, 75];
    
    for (let i = 0; i < unstableRates.length; i++) {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - (unstableRates.length - i) * 7);
      
      try {
        await pool.query(`
          INSERT INTO edit_analyses (edit_type, success_score, user_id, created_at)
          VALUES ($1, $2, $3, $4)
        `, ['unstable_debug', unstableRates[i], testUserId, testDate]);
        console.log(`   ✅ Week ${i + 1}: ${unstableRates[i]}% success`);
      } catch (error) {
        console.log(`   ❌ Failed week ${i + 1}:`, error.message);
      }
    }

    // Test 3: Create drifting pattern
    console.log('\n3️⃣ Testing drifting pattern creation...');
    const driftingRates = [85, 70, 55, 40, 25];
    
    for (let i = 0; i < driftingRates.length; i++) {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - (driftingRates.length - i) * 7);
      
      try {
        await pool.query(`
          INSERT INTO edit_analyses (edit_type, success_score, user_id, created_at)
          VALUES ($1, $2, $3, $4)
        `, ['drifting_debug', driftingRates[i], testUserId, testDate]);
        console.log(`   ✅ Week ${i + 1}: ${driftingRates[i]}% success`);
      } catch (error) {
        console.log(`   ❌ Failed week ${i + 1}:`, error.message);
      }
    }

    // Test 4: Calculate stability for each pattern
    console.log('\n4️⃣ Testing stability calculations...');
    
    const patterns = ['stable_debug', 'unstable_debug', 'drifting_debug'];
    for (const pattern of patterns) {
      console.log(`\n   📊 Analyzing ${pattern}...`);
      
      try {
        const stabilityResult = await pool.query(`
          SELECT * FROM calculate_pattern_stability('edit_type', $1, $2)
        `, [pattern, testUserId]);

        if (stabilityResult.rows.length > 0) {
          const result = stabilityResult.rows[0];
          const score = parseFloat(result.stability_score || 0).toFixed(3);
          const variance = parseFloat(result.pattern_variance || 0).toFixed(3);
          
          console.log(`      Stability Score: ${score}`);
          console.log(`      Variance: ${variance}`);
          console.log(`      Is Stable: ${result.is_stable ? 'YES' : 'NO'}`);
          console.log(`      Drift Detected: ${result.drift_detected ? 'YES' : 'NO'}`);
          console.log(`      Weekly Rates: [${result.weekly_rates || []}]`);
        } else {
          console.log('      ❌ No stability calculation results');
        }
      } catch (error) {
        console.log(`      ❌ Stability calculation failed:`, error.message);
      }
    }

    // Test 5: Check learning insights generation
    console.log('\n5️⃣ Testing learning insights generation...');
    
    // Trigger learning insights creation by adding more data
    for (const pattern of patterns) {
      try {
        await pool.query(`
          INSERT INTO edit_analyses (edit_type, success_score, user_id)
          VALUES ($1, 75, $2)
        `, [pattern, testUserId]);
        console.log(`   ✅ Triggered learning insight for ${pattern}`);
      } catch (error) {
        console.log(`   ❌ Failed to trigger ${pattern}:`, error.message);
      }
    }

    // Check generated insights
    const insightsResult = await pool.query(`
      SELECT pattern_value, sample_size, confidence, 
             stability_score, stability_validated, pattern_drift_detected,
             validation_status
      FROM validated_learning_insights_with_stability
      WHERE pattern_value IN ('stable_debug', 'unstable_debug', 'drifting_debug')
      ORDER BY pattern_value
    `);

    console.log('\n6️⃣ Generated Learning Insights:');
    if (insightsResult.rows.length > 0) {
      insightsResult.rows.forEach(insight => {
        const score = insight.stability_score ? parseFloat(insight.stability_score).toFixed(3) : 'NULL';
        console.log(`   📊 ${insight.pattern_value}:`);
        console.log(`      Sample Size: ${insight.sample_size}`);
        console.log(`      Confidence: ${insight.confidence}%`);
        console.log(`      Stability Score: ${score}`);
        console.log(`      Stable: ${insight.stability_validated ? 'YES' : 'NO'}`);
        console.log(`      Drift: ${insight.pattern_drift_detected ? 'YES' : 'NO'}`);
        console.log(`      Status: ${insight.validation_status}`);
      });
    } else {
      console.log('   ❌ No learning insights generated');
    }

    console.log('\n✅ Debug test completed');

  } catch (error) {
    console.error('❌ Debug test failed:', error);
    console.error('Details:', error.message);
  } finally {
    await pool.end();
  }
}

debugTestCreation();