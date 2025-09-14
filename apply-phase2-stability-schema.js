// Apply Phase 2 Stability Enhancement Schema
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyPhase2StabilitySchema() {
  console.log('🚀 Applying Phase 2 Stability Enhancement Schema...');
  
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'scripts/database/phase2_stability_enhancement.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📖 Schema file loaded, executing SQL commands...');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('✅ Phase 2 Stability Enhancement Schema applied successfully!');
    
    // Test the new stability functionality
    console.log('\n🧪 Testing new stability functionality...');
    
    // Check if new stability columns exist
    const stabilityColumnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'learning_insights' 
      AND column_name IN ('stability_score', 'pattern_variance', 'stability_validated', 'pattern_drift_detected')
      ORDER BY column_name;
    `);
    
    console.log('📊 New stability columns added to learning_insights:');
    stabilityColumnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} DEFAULT: ${col.column_default || 'NONE'}`);
    });
    
    // Check the enhanced validated learning insights view
    const enhancedViewResult = await pool.query(`
      SELECT COUNT(*) as total_insights,
             COUNT(*) FILTER (WHERE validation_status = 'FULLY_VALIDATED') as fully_validated,
             COUNT(*) FILTER (WHERE validation_status = 'THRESHOLD_MET_BUT_UNSTABLE') as unstable_patterns,
             COUNT(*) FILTER (WHERE validation_status = 'PATTERN_DRIFT_DETECTED') as drift_patterns,
             COUNT(*) FILTER (WHERE validation_status = 'STABLE_BUT_INSUFFICIENT_DATA') as stable_insufficient
      FROM validated_learning_insights_with_stability;
    `);
    
    console.log('\n📈 Enhanced Learning Insights Stability Analysis:');
    const stats = enhancedViewResult.rows[0];
    console.log(`   - Total Insights: ${stats.total_insights}`);
    console.log(`   - Fully Validated (Phase 1 + 2): ${stats.fully_validated}`);
    console.log(`   - Unstable Patterns (Phase 2 detection): ${stats.unstable_patterns}`);
    console.log(`   - Pattern Drift Detected: ${stats.drift_patterns}`);
    console.log(`   - Stable but Insufficient Data: ${stats.stable_insufficient}`);
    
    // Show sample of stability-validated insights
    const sampleStabilityResult = await pool.query(`
      SELECT pattern_type, pattern_value, sample_size, confidence, 
             stability_score, stability_validated, validation_status
      FROM validated_learning_insights_with_stability 
      ORDER BY 
        (validation_status = 'FULLY_VALIDATED') DESC,
        stability_score DESC,
        confidence DESC
      LIMIT 5;
    `);
    
    console.log('\n🎯 Sample Learning Insights with Stability Validation:');
    if (sampleStabilityResult.rows.length > 0) {
      sampleStabilityResult.rows.forEach((insight, idx) => {
        const stability = insight.stability_score ? `${(insight.stability_score * 100).toFixed(1)}% stable` : 'N/A';
        console.log(`   ${idx + 1}. ${insight.pattern_type}:${insight.pattern_value} - ${insight.sample_size} samples, ${insight.confidence}% confidence, ${stability} - ${insight.validation_status}`);
      });
    } else {
      console.log('   No learning insights found yet (empty learning system)');
    }

    // Test the stability calculation function
    console.log('\n🧮 Testing Stability Calculation Function:');
    
    // First check if we have any data to test with
    const hasDataResult = await pool.query(`
      SELECT COUNT(*) as edit_count FROM edit_analyses
    `);
    
    const editCount = parseInt(hasDataResult.rows[0].edit_count);
    
    if (editCount > 0) {
      console.log(`   📊 Found ${editCount} edit analyses for stability testing`);
      
      // Try to calculate stability for existing patterns
      const testStabilityResult = await pool.query(`
        SELECT pattern_value, 
               stability_score, 
               pattern_variance,
               stability_validated,
               pattern_drift_detected
        FROM learning_insights 
        WHERE pattern_type = 'edit_type' AND stability_score IS NOT NULL
        LIMIT 3;
      `);
      
      if (testStabilityResult.rows.length > 0) {
        console.log('   🎯 Stability Analysis Results:');
        testStabilityResult.rows.forEach(result => {
          const score = result.stability_score ? (result.stability_score * 100).toFixed(1) : 'N/A';
          const variance = result.pattern_variance ? parseFloat(result.pattern_variance).toFixed(3) : 'N/A';
          const stable = result.stability_validated ? '✅ STABLE' : '⚠️ UNSTABLE';
          const drift = result.pattern_drift_detected ? '📉 DRIFT DETECTED' : '📈 NO DRIFT';
          
          console.log(`      - ${result.pattern_value}: ${score}% stability, variance: ${variance} - ${stable}, ${drift}`);
        });
      } else {
        console.log('   📊 No stability calculations yet (patterns need more time-based data)');
      }
    } else {
      console.log('   📊 No edit analyses found - stability calculation will work when patterns emerge');
    }
    
    console.log('\n✅ Phase 2 Stability Enhancement completed successfully!');
    console.log('🎯 Next steps:');
    console.log('   1. Update LearningService to use stability validation');  
    console.log('   2. Create comprehensive test scenarios');
    console.log('   3. Monitor stability-based pattern filtering');
    
  } catch (error) {
    console.error('❌ Error applying Phase 2 schema:', error);
    console.error('Details:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the schema application
applyPhase2StabilitySchema()
  .then(() => {
    console.log('🎉 Phase 2 Stability schema application completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Phase 2 schema application failed:', error);
    process.exit(1);
  });