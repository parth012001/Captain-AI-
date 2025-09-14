// Apply Phase 1 Threshold Enhancement Schema
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyPhase1ThresholdSchema() {
  console.log('🚀 Applying Phase 1 Threshold Enhancement Schema...');
  
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'scripts/database/phase1_threshold_enhancement.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📖 Schema file loaded, executing SQL commands...');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('✅ Phase 1 Threshold Enhancement Schema applied successfully!');
    
    // Test the new functionality
    console.log('\n🧪 Testing new threshold functionality...');
    
    // Check if new columns exist
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'learning_insights' 
      AND column_name IN ('sample_size', 'time_span_days', 'threshold_met')
      ORDER BY column_name;
    `);
    
    console.log('📊 New columns added to learning_insights:');
    columnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} DEFAULT: ${col.column_default || 'NONE'}`);
    });
    
    // Check the validated_learning_insights view
    const viewResult = await pool.query(`
      SELECT COUNT(*) as total_insights,
             COUNT(*) FILTER (WHERE threshold_met = true) as validated_insights,
             COUNT(*) FILTER (WHERE validation_status = 'INSUFFICIENT_SAMPLES') as insufficient_samples,
             COUNT(*) FILTER (WHERE validation_status = 'INSUFFICIENT_CONFIDENCE') as insufficient_confidence
      FROM validated_learning_insights;
    `);
    
    console.log('\n📈 Learning Insights Threshold Analysis:');
    const stats = viewResult.rows[0];
    console.log(`   - Total Insights: ${stats.total_insights}`);
    console.log(`   - Validated (meets thresholds): ${stats.validated_insights}`);
    console.log(`   - Insufficient Samples (<5): ${stats.insufficient_samples}`);
    console.log(`   - Insufficient Confidence (<65%): ${stats.insufficient_confidence}`);
    
    // Show sample of validated insights
    const sampleResult = await pool.query(`
      SELECT pattern_type, pattern_value, sample_size, confidence, validation_status
      FROM validated_learning_insights 
      ORDER BY threshold_met DESC, confidence DESC
      LIMIT 5;
    `);
    
    console.log('\n🎯 Sample Learning Insights with Threshold Validation:');
    if (sampleResult.rows.length > 0) {
      sampleResult.rows.forEach((insight, idx) => {
        console.log(`   ${idx + 1}. ${insight.pattern_type}:${insight.pattern_value} - ${insight.sample_size} samples, ${insight.confidence}% confidence - ${insight.validation_status}`);
      });
    } else {
      console.log('   No learning insights found yet (empty learning system)');
    }
    
    console.log('\n✅ Phase 1 Threshold Enhancement completed successfully!');
    console.log('🎯 Next steps:');
    console.log('   1. Update LearningService to use threshold validation');  
    console.log('   2. Test with existing learning data');
    console.log('   3. Monitor improved learning quality');
    
  } catch (error) {
    console.error('❌ Error applying Phase 1 schema:', error);
    console.error('Details:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the schema application
applyPhase1ThresholdSchema()
  .then(() => {
    console.log('🎉 Schema application completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Schema application failed:', error);
    process.exit(1);
  });