// Debug Phase 2 Schema Issues
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugPhase2Schema() {
  console.log('🔍 DEBUGGING PHASE 2 SCHEMA ISSUES');
  console.log('=' .repeat(50));

  try {
    // Check current learning_insights schema
    const schemaResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'learning_insights' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📊 Current learning_insights columns:');
    const existingColumns = [];
    schemaResult.rows.forEach(col => {
      existingColumns.push(col.column_name);
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? 'DEFAULT ' + col.column_default : ''}`);
    });

    // Check if weekly_success_rates column exists
    const hasWeeklyRates = existingColumns.includes('weekly_success_rates');
    console.log(`\n🔍 weekly_success_rates column exists: ${hasWeeklyRates ? '✅ YES' : '❌ NO'}`);

    // Check Phase 2 stability columns
    const phase2Columns = ['stability_score', 'pattern_variance', 'stability_validated', 'pattern_drift_detected'];
    console.log('\n🔍 Phase 2 columns status:');
    phase2Columns.forEach(col => {
      const exists = existingColumns.includes(col);
      console.log(`   - ${col}: ${exists ? '✅' : '❌'}`);
    });

    // Try to test data type issues
    console.log('\n🧪 Testing data type limits:');
    
    try {
      await pool.query('SELECT 999.99::DECIMAL(3,2)');
      console.log('   ✅ DECIMAL(3,2) max value test passed');
    } catch (error) {
      console.log('   ❌ DECIMAL(3,2) overflow:', error.message);
    }

    try {
      await pool.query('SELECT 99999.999::DECIMAL(5,3)');
      console.log('   ✅ DECIMAL(5,3) max value test passed');
    } catch (error) {
      console.log('   ❌ DECIMAL(5,3) overflow:', error.message);
    }

    // Check what edit_analyses data looks like
    const editAnalysesResult = await pool.query(`
      SELECT edit_type, success_score, created_at, user_id
      FROM edit_analyses 
      ORDER BY created_at DESC 
      LIMIT 5;
    `);

    console.log('\n📈 Sample edit_analyses data:');
    if (editAnalysesResult.rows.length > 0) {
      editAnalysesResult.rows.forEach((row, idx) => {
        console.log(`   ${idx + 1}. ${row.edit_type}: ${row.success_score}% (${row.created_at?.toISOString()?.split('T')[0]})`);
      });
    } else {
      console.log('   No edit analyses found');
    }

    // Check current learning insights
    const insightsResult = await pool.query(`
      SELECT pattern_type, pattern_value, sample_size, confidence, 
             stability_score, pattern_variance
      FROM learning_insights 
      ORDER BY last_updated DESC 
      LIMIT 3;
    `);

    console.log('\n🧠 Current learning insights:');
    if (insightsResult.rows.length > 0) {
      insightsResult.rows.forEach((row, idx) => {
        const stability = row.stability_score ? parseFloat(row.stability_score).toFixed(2) : 'NULL';
        const variance = row.pattern_variance ? parseFloat(row.pattern_variance).toFixed(3) : 'NULL';
        console.log(`   ${idx + 1}. ${row.pattern_type}:${row.pattern_value} - samples: ${row.sample_size}, conf: ${row.confidence}%, stability: ${stability}, variance: ${variance}`);
      });
    } else {
      console.log('   No learning insights found');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Error details:', error.message);
  } finally {
    await pool.end();
  }
}

debugPhase2Schema();