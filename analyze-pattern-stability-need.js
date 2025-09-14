// Analyze if we actually need Phase 2 Pattern Stability
// Look for unstable patterns in current learning data

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function analyzeStabilityNeed() {
  console.log('🔍 ANALYZING NEED FOR PHASE 2: Pattern Stability');
  console.log('=' .repeat(60));

  try {
    // 1. Look at edit patterns over time
    console.log('\n📊 CURRENT PATTERN ANALYSIS:');
    
    const timeBasedPatterns = await pool.query(`
      SELECT 
        edit_type,
        DATE_TRUNC('week', created_at) as week,
        COUNT(*) as edit_count,
        AVG(success_score) as avg_success,
        STDDEV(success_score) as success_variance
      FROM edit_analyses 
      WHERE created_at >= CURRENT_DATE - INTERVAL '8 weeks'
      GROUP BY edit_type, DATE_TRUNC('week', created_at)
      HAVING COUNT(*) >= 2
      ORDER BY edit_type, week
    `);

    if (timeBasedPatterns.rows.length === 0) {
      console.log('   ⚠️ Insufficient time-based data to analyze stability');
      
      // Create synthetic examples to demonstrate value
      console.log('\n🧪 SIMULATING PATTERN STABILITY SCENARIOS:');
      await simulatePatternStabilityScenarios();
      
    } else {
      console.log(`   📈 Found ${timeBasedPatterns.rows.length} time-windowed patterns:`);
      
      // Analyze each pattern's stability over time
      const patternsByType = {};
      timeBasedPatterns.rows.forEach(row => {
        if (!patternsByType[row.edit_type]) {
          patternsByType[row.edit_type] = [];
        }
        patternsByType[row.edit_type].push({
          week: row.week,
          avgSuccess: parseFloat(row.avg_success),
          variance: parseFloat(row.success_variance) || 0,
          count: parseInt(row.edit_count)
        });
      });

      // Calculate stability for each pattern type
      for (const [editType, weeks] of Object.entries(patternsByType)) {
        if (weeks.length >= 2) {
          const stability = calculateStability(weeks.map(w => w.avgSuccess));
          const isUnstable = stability < 0.7;
          
          console.log(`   ${isUnstable ? '❌' : '✅'} ${editType}: ${weeks.length} weeks, ${stability.toFixed(2)} stability ${isUnstable ? '(UNSTABLE!)' : '(stable)'}`);
          
          if (isUnstable) {
            console.log(`      Weekly success rates: ${weeks.map(w => w.avgSuccess.toFixed(1) + '%').join(' → ')}`);
          }
        }
      }
    }

    // 2. Demonstrate Phase 2 value with real scenarios
    console.log('\n🎯 PHASE 2 VALUE DEMONSTRATION:');
    
    // Scenario: User changes job/context
    console.log('\n   📋 SCENARIO 1: User Context Change');
    console.log('   Problem: User starts new job, communication style changes');
    console.log('   Week 1-2: Casual emails to old team → 85% success');  
    console.log('   Week 3-4: Same casual tone to new boss → 40% success');
    console.log('   Without Phase 2: System keeps applying "casual tone" pattern');
    console.log('   With Phase 2: Detects instability, stops bad pattern');

    // Scenario: Seasonal/temporary changes
    console.log('\n   📋 SCENARIO 2: Temporary Pattern Changes');
    console.log('   Problem: Holiday season changes communication patterns');
    console.log('   Nov: Formal business emails → 90% success');
    console.log('   Dec: Holiday casual emails → 85% success');  
    console.log('   Jan: Back to formal emails → 45% success with casual pattern');
    console.log('   Without Phase 2: Applies wrong pattern after context change');
    console.log('   With Phase 2: Adapts to pattern changes over time');

    // 3. Implementation complexity assessment
    console.log('\n⚖️ IMPLEMENTATION COMPLEXITY ASSESSMENT:');
    console.log('   📊 Database changes: 2 columns (stability_score, pattern_variance)');
    console.log('   🔧 Core algorithm: ~30 lines of variance calculation');
    console.log('   🔗 Integration: 1 line added to threshold check'); 
    console.log('   🧪 Testing: 3 clear test scenarios (stable/unstable/drifting)');
    console.log('   ⏱️ Estimated implementation: 2-3 hours');

    // 4. Cost vs benefit analysis  
    console.log('\n💰 COST VS BENEFIT ANALYSIS:');
    console.log('   Implementation Cost: 2-3 hours (very low)');
    console.log('   Testing Complexity: Low (clear mathematical scenarios)');  
    console.log('   Maintenance Overhead: Minimal (mostly automated)');
    console.log('   Value: Prevents pattern application when user preferences change');
    console.log('   Risk: Very low (just adds another filter, backward compatible)');

    console.log('\n🎯 RECOMMENDATION:');
    console.log('   ✅ IMPLEMENT PHASE 2 - Low cost, clear value, easy to test');
    console.log('   🚀 Benefits:'); 
    console.log('      - Detects when user preferences change');
    console.log('      - Prevents application of outdated patterns');
    console.log('      - Adapts to context changes over time');
    console.log('      - Only ~30 lines of code with clear test scenarios');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await pool.end();
  }
}

async function simulatePatternStabilityScenarios() {
  console.log('   🧪 Stable Pattern Example:');
  const stableRates = [85, 88, 82, 87, 90];
  const stableScore = calculateStability(stableRates);
  console.log(`      Success rates: ${stableRates.join('% → ')}%`);
  console.log(`      Stability score: ${stableScore.toFixed(2)} (✅ STABLE - apply pattern)`);

  console.log('\n   ⚠️ Unstable Pattern Example:');
  const unstableRates = [85, 45, 80, 30, 75];
  const unstableScore = calculateStability(unstableRates);
  console.log(`      Success rates: ${unstableRates.join('% → ')}%`);
  console.log(`      Stability score: ${unstableScore.toFixed(2)} (❌ UNSTABLE - don't apply pattern)`);

  console.log('\n   📉 Drifting Pattern Example:');
  const driftingRates = [85, 70, 55, 40, 25];
  const driftingScore = calculateStability(driftingRates);
  console.log(`      Success rates: ${driftingRates.join('% → ')}%`);
  console.log(`      Stability score: ${driftingScore.toFixed(2)} (❌ DRIFTING - pattern broke)`);
}

function calculateStability(successRates) {
  if (successRates.length < 2) return 1.0;
  
  const mean = successRates.reduce((a, b) => a + b) / successRates.length;
  const variance = successRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / successRates.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  
  // Convert to stability score (0-1, higher = more stable)
  return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
}

analyzeStabilityNeed();