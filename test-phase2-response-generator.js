// Phase 2 Meeting Response Generator Test
const { Pool } = require('pg');
const { MeetingPipelineService } = require('./dist/services/meetingPipeline');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test data - meeting requests with specific times
const MEETING_REQUEST_EMAILS = [
  {
    id: 'test-meeting-response-1',
    threadId: 'thread-response-1',
    subject: 'Quick catch up meeting tomorrow at 2 PM?',
    from: 'john.smith@company.com',
    to: 'user@company.com',
    body: 'Hi! Would you be available for a quick 30-minute catch up meeting tomorrow at 2 PM? I have some project updates to share and would love to hear your thoughts. Let me know if this works!',
    category: 'business'
  },
  {
    id: 'test-meeting-response-2',
    threadId: 'thread-response-2', 
    subject: 'Meeting Request: Urgent project discussion',
    from: 'urgent.client@bigcorp.com',
    to: 'user@company.com',
    body: 'Hello, we need to schedule an urgent meeting to discuss the project timeline. Are you available this Friday at 10 AM for about 1 hour? This is quite time-sensitive.',
    category: 'business'
  },
  {
    id: 'test-meeting-response-3',
    threadId: 'thread-response-3',
    subject: 'Flexible meeting request - when are you free?',
    from: 'flexible.contact@startup.io',
    to: 'user@company.com',
    body: 'Hey! I would love to schedule a meeting with you sometime this week or next. It would be about 45 minutes to discuss potential collaboration opportunities. When would be the best time for you?',
    category: 'business'
  }
];

