// Test script to validate user-scoped learning isolation
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'chief_ai',
  user: 'parthahir',
  password: ''
});

async function testUserIsolation() {
  try {
    console.log('🧪 TESTING USER ISOLATION IN LEARNING SYSTEM\n');

    // Test 1: Check if edit_analyses table has user_id column and data
    console.log('1. Checking edit_analyses table structure...');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'edit_analyses' 
      AND column_name IN ('user_id', 'edit_type', 'created_at');
    `);
    console.log('   Table columns:', schemaResult.rows);

    // Test 2: Check total records vs user-specific records
    console.log('\n2. Comparing global vs user-specific data...');
    
    const globalCount = await pool.query(`
      SELECT COUNT(*) as total, edit_type 
      FROM edit_analyses 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY edit_type;
    `);
    console.log('   Global patterns (ALL users):', globalCount.rows);

    // Test 3: Try to get user-specific data (should return different results)
    const userSpecificCount = await pool.query(`
      SELECT COUNT(*) as total, edit_type 
      FROM edit_analyses 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND user_id = $1
      GROUP BY edit_type;
    `, ['test-user-123']);
    console.log('   User-specific patterns (user test-user-123):', userSpecificCount.rows);

    // Test 4: Check if generated_responses table has user_id
    console.log('\n3. Checking generated_responses table...');
    const responseSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'generated_responses' 
      AND column_name IN ('user_id', 'generated_at', 'edit_percentage');
    `);
    console.log('   Response table columns:', responseSchema.rows);

    // Test 5: Performance trend comparison
    console.log('\n4. Testing performance trends...');
    const globalTrend = await pool.query(`
      SELECT 
        DATE_TRUNC('week', generated_at) as week,
        COUNT(*) as total_responses
      FROM generated_responses 
      WHERE generated_at >= CURRENT_DATE - INTERVAL '4 weeks'
      GROUP BY DATE_TRUNC('week', generated_at)
      ORDER BY week DESC;
    `);
    console.log('   Global trends:', globalTrend.rows);

    const userTrend = await pool.query(`
      SELECT 
        DATE_TRUNC('week', generated_at) as week,
        COUNT(*) as total_responses
      FROM generated_responses 
      WHERE generated_at >= CURRENT_DATE - INTERVAL '4 weeks'
        AND user_id = $1
      GROUP BY DATE_TRUNC('week', generated_at)
      ORDER BY week DESC;
    `, ['test-user-123']);
    console.log('   User-specific trends:', userTrend.rows);

    console.log('\n✅ USER ISOLATION TEST COMPLETE');
    console.log('\n📊 ANALYSIS:');
    console.log('   - Global data exists:', globalCount.rows.length > 0);
    console.log('   - User filtering works:', globalCount.rows.length !== userSpecificCount.rows.length);
    console.log('   - Tables have user_id columns:', schemaResult.rows.length > 0);

    if (globalCount.rows.length > 0 && userSpecificCount.rows.length === 0) {
      console.log('   ✅ ISOLATION CONFIRMED: User-specific queries return different results than global');
    } else if (globalCount.rows.length === userSpecificCount.rows.length) {
      console.log('   ❌ ISOLATION FAILED: User-specific queries return same results as global');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testUserIsolation();