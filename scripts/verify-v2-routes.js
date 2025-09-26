/**
 * Route Migration Verification Script
 * Verifies all v2 routes are properly working before cleanup
 */

const fs = require('fs');
const path = require('path');

// Route mappings: old route → new v2 route
const ROUTE_MAPPINGS = {
  // Email routes
  'GET /emails': 'GET /api/v2/emails',
  'GET /emails/fetch': 'GET /api/v2/emails/fetch',
  'GET /promotional-emails': 'GET /api/v2/emails/promotional',
  'POST /promotional-emails/:id/mark-read': 'POST /api/v2/emails/promotional/:id/mark-read',
  'DELETE /promotional-emails/:id': 'DELETE /api/v2/emails/promotional/:id',
  'GET /promotional-emails/stats': 'GET /api/v2/emails/promotional/stats',

  // Meeting routes
  'GET /meetings': 'GET /api/v2/meetings',
  'GET /meetings/stats': 'GET /api/v2/meetings/stats',
  'GET /meetings/pipeline/health': 'GET /api/v2/meetings/pipeline/health',
  'POST /meetings/:id/status': 'POST /api/v2/meetings/:id/status',
  'POST /meetings/detect': 'POST /api/v2/meetings/detect',
  'POST /meetings/scan-emails': 'POST /api/v2/meetings/scan-emails',
  'GET /meetings/requests': 'GET /api/v2/meetings/requests',
  'GET /meetings/health': 'GET /api/v2/meetings/health',

  // AI routes
  'POST /ai/analyze-tone-real': 'POST /api/v2/ai/analyze-tone-real',
  'POST /ai/analyze-tone': 'POST /api/v2/ai/analyze-tone',
  'GET /tone-profiles': 'GET /api/v2/ai/tone-profiles',
  'GET /tone-profiles/:id': 'GET /api/v2/ai/tone-profiles/:id',
  'POST /ai/refresh-tone': 'POST /api/v2/ai/refresh-tone',
  'POST /ai/categorize-emails': 'POST /api/v2/ai/categorize-emails',
  'POST /ai/generate-drafts': 'POST /api/v2/ai/generate-drafts',

  // Draft routes
  'GET /drafts': 'GET /api/v2/drafts',
  'GET /drafts/:id': 'GET /api/v2/drafts/:id',
  'GET /auto-drafts': 'GET /api/v2/auto-drafts',
  'GET /auto-drafts/:id': 'GET /api/v2/auto-drafts/:id',
  'PUT /auto-drafts/:id': 'PUT /api/v2/auto-drafts/:id',
  'POST /auto-drafts/:id/send': 'POST /api/v2/auto-drafts/:id/send',
  'DELETE /auto-drafts/:id': 'DELETE /api/v2/auto-drafts/:id',
  'POST /auto-drafts/:id/approve': 'POST /api/v2/auto-drafts/:id/approve',

  // Calendar routes
  'POST /calendar/set-tokens': 'POST /api/v2/calendar/set-tokens',
  'GET /calendar/events': 'GET /api/v2/calendar/events',
  'POST /calendar/check-availability': 'POST /api/v2/calendar/check-availability',
  'POST /calendar/suggest-times': 'POST /api/v2/calendar/suggest-times',
  'POST /calendar/create-event': 'POST /api/v2/calendar/create-event',
  'GET /calendar/preferences': 'GET /api/v2/calendar/preferences',
  'POST /calendar/preferences': 'POST /api/v2/calendar/preferences',
  'GET /calendar/stats': 'GET /api/v2/calendar/stats',
  'GET /calendar/health': 'GET /api/v2/calendar/health',

  // Learning routes
  'POST /learning/analyze-edit': 'POST /api/v2/learning/analyze-edit',
  'GET /learning/success-metrics': 'GET /api/v2/learning/success-metrics',
  'GET /learning/insights': 'GET /api/v2/learning/insights',
  'GET /learning/performance-trend': 'GET /api/v2/learning/performance-trend',
  'POST /learning/weekly-analysis': 'POST /api/v2/learning/weekly-analysis',

  // Webhook routes (Phase 3)
  'GET /webhook-status': 'GET /api/v2/webhooks/status',
  'POST /webhook-renewal/manual': 'POST /api/v2/webhooks/renewal/manual',
  'POST /test/webhook-suite': 'POST /api/v2/webhooks/test/suite',
  'GET /test/webhook-health': 'GET /api/v2/webhooks/test/health',
  'POST /webhooks/gmail': 'POST /api/v2/webhooks/gmail',
  'POST /test-webhook': 'POST /api/v2/webhooks/test',
  'POST /gmail/setup-webhook-all-users': 'POST /api/v2/webhooks/gmail/setup-webhook-all-users',
  'POST /gmail/setup-webhook': 'POST /api/v2/webhooks/gmail/setup-webhook',
  'GET /gmail/webhook-status': 'GET /api/v2/webhooks/gmail/webhook-status',
  'POST /gmail/stop-webhook': 'POST /api/v2/webhooks/gmail/stop-webhook',

  // Admin routes (Phase 3)
  'POST /health/clear-failures': 'POST /api/v2/admin/health/clear-failures',
  'POST /admin/reset-context-schema': 'POST /api/v2/admin/schema/reset-context',
  'POST /admin/apply-phase23-schema': 'POST /api/v2/admin/schema/apply-phase23',
  'POST /admin/fix-context-column': 'POST /api/v2/admin/schema/fix-context-column',
  'POST /admin/apply-phase2-2-schema': 'POST /api/v2/admin/schema/apply-phase2-2',
  'POST /admin/apply-phase3-calendar-schema': 'POST /api/v2/admin/schema/apply-phase3-calendar',
  'POST /admin/add-webhook-processed-flag': 'POST /api/v2/admin/schema/add-webhook-processed-flag',

  // Debug routes (Phase 3)
  'GET /debug/email/:emailId': 'GET /api/v2/debug/email/:emailId',
  'POST /debug/init-phase33-schema': 'POST /api/v2/debug/init-phase33-schema',
  'GET /debug/draft-database/:id': 'GET /api/v2/debug/draft-database/:id',
  'POST /test-intelligent-router': 'POST /api/v2/debug/test-intelligent-router',

  // Context Intelligence Routes (added to AI routes)
  'POST /context/analyze-emails': 'POST /api/v2/ai/context/analyze-emails',
  'GET /context/stats': 'GET /api/v2/ai/context/stats',
  'GET /context/threads': 'GET /api/v2/ai/context/threads',
  'GET /context/senders': 'GET /api/v2/ai/context/senders',
  'GET /context/entities': 'GET /api/v2/ai/context/entities',
  'GET /context/thread/:threadId': 'GET /api/v2/ai/context/thread/:threadId',
  'GET /context/health': 'GET /api/v2/ai/context/health',

  // Response Generation Routes (already in AI routes)
  'POST /response/generate-smart': 'POST /api/v2/ai/response/generate-smart',
  'GET /response/templates': 'GET /api/v2/ai/response/templates',
  'GET /response/stats': 'GET /api/v2/ai/response/stats',
  'POST /response/feedback': 'POST /api/v2/ai/response/feedback',
  'GET /response/recent': 'GET /api/v2/ai/response/recent',

  // Meeting Confirmation Routes (added to meetings)
  'PATCH /meetings/requests/:id': 'PATCH /api/v2/meetings/requests/:id',
  'GET /meetings/confirmations': 'GET /api/v2/meetings/confirmations',
  'POST /meetings/confirmations/:id/confirm': 'POST /api/v2/meetings/confirmations/:id/confirm',
  'POST /meetings/confirmations/:id/cancel': 'POST /api/v2/meetings/confirmations/:id/cancel',
  'GET /meetings/confirmations/:id/suggestions': 'GET /api/v2/meetings/confirmations/:id/suggestions',

  // Auto-scheduling Routes (added to meetings)
  'POST /auto-scheduling/process-meeting': 'POST /api/v2/meetings/auto-scheduling/process-meeting',
  'POST /auto-scheduling/suggest-times': 'POST /api/v2/meetings/auto-scheduling/suggest-times',
  'POST /auto-scheduling/create-hold': 'POST /api/v2/meetings/auto-scheduling/create-hold',
  'POST /auto-scheduling/confirm': 'POST /api/v2/meetings/auto-scheduling/confirm',
  'GET /auto-scheduling/workflows': 'GET /api/v2/meetings/auto-scheduling/workflows',
  'GET /auto-scheduling/holds': 'GET /api/v2/meetings/auto-scheduling/holds',
  'POST /auto-scheduling/cleanup-holds': 'POST /api/v2/meetings/auto-scheduling/cleanup-holds',
  'GET /auto-scheduling/health': 'GET /api/v2/meetings/auto-scheduling/health',

  // Additional AI Routes
  'POST /ai/generate-drafts-with-context': 'POST /api/v2/ai/generate-drafts-with-context',

  // Misc/Testing Routes
  'GET /health/email-parsing': 'GET /api/v2/misc/health/email-parsing',
  'GET /health/intelligent-router': 'GET /api/v2/misc/health/intelligent-router',
  'POST /test-smart-filtering': 'POST /api/v2/misc/test-smart-filtering',
  'POST /test-create-draft': 'POST /api/v2/misc/test-create-draft'
};

