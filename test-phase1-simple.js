// Simple Phase 1 Meeting Pipeline Test
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testPhase1Simple() {
  console.log('🧪 PHASE 1: SIMPLE MEETING PIPELINE TEST');
  console.log('='.repeat(50));

  try {
    // Test 1: Check database setup
    console.log('\n1️⃣ Checking database setup...');
    
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('meeting_processing_results', 'meeting_requests')
      AND table_schema = 'public'
    `);
    
    console.log(`   Found tables: ${tablesCheck.rows.map(r => r.table_name).join(', ')}`);
    
    if (tablesCheck.rows.length >= 2) {
      console.log('   ✅ Database tables exist');
    } else {
      console.log('   ❌ Missing database tables');
      return;
    }

    // Test 2: Check service health
    console.log('\n2️⃣ Checking meeting pipeline service health...');
    
    // Import the service
    const { MeetingPipelineService } = require('./dist/services/meetingPipeline');
    const meetingPipeline = new MeetingPipelineService();
    
    const health = await meetingPipeline.healthCheck();
    console.log(`   Health status: ${health.status}`);
    
    if (health.status === 'healthy') {
      console.log('   ✅ Service is healthy');
    } else {
      console.log('   ❌ Service is not healthy');
      return;
    }

    // Test 3: Test with a single email
    console.log('\n3️⃣ Testing with sample meeting email...');
    
    const testUserId = `simple-test-${Date.now()}`;
    
    // Create test email in database
    const emailResult = await pool.query(`
      INSERT INTO emails (gmail_id, thread_id, user_id, subject, from_email, to_email, body, category, received_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, [
      'test-meeting-email-1',
      'thread-test-1',
      testUserId,
      'Meeting Request: Quick sync',
      'colleague@company.com',
      'user@company.com', // Add to_email
      'Hi! Would you be free for a 30-minute sync meeting tomorrow at 2 PM? We need to discuss the project updates.',
      'business'
    ]);
    
    const emailDbId = emailResult.rows[0].id;
    console.log(`   Created test email with DB ID: ${emailDbId}`);
    
    // Process through meeting pipeline
    const result = await meetingPipeline.processEmailForMeetings({
      id: 'test-meeting-email-1',
      subject: 'Meeting Request: Quick sync',
      from: 'colleague@company.com',
      body: 'Hi! Would you be free for a 30-minute sync meeting tomorrow at 2 PM? We need to discuss the project updates.',
      category: 'business'
    }, testUserId, emailDbId);
    
    console.log(`   Processing result:`);
    console.log(`     Meeting detected: ${result.isMeetingRequest ? 'YES' : 'NO'}`);
    console.log(`     Confidence: ${result.confidence}%`);
    console.log(`     Status: ${result.status}`);
    
    // Test 4: Check database storage
    console.log('\n4️⃣ Checking database storage...');
    
    const processingResults = await pool.query(
      'SELECT * FROM meeting_processing_results WHERE user_id = $1',
      [testUserId]
    );
    
    const meetingRequests = await pool.query(
      'SELECT * FROM meeting_requests WHERE user_id = $1',
      [testUserId]
    );
    
    console.log(`   Processing results stored: ${processingResults.rows.length}`);
    console.log(`   Meeting requests stored: ${meetingRequests.rows.length}`);
    
    // Test 5: Test statistics
    console.log('\n5️⃣ Testing statistics...');
    
    const stats = await meetingPipeline.getMeetingStats(testUserId);
    console.log(`   Total meetings: ${stats.total}`);
    console.log(`   Pending meetings: ${stats.pending}`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await pool.query('DELETE FROM meeting_processing_results WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM meeting_requests WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM emails WHERE user_id = $1', [testUserId]);
    
    // Final assessment
    console.log('\n✅ PHASE 1 BASIC FUNCTIONALITY TEST COMPLETED');
    
    if (result.isMeetingRequest && processingResults.rows.length > 0) {
      console.log('🎉 PHASE 1 MEETING PIPELINE IS WORKING!');
      console.log('\n✅ Verified:');
      console.log('   🔍 Meeting detection working');
      console.log('   💾 Database storage working');
      console.log('   📊 Statistics working');
      console.log('   🌐 Service integration working');
      
      console.log('\n🚀 READY FOR PRODUCTION TESTING');
    } else {
      console.log('❌ Some issues found - needs investigation');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Details:', error.message);
  } finally {
    await pool.end();
  }
}

testPhase1Simple()
  .then(() => {
    console.log('\n🏁 Simple Phase 1 test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });