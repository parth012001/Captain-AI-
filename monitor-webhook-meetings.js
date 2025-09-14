// Monitor webhook processing for meeting detection
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function monitorWebhookMeetings() {
  try {
    console.log('🔍 MONITORING WEBHOOK MEETING DETECTION INTEGRATION');
    console.log('=' .repeat(60));

    // Check recent emails processed by webhook
    console.log('\n📧 1. RECENT WEBHOOK-PROCESSED EMAILS:');
    const recentEmails = await pool.query(`
      SELECT id, subject, from_email, received_at, webhook_processed, user_id
      FROM emails 
      WHERE webhook_processed = true 
      ORDER BY received_at DESC 
      LIMIT 10
    `);

    recentEmails.rows.forEach((email, idx) => {
      console.log(`   ${idx + 1}. ID: ${email.id} | "${email.subject}" | ${email.received_at}`);
    });

    // Check if any webhook emails have meeting processing results
    console.log('\n🧠 2. MEETING PROCESSING RESULTS FOR WEBHOOK EMAILS:');
    const webhookMeetingResults = await pool.query(`
      SELECT 
        e.id as email_id,
        e.subject,
        e.received_at,
        mpr.is_meeting_request,
        mpr.confidence,
        mpr.status,
        mpr.processed_at
      FROM emails e
      LEFT JOIN meeting_processing_results mpr ON e.id = mpr.email_db_id
      WHERE e.webhook_processed = true
      ORDER BY e.received_at DESC
      LIMIT 10
    `);

    let webhookMeetingsFound = 0;
    webhookMeetingResults.rows.forEach((row, idx) => {
      const hasMeetingResult = row.is_meeting_request !== null;
      const status = hasMeetingResult 
        ? `${row.is_meeting_request ? '📅 MEETING' : '📧 NO-MEETING'} (${row.confidence}%)`
        : '❌ NO PROCESSING';
      
      console.log(`   ${idx + 1}. "${row.subject}" → ${status}`);
      
      if (hasMeetingResult) {
        webhookMeetingsFound++;
      }
    });

    console.log(`\n   📊 Summary: ${webhookMeetingsFound}/${webhookMeetingResults.rows.length} webhook emails processed by meeting pipeline`);

    // Check meeting requests from webhook emails
    console.log('\n📅 3. MEETING REQUESTS FROM WEBHOOK EMAILS:');
    const webhookMeetingRequests = await pool.query(`
      SELECT 
        e.id as email_id,
        e.subject,
        e.received_at,
        mr.meeting_type,
        mr.urgency_level,
        mr.detection_confidence,
        mr.status as meeting_status
      FROM emails e
      JOIN meeting_requests mr ON e.id = mr.email_id
      WHERE e.webhook_processed = true
      ORDER BY e.received_at DESC
      LIMIT 5
    `);

    if (webhookMeetingRequests.rows.length > 0) {
      webhookMeetingRequests.rows.forEach((meeting, idx) => {
        console.log(`   ${idx + 1}. "${meeting.subject}"`);
        console.log(`      Type: ${meeting.meeting_type} | Urgency: ${meeting.urgency_level}`);
        console.log(`      Confidence: ${meeting.detection_confidence}% | Status: ${meeting.meeting_status}`);
        console.log(`      Received: ${meeting.received_at}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No meeting requests found from webhook-processed emails');
    }

    // Integration Status Assessment
    console.log('\n🎯 4. INTEGRATION STATUS ASSESSMENT:');
    
    const totalWebhookEmails = recentEmails.rows.length;
    const processedByMeetingPipeline = webhookMeetingsFound;
    const meetingRequestsCreated = webhookMeetingRequests.rows.length;

    console.log(`   📧 Total webhook emails: ${totalWebhookEmails}`);
    console.log(`   🧠 Processed by meeting pipeline: ${processedByMeetingPipeline}`);
    console.log(`   📅 Meeting requests created: ${meetingRequestsCreated}`);

    const integrationRate = totalWebhookEmails > 0 ? (processedByMeetingPipeline / totalWebhookEmails * 100) : 0;
    
    console.log(`\n🎯 INTEGRATION RATE: ${Math.round(integrationRate)}%`);

    if (integrationRate >= 80) {
      console.log('✅ WEBHOOK MEETING INTEGRATION IS WORKING!');
      console.log('🎉 Phase 1 & 2 are now active on live webhook emails');
    } else if (integrationRate >= 30) {
      console.log('⚠️ PARTIAL INTEGRATION - some emails processed');
      console.log('🔧 May need server restart or check logs for errors');
    } else {
      console.log('❌ INTEGRATION NOT WORKING YET');
      console.log('🔧 Server restart required or check for integration errors');
    }

    // Show most recent email details for debugging
    if (recentEmails.rows.length > 0) {
      const latestEmail = recentEmails.rows[0];
      console.log(`\n🔍 LATEST EMAIL DEBUG:`);
      console.log(`   Email ID: ${latestEmail.id}`);
      console.log(`   Subject: "${latestEmail.subject}"`);
      console.log(`   Webhook Processed: ${latestEmail.webhook_processed}`);
      console.log(`   User ID: ${latestEmail.user_id.substring(0, 8)}...`);
      
      // Check if this email has meeting processing
      const latestMeetingCheck = await pool.query(`
        SELECT is_meeting_request, confidence, status, processed_at
        FROM meeting_processing_results 
        WHERE email_db_id = $1
      `, [latestEmail.id]);
      
      if (latestMeetingCheck.rows.length > 0) {
        const result = latestMeetingCheck.rows[0];
        console.log(`   ✅ Meeting pipeline result: ${result.is_meeting_request ? 'MEETING' : 'NO-MEETING'} (${result.confidence}%)`);
        console.log(`   📅 Processed at: ${result.processed_at}`);
      } else {
        console.log(`   ❌ No meeting pipeline result found`);
      }
    }

    console.log('\n💡 NEXT STEPS:');
    if (integrationRate < 80) {
      console.log('   1. Restart your Node.js server to load the new webhook integration');
      console.log('   2. Send a new meeting request email');
      console.log('   3. Run this monitor again to verify integration');
    } else {
      console.log('   1. Send meeting request emails to test live detection');
      console.log('   2. Check server logs for [WEBHOOK] meeting pipeline messages');
      console.log('   3. Phase 1 & 2 are now fully integrated! 🎉');
    }

  } catch (error) {
    console.error('❌ Error monitoring webhook meetings:', error);
  } finally {
    await pool.end();
  }
}

monitorWebhookMeetings().catch(console.error);