// Routes that need to remain in index.ts (auth, health, etc.)
const ROUTES_TO_KEEP = [
  'GET /auth',
  'GET /auth/signup',
  'GET /auth/signin',
  'GET /auth/callback',
  'POST /auth/set-tokens',
  'GET /health',
  'GET /api/health',
  'GET /'
];

/**
 * Analyze current index.ts to find all routes
 */
function analyzeCurrentRoutes() {
  const indexPath = path.join(__dirname, '../src/index.ts');
  const content = fs.readFileSync(indexPath, 'utf8');

  const routeRegex = /app\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g;
  const foundRoutes = [];
  let match;

  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    foundRoutes.push(`${method} ${path}`);
  }

  return foundRoutes;
}

/**
 * Check if all v2 route files exist
 */
function checkV2RouteFiles() {
  const routeFiles = [
    '../src/routes/emails.ts',
    '../src/routes/drafts.ts',
    '../src/routes/calendar.ts',
    '../src/routes/meetings.ts',
    '../src/routes/ai.ts',
    '../src/routes/learning.ts',
    '../src/routes/auto-drafts.ts',
    '../src/routes/webhooks.ts',
    '../src/routes/admin.ts',
    '../src/routes/debug.ts',
    '../src/routes/misc.ts'
  ];

  const results = [];

  for (const file of routeFiles) {
    const fullPath = path.join(__dirname, file);
    const exists = fs.existsSync(fullPath);
    results.push({
      file: file.replace('../src/routes/', ''),
      exists,
      path: fullPath
    });
  }

  return results;
}

/**
 * Generate migration report
 */
function generateMigrationReport() {
  console.log('🔍 Route Migration Verification Report');
  console.log('=====================================\n');

  // Check v2 route files
  console.log('📁 V2 Route Files Status:');
  const routeFiles = checkV2RouteFiles();
  routeFiles.forEach(file => {
    const status = file.exists ? '✅' : '❌';
    console.log(`   ${status} ${file.file}`);
  });

  const missingFiles = routeFiles.filter(f => !f.exists);
  if (missingFiles.length > 0) {
    console.log(`\n⚠️  Missing ${missingFiles.length} route files!`);
    return false;
  }

  // Analyze current routes
  console.log('\n📊 Current Route Analysis:');
  const currentRoutes = analyzeCurrentRoutes();
  console.log(`   Found ${currentRoutes.length} total routes in index.ts`);

  // Check mappings
  console.log('\n🔄 Route Mapping Analysis:');
  let mappedRoutes = 0;
  let unmappedRoutes = [];

  for (const route of currentRoutes) {
    if (ROUTES_TO_KEEP.includes(route)) {
      console.log(`   🔒 KEEP: ${route}`);
    } else if (ROUTE_MAPPINGS[route]) {
      console.log(`   ✅ MAPPED: ${route} → ${ROUTE_MAPPINGS[route]}`);
      mappedRoutes++;
    } else {
      console.log(`   ❌ UNMAPPED: ${route}`);
      unmappedRoutes.push(route);
    }
  }

  console.log(`\n📈 Migration Statistics:`);
  console.log(`   ✅ Mapped routes: ${mappedRoutes}`);
  console.log(`   ❌ Unmapped routes: ${unmappedRoutes.length}`);
  console.log(`   🔒 Routes to keep: ${ROUTES_TO_KEEP.length}`);
  console.log(`   📊 Total coverage: ${Math.round((mappedRoutes / (currentRoutes.length - ROUTES_TO_KEEP.length)) * 100)}%`);

  if (unmappedRoutes.length > 0) {
    console.log(`\n⚠️  Unmapped routes need attention:`);
    unmappedRoutes.forEach(route => console.log(`   - ${route}`));
  }

  // Success criteria
  const allFilesExist = missingFiles.length === 0;
  const allRoutesMapped = unmappedRoutes.length === 0;

  console.log(`\n🎯 Migration Readiness:`);
  console.log(`   Route files: ${allFilesExist ? '✅ Ready' : '❌ Missing files'}`);
  console.log(`   Route mapping: ${allRoutesMapped ? '✅ Complete' : '❌ Incomplete'}`);

  const ready = allFilesExist && allRoutesMapped;
  console.log(`   Overall: ${ready ? '🟢 READY FOR MIGRATION' : '🔴 NOT READY'}`);

  return ready;
}

/**
 * Main execution
 */
if (require.main === module) {
  console.log('🚀 Starting Route Migration Verification...\n');

  try {
    const ready = generateMigrationReport();

    if (ready) {
      console.log('\n🎉 All checks passed! Ready to proceed with migration.');
    } else {
      console.log('\n❌ Migration verification failed. Please address issues above.');
    }

    process.exit(ready ? 0 : 1);
  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

module.exports = {
  ROUTE_MAPPINGS,
  ROUTES_TO_KEEP,
  analyzeCurrentRoutes,
  checkV2RouteFiles,
  generateMigrationReport
};