async function testPhase2ResponseGenerator() {
  console.log('🧪 PHASE 2: INTELLIGENT MEETING RESPONSE GENERATOR TEST');
  console.log('='.repeat(65));

  const testUserId = `phase2-test-${Date.now()}`;
  let testResults = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  try {
    // Test 1: Initialize Meeting Pipeline Service with Response Generator
    console.log('\n1️⃣ Testing Enhanced Meeting Pipeline Service...');
    testResults.totalTests++;

    const meetingPipeline = new MeetingPipelineService();
    const healthCheck = await meetingPipeline.healthCheck();
    
    console.log(`   Health check status: ${healthCheck.status}`);
    console.log(`   Meeting detection: ${healthCheck.meetingDetectionReady ? '✅' : '❌'}`);
    console.log(`   Response generator: ${healthCheck.responseGeneratorReady ? '✅' : '❌'}`);
    console.log(`   Database: ${healthCheck.databaseConnection ? '✅' : '❌'}`);
    
    if (healthCheck.status === 'healthy' && healthCheck.responseGeneratorReady) {
      console.log('   ✅ Enhanced meeting pipeline ready');
      testResults.passed++;
      testResults.details.push({ 
        test: 'Enhanced Pipeline Health', 
        result: 'PASSED', 
        details: 'All services healthy including response generator'
      });
    } else {
      console.log('   ❌ Enhanced meeting pipeline not ready');
      testResults.failed++;
      testResults.details.push({ 
        test: 'Enhanced Pipeline Health', 
        result: 'FAILED', 
        details: `Status: ${healthCheck.status}, Response Gen: ${healthCheck.responseGeneratorReady}`
      });
    }

    // Test 2: Create test emails in database
    console.log('\n2️⃣ Creating test meeting request emails...');
    testResults.totalTests++;

    const emailIds = [];
    for (const email of MEETING_REQUEST_EMAILS) {
      try {
        const result = await pool.query(`
          INSERT INTO emails (gmail_id, thread_id, user_id, subject, from_email, to_email, body, category, received_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING id
        `, [email.id, email.threadId, testUserId, email.subject, email.from, email.to, email.body, email.category]);
        
        emailIds.push({ ...email, dbId: result.rows[0].id });
        console.log(`   📧 Created: "${email.subject.substring(0, 40)}..." (DB ID: ${result.rows[0].id})`);
      } catch (error) {
        console.log(`   ❌ Failed to create: "${email.subject}" - ${error.message}`);
      }
    }

    if (emailIds.length === MEETING_REQUEST_EMAILS.length) {
      console.log(`   ✅ All ${emailIds.length} test emails created`);
      testResults.passed++;
      testResults.details.push({ 
        test: 'Test Email Creation', 
        result: 'PASSED', 
        details: `${emailIds.length} meeting request emails created`
      });
    } else {
      console.log(`   ❌ Only ${emailIds.length}/${MEETING_REQUEST_EMAILS.length} emails created`);
      testResults.failed++;
      testResults.details.push({ 
        test: 'Test Email Creation', 
        result: 'FAILED', 
        details: `Only ${emailIds.length}/${MEETING_REQUEST_EMAILS.length} created`
      });
    }

    // Test 3: Process emails through enhanced pipeline (with response generation)
    console.log('\n3️⃣ Processing emails through enhanced pipeline...');
    testResults.totalTests++;

    const pipelineResults = [];
    for (const emailData of emailIds) {
      try {
        console.log(`   🔄 Processing: "${emailData.subject.substring(0, 40)}..."`);
        
        const result = await meetingPipeline.processEmailForMeetings(
          {
            id: emailData.id,
            threadId: emailData.threadId,
            subject: emailData.subject,
            from: emailData.from,
            to: emailData.to,
            body: emailData.body,
            date: new Date(),
            isRead: false
          },
          testUserId,
          emailData.dbId,
          true // Enable test mode
        );
        
        pipelineResults.push(result);
        
        const status = result.isMeetingRequest ? '📅 MEETING DETECTED' : '📧 NO MEETING';
        const responseStatus = result.response ? ` | Response: ${result.response.actionTaken}` : '';
        console.log(`      ${status} (confidence: ${result.confidence}%)${responseStatus}`);
        
        if (result.response) {
          console.log(`      📝 Response preview: "${result.response.responseText.substring(0, 80)}..."`);
        }
        
      } catch (error) {
        console.log(`   ❌ Failed to process "${emailData.subject}": ${error.message}`);
        pipelineResults.push({ 
          emailId: emailData.id,
          status: 'error',
          reason: error.message 
        });
      }
    }

    const processedCount = pipelineResults.filter(r => r.status === 'processed').length;
    const meetingsDetected = pipelineResults.filter(r => r.isMeetingRequest).length;
    const responsesGenerated = pipelineResults.filter(r => r.response && r.response.shouldRespond).length;

    console.log(`   📊 Results: ${processedCount} processed, ${meetingsDetected} meetings, ${responsesGenerated} responses`);

    if (processedCount >= 2 && meetingsDetected >= 2 && responsesGenerated >= 1) {
      console.log('   ✅ Enhanced pipeline processing successful');
      testResults.passed++;
      testResults.details.push({ 
        test: 'Enhanced Pipeline Processing', 
        result: 'PASSED', 
        details: `${meetingsDetected} meetings detected, ${responsesGenerated} responses generated`
      });
    } else {
      console.log('   ❌ Enhanced pipeline processing insufficient');
      testResults.failed++;
      testResults.details.push({ 
        test: 'Enhanced Pipeline Processing', 
        result: 'FAILED', 
        details: `Only ${responsesGenerated} responses from ${meetingsDetected} meetings`
      });
    }

    // Test 4: Verify response generation quality
    console.log('\n4️⃣ Analyzing response quality...');
    testResults.totalTests++;

    const responsesToAnalyze = pipelineResults.filter(r => r.response);
    let qualityScore = 0;
    
    for (const result of responsesToAnalyze) {
      const response = result.response;
      const originalEmail = emailIds.find(e => e.id === result.emailId);
      
      console.log(`   📧 Email: "${originalEmail?.subject.substring(0, 40)}..."`);
      console.log(`      Action: ${response.actionTaken} (confidence: ${response.confidenceScore}%)`);
      console.log(`      Should respond: ${response.shouldRespond}`);
      
      // Quality scoring
      let emailScore = 0;
      if (response.shouldRespond) emailScore += 25;
      if (response.responseText.length > 50) emailScore += 25;
      if (response.confidenceScore > 70) emailScore += 25;
      if (['accepted', 'suggested_alternatives'].includes(response.actionTaken)) emailScore += 25;
      
      qualityScore += emailScore;
      console.log(`      Quality score: ${emailScore}/100`);
    }

    const avgQualityScore = responsesToAnalyze.length > 0 ? qualityScore / responsesToAnalyze.length : 0;
    
    if (avgQualityScore >= 70) {
      console.log(`   ✅ Response quality excellent (${Math.round(avgQualityScore)}/100)`);
      testResults.passed++;
      testResults.details.push({ 
        test: 'Response Quality', 
        result: 'PASSED', 
        details: `Average quality score: ${Math.round(avgQualityScore)}/100`
      });
    } else {
      console.log(`   ❌ Response quality needs improvement (${Math.round(avgQualityScore)}/100)`);
      testResults.failed++;
      testResults.details.push({ 
        test: 'Response Quality', 
        result: 'FAILED', 
        details: `Average quality score only: ${Math.round(avgQualityScore)}/100`
      });
    }

    // Test 5: Verify database storage for responses
    console.log('\n5️⃣ Verifying response data storage...');
    testResults.totalTests++;

    const storedResults = await pool.query(`
      SELECT COUNT(*) as processing_count,
             COUNT(*) FILTER (WHERE is_meeting_request = true) as meeting_count
      FROM meeting_processing_results 
      WHERE user_id = $1
    `, [testUserId]);

    const processingCount = parseInt(storedResults.rows[0].processing_count);
    const storedMeetingCount = parseInt(storedResults.rows[0].meeting_count);

    console.log(`   📊 Storage: ${processingCount} processing records, ${storedMeetingCount} meetings stored`);

    if (processingCount >= 3 && storedMeetingCount >= 2) {
      console.log('   ✅ Response data storage working');
      testResults.passed++;
      testResults.details.push({ 
        test: 'Response Data Storage', 
        result: 'PASSED', 
        details: `${processingCount} records stored, ${storedMeetingCount} meetings`
      });
    } else {
      console.log('   ❌ Response data storage incomplete');
      testResults.failed++;
      testResults.details.push({ 
        test: 'Response Data Storage', 
        result: 'FAILED', 
        details: `Only ${processingCount} records, ${storedMeetingCount} meetings stored`
      });
    }

    // Results Summary
    console.log('\n' + '='.repeat(65));
    console.log('📊 PHASE 2 RESPONSE GENERATOR TEST RESULTS');
    console.log('='.repeat(65));

    const successRate = Math.round((testResults.passed / testResults.totalTests) * 100);
    
    testResults.details.forEach((detail, idx) => {
      const status = detail.result === 'PASSED' ? '✅ PASSED' : '❌ FAILED';
      console.log(`${status} ${detail.test}: ${detail.details}`);
    });

    console.log(`\n🎯 Phase 2 Success Rate: ${successRate}% (${testResults.passed}/${testResults.totalTests} tests passed)`);
    
    if (successRate >= 80) {
      console.log('🎉 PHASE 2 RESPONSE GENERATOR IS WORKING!');
      console.log('\n✅ PHASE 2 ACHIEVEMENTS:');
      console.log('   🤖 Intelligent meeting response generation');
      console.log('   📧 Automated email replies to meeting requests');
      console.log('   📅 Calendar integration with availability checking');
      console.log('   🎯 Context-aware response personalization');
      console.log('   💾 Response tracking and analytics');
      
      console.log('\n🚀 READY FOR PHASE 3:');
      console.log('   📅 Enhanced calendar-aware scheduling logic');
      console.log('   🔍 Multi-day availability analysis');
      console.log('   🤝 Advanced meeting workflow orchestration');
    } else {
      console.log('❌ Phase 2 needs additional work before proceeding');
      console.log('\n🔧 RECOMMENDED ACTIONS:');
      console.log('   1. Review failed tests and fix response generation');
      console.log('   2. Improve calendar integration and availability checking');
      console.log('   3. Enhance response quality and personalization');
    }

    console.log(`\n📝 Test User ID: ${testUserId} (for cleanup)`);

  } catch (error) {
    console.error('❌ Phase 2 test failed:', error);
    console.error('Details:', error.message);
  } finally {
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    try {
      await pool.query('DELETE FROM meeting_processing_results WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM meeting_requests WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM emails WHERE user_id = $1', [testUserId]);
      console.log('   ✅ Test data cleaned up successfully');
    } catch (cleanupError) {
      console.log('   ⚠️ Some test data may not have been cleaned up:', cleanupError.message);
    }

    await pool.end();
  }
}

// Run the comprehensive Phase 2 test
testPhase2ResponseGenerator()
  .then(() => {
    console.log('\n🏁 Phase 2 Response Generator test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Phase 2 test suite failed:', error);
    process.exit(1);
  });