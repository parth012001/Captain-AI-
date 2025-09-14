// Apply Meeting Pipeline Database Schema (Fixed)
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyMeetingPipelineSchemaFixed() {
  console.log('🚀 Applying Meeting Pipeline Database Schema (Fixed)...');
  
  try {
    // Read the fixed schema file
    const schemaPath = path.join(__dirname, 'scripts/database/meeting_pipeline_schema_fixed.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📖 Fixed schema file loaded, executing SQL commands...');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('✅ Meeting Pipeline Schema (Fixed) applied successfully!');
    
    // Test the new functionality
    console.log('\n🧪 Testing new meeting pipeline functionality...');
    
    // Check if new tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('meeting_processing_results')
      ORDER BY table_name;
    `);
    
    console.log('📊 New tables created:');
    tablesResult.rows.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    // Check meeting_processing_results table structure
    const processingColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'meeting_processing_results' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 meeting_processing_results table columns:');
    processingColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check meeting_requests table modifications
    const meetingRequestsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'meeting_requests' 
      AND column_name IN ('user_id', 'email_id')
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 meeting_requests key columns:');
    meetingRequestsColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Test the analytics function
    const statsResult = await pool.query(`
      SELECT * FROM get_meeting_pipeline_stats('test_user')
    `);
    
    console.log('\n📈 Pipeline stats function test:');
    if (statsResult.rows.length > 0) {
      const stats = statsResult.rows[0];
      console.log(`   - Total processed: ${stats.total_processed}`);
      console.log(`   - Meeting requests found: ${stats.meeting_requests_found}`);
      console.log(`   - Success rate: ${stats.success_rate}%`);
      console.log(`   - Avg processing time: ${stats.avg_processing_time}ms`);
    } else {
      console.log('   - No data yet (expected for fresh installation)');
    }
    
    // Test the helper function
    const helperTest = await pool.query(`
      SELECT get_email_db_id('test_gmail_id', 'test_user') as result
    `);
    
    console.log(`\n🔧 Helper function test: ${helperTest.rows[0].result === null ? '✅ Working (no test data)' : '✅ Working'}`);
    
    // Check the analytics views
    const analyticsViewResult = await pool.query(`
      SELECT COUNT(*) as view_ready FROM meeting_pipeline_analytics LIMIT 1
    `);
    
    const detailedViewResult = await pool.query(`
      SELECT COUNT(*) as view_ready FROM meeting_pipeline_detailed LIMIT 1
    `);
    
    console.log(`\n📊 Analytics view ready: ${analyticsViewResult.rows[0].view_ready >= 0 ? '✅ Yes' : '❌ No'}`);
    console.log(`📊 Detailed view ready: ${detailedViewResult.rows[0].view_ready >= 0 ? '✅ Yes' : '❌ No'}`);
    
    console.log('\n✅ Meeting Pipeline database setup completed successfully!');
    console.log('\n🎯 Next steps:');
    console.log('   1. Update MeetingPipelineService to use correct database IDs');
    console.log('   2. Integrate pipeline with email processing route');
    console.log('   3. Create meeting pipeline API endpoints');
    console.log('   4. Test with real email data');
    
  } catch (error) {
    console.error('❌ Error applying meeting pipeline schema:', error);
    console.error('Details:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the schema application
applyMeetingPipelineSchemaFixed()
  .then(() => {
    console.log('🎉 Meeting pipeline schema application completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Meeting pipeline schema application failed:', error);
    process.exit(1);
  });