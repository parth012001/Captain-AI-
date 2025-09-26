/*
SAFE PARALLEL EMAIL PROCESSING IMPLEMENTATION
Replace the sequential for loop with this parallel version
*/

// NEW: Extract email processing into separate function for reusability
async function processEmailSafe(emailData, userId, gmailService, emailModel, intelligentEmailRouter, shouldGenerateResponseForEmail) {
  const processingStartTime = Date.now();

  try {
    // Parse email content
    const parsedEmail = gmailService.parseEmail(emailData);
    console.log(`📧 [PARALLEL] Processing: "${parsedEmail.subject}" from ${parsedEmail.from}`);

    // Step 3: Smart email filtering
    const shouldGenerateResponse = await shouldGenerateResponseForEmail(parsedEmail, userId);
    if (!shouldGenerateResponse.generate) {
      console.log(`⏭️ [PARALLEL] Skipping email: ${shouldGenerateResponse.reason}`);

      // Atomically save email and mark as webhook processed FOR THIS USER (even though no draft was generated)
      const result = await emailModel.saveEmailAndMarkAsWebhookProcessedForUser(parsedEmail, userId);
      if (result.success) {
        console.log(`🏷️ [PARALLEL] Email ID ${result.emailId} marked as webhook_processed = true for user (filtered out)`);
      } else {
        console.log(`⏭️ [PARALLEL] Email already processed by webhook for this user, skipping (filtered out)`);
      }
      return { status: 'skipped', emailId: parsedEmail.id, reason: shouldGenerateResponse.reason };
    }

    console.log(`✅ [PARALLEL] Email qualifies for response generation: ${shouldGenerateResponse.reason}`);

    // Step 4: Atomically save email and mark as webhook processed FOR THIS USER
    const result = await emailModel.saveEmailAndMarkAsWebhookProcessedForUser(parsedEmail, userId);
    if (!result.success) {
      console.log(`⏭️ [PARALLEL] Email already processed by webhook for this user, skipping draft generation`);
      return { status: 'duplicate', emailId: parsedEmail.id };
    }

    const emailId = result.emailId;

    // 🚀 PHASE 3: Process email through intelligent router (replaces dual processing)
    console.log(`🧠 [PARALLEL] Routing email ${parsedEmail.id} through intelligent router...`);
    const routingResult = await intelligentEmailRouter.routeEmail(
      parsedEmail,
      userId,
      emailId // Use the email DB ID we already have
    );

    console.log(`✅ [PARALLEL] Email routed to ${routingResult.routingDecision.route.toUpperCase()} pipeline`);
    console.log(`🎯 [PARALLEL] Routing reasoning: ${routingResult.routingDecision.reasoning}`);

    if (routingResult.meetingResult?.isMeetingRequest) {
      console.log(`📅 [PARALLEL] Meeting detected! Type: ${routingResult.meetingResult.meetingRequest?.meetingType}, Confidence: ${routingResult.meetingResult.confidence}%`);
      if (routingResult.meetingResult.response) {
        console.log(`🤖 [PARALLEL] Meeting response generated: ${routingResult.meetingResult.response.actionTaken}`);
      }
    } else if (routingResult.autoDraftResult) {
      console.log(`📝 [PARALLEL] Auto-draft generated: "${routingResult.autoDraftResult.subject}"`);
      console.log(`🎯 [PARALLEL] Tone: ${routingResult.autoDraftResult.tone}, Urgency: ${routingResult.autoDraftResult.urgencyLevel}`);
    } else if (routingResult.routingDecision.route === 'skip') {
      console.log(`⏭️ [PARALLEL] Email skipped: ${routingResult.routingDecision.reasoning}`);
    }

    const totalProcessingTime = Date.now() - processingStartTime;
    console.log(`⚡ [PARALLEL] Email processing time: ${totalProcessingTime}ms`);

    // Email is already marked as webhook_processed by the atomic operation above
    console.log(`🏷️ [PARALLEL] Email ID ${emailId} already marked as webhook_processed = true`);

    return {
      status: 'success',
      emailId: parsedEmail.id,
      routingResult,
      processingTime: totalProcessingTime
    };

  } catch (emailError) {
    console.error(`❌ [PARALLEL] Error processing email:`, emailError);
    return {
      status: 'error',
      emailId: emailData.id || 'unknown',
      error: emailError.message,
      processingTime: Date.now() - processingStartTime
    };
  }
}

// REPLACE THE SEQUENTIAL FOR LOOP WITH THIS:
async function processEmailsInParallel(emailsToProcess, userId, concurrencyLimit = 3) {
  console.log(`📬 [PARALLEL] Processing ${emailsToProcess.length} emails with concurrency limit: ${concurrencyLimit}`);

  if (emailsToProcess.length === 0) {
    return [];
  }

  // Process emails in parallel with concurrency limit to avoid overwhelming APIs
  const processWithConcurrencyLimit = async (emails) => {
    const results = [];

    for (let i = 0; i < emails.length; i += concurrencyLimit) {
      const batch = emails.slice(i, i + concurrencyLimit);
      console.log(`🔄 [PARALLEL] Processing batch ${Math.floor(i / concurrencyLimit) + 1}: ${batch.length} emails`);

      const batchPromises = batch.map(emailData =>
        processEmailSafe(emailData, userId, gmailService, emailModel, intelligentEmailRouter, shouldGenerateResponseForEmail)
      );

      // Use allSettled to ensure one failure doesn't stop others
      const batchResults = await Promise.allSettled(batchPromises);

      // Extract successful results and log failures
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`❌ [PARALLEL] Batch email ${i + index} failed:`, result.reason);
          results.push({
            status: 'error',
            emailId: batch[index]?.id || 'unknown',
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      // Small delay between batches to be gentle on APIs
      if (i + concurrencyLimit < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  };

  const results = await processWithConcurrencyLimit(emailsToProcess);

  // Log summary
  const successful = results.filter(r => r.status === 'success').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const duplicates = results.filter(r => r.status === 'duplicate').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log(`📊 [PARALLEL] Processing Summary:`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   🔄 Duplicates: ${duplicates}`);
  console.log(`   ❌ Errors: ${errors}`);

  return results;
}

/*
USAGE: Replace this code in src/index.ts around line 2150:

// OLD CODE:
for (const emailData of emailsToProcess) {
  // ... all the email processing logic ...
}

// NEW CODE:
const processingResults = await processEmailsInParallel(emailsToProcess, userId, 3);
*/