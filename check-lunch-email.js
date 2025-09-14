// Check if lunch meeting email was processed through our pipeline
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkLunchEmail() {
  try {
    console.log('🔍 Checking for lunch meeting email processing...\n');
    
    // 1. Check if lunch email exists in emails table
    console.log('📧 1. CHECKING EMAILS TABLE:');
    const emailCheck = await pool.query(`
      SELECT id, subject, from_email, body, category, received_at, webhook_processed, user_id
      FROM emails 
      WHERE (subject ILIKE '%lunch%' OR body ILIKE '%lunch%' OR body ILIKE '%catch%' OR body ILIKE '%2 PM%')
      ORDER BY received_at DESC 
      LIMIT 5
    `);
    
    if (emailCheck.rows.length > 0) {
      emailCheck.rows.forEach((row, idx) => {
        console.log(`   ${idx + 1}. Email ID: ${row.id}`);
        console.log(`      Subject: "${row.subject}"`);
        console.log(`      From: ${row.from_email}`);
        console.log(`      User: ${row.user_id}`);
        console.log(`      Category: ${row.category}`);
        console.log(`      Webhook Processed: ${row.webhook_processed}`);
        console.log(`      Received: ${row.received_at}`);
        console.log(`      Body preview: "${row.body.substring(0, 100)}..."`);
        console.log('');
      });
    } else {
      console.log('   ❌ No lunch emails found in database');
      return;
    }
    
    // 2. Check meeting processing results
    console.log('🧠 2. CHECKING MEETING PROCESSING RESULTS:');
    const processingCheck = await pool.query(`
      SELECT mpr.*, e.subject
      FROM meeting_processing_results mpr
      JOIN emails e ON mpr.email_db_id = e.id
      WHERE e.subject ILIKE '%lunch%' OR e.body ILIKE '%lunch%' OR e.body ILIKE '%catch%' OR e.body ILIKE '%2 PM%'
      ORDER BY mpr.processed_at DESC
      LIMIT 5
    `);
    
    if (processingCheck.rows.length > 0) {
      processingCheck.rows.forEach((row, idx) => {
        console.log(`   ${idx + 1}. Processing Result ID: ${row.id}`);
        console.log(`      Email Subject: "${row.subject}"`);
        console.log(`      Is Meeting Request: ${row.is_meeting_request}`);
        console.log(`      Confidence: ${row.confidence}%`);
        console.log(`      Status: ${row.status}`);
        console.log(`      Processing Time: ${row.processing_time_ms}ms`);
        console.log(`      Processed At: ${row.processed_at}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No meeting processing results found for lunch emails');
    }
    
    // 3. Check meeting requests table
    console.log('📅 3. CHECKING MEETING REQUESTS:');
    const meetingCheck = await pool.query(`
      SELECT mr.*, e.subject
      FROM meeting_requests mr
      JOIN emails e ON mr.email_id = e.id
      WHERE e.subject ILIKE '%lunch%' OR e.body ILIKE '%lunch%' OR e.body ILIKE '%catch%' OR e.body ILIKE '%2 PM%'
      ORDER BY mr.created_at DESC
      LIMIT 5
    `);
    
    if (meetingCheck.rows.length > 0) {
      meetingCheck.rows.forEach((row, idx) => {
        console.log(`   ${idx + 1}. Meeting Request ID: ${row.id}`);
        console.log(`      Email Subject: "${row.subject}"`);
        console.log(`      Meeting Type: ${row.meeting_type}`);
        console.log(`      Duration: ${row.requested_duration} minutes`);
        console.log(`      Urgency: ${row.urgency_level}`);
        console.log(`      Status: ${row.status}`);
        console.log(`      Confidence: ${row.detection_confidence}%`);
        console.log(`      Sender: ${row.sender_email}`);
        console.log(`      Created: ${row.created_at}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No meeting requests found for lunch emails');
    }
    
    // 4. Check recent auto drafts
    console.log('📝 4. CHECKING AUTO-GENERATED DRAFTS:');
    const draftCheck = await pool.query(`
      SELECT ad.*, e.subject
      FROM auto_generated_drafts ad
      JOIN emails e ON ad.original_email_id = e.id
      WHERE e.subject ILIKE '%lunch%' OR e.body ILIKE '%lunch%' OR e.body ILIKE '%catch%' OR e.body ILIKE '%2 PM%'
      ORDER BY ad.created_at DESC
      LIMIT 5
    `);
    
    if (draftCheck.rows.length > 0) {
      draftCheck.rows.forEach((row, idx) => {
        console.log(`   ${idx + 1}. Draft ID: ${row.id}`);
        console.log(`      Email Subject: "${row.subject}"`);
        console.log(`      Draft Subject: "${row.draft_subject}"`);
        console.log(`      Generated Text Preview: "${row.generated_text.substring(0, 150)}..."`);
        console.log(`      Status: ${row.status}`);
        console.log(`      Created: ${row.created_at}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No auto-generated drafts found for lunch emails');
    }
    
    // 5. Summary
    console.log('📊 SUMMARY:');
    console.log(`   Emails found: ${emailCheck.rows.length}`);
    console.log(`   Meeting processing results: ${processingCheck.rows.length}`);
    console.log(`   Meeting requests detected: ${meetingCheck.rows.length}`);
    console.log(`   Auto-drafts generated: ${draftCheck.rows.length}`);
    
    if (emailCheck.rows.length > 0) {
      const latestEmail = emailCheck.rows[0];
      if (processingCheck.rows.length > 0) {
        const processingResult = processingCheck.rows[0];
        console.log('\n🎯 PHASE 1 & 2 STATUS:');
        console.log(`   ✅ Email received and stored`);
        console.log(`   ${processingResult.is_meeting_request ? '✅' : '❌'} Meeting detection: ${processingResult.is_meeting_request ? 'DETECTED' : 'NOT DETECTED'}`);
        console.log(`   📊 Confidence: ${processingResult.confidence}%`);
        
        if (meetingCheck.rows.length > 0) {
          console.log(`   ✅ Meeting request saved to database`);
          console.log(`   🎯 Meeting type: ${meetingCheck.rows[0].meeting_type}`);
          console.log(`   ⏰ Duration: ${meetingCheck.rows[0].requested_duration} minutes`);
        }
        
        console.log('\n🤔 NEXT STEPS:');
        if (processingResult.is_meeting_request) {
          console.log('   ✅ Phase 1 & 2 are WORKING!');
          console.log('   🔧 Need to enable automatic response sending');
        } else {
          console.log('   🔍 Meeting detection may need tuning');
          console.log('   📧 Email content might not match meeting patterns');
        }
      } else {
        console.log('\n❌ ISSUE: Email found but not processed by meeting pipeline');
        console.log('   🔧 Meeting pipeline integration may have an issue');
      }
    } else {
      console.log('\n❌ ISSUE: No lunch email found in database');
      console.log('   🔧 Webhook processing might not be working');
    }
    
  } catch (error) {
    console.error('❌ Error checking lunch email:', error);
  } finally {
    await pool.end();
  }
}

checkLunchEmail().catch(console.error);