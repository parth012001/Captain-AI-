# API Migration Guide: Legacy to V2 Routes

This document provides a complete mapping from legacy API routes to the new organized V2 API structure.

## Overview

The Chief AI Email Assistant API has been refactored into a clean, organized structure with versioned endpoints under `/api/v2/`. All functionality remains identical, but routes are now logically grouped and follow RESTful conventions.

## Base URL Structure

- **Legacy routes:** `http://localhost:3000/route-name`
- **New V2 routes:** `http://localhost:3000/api/v2/category/route-name`

## Complete Route Mappings

### 🔐 Authentication Routes (Unchanged)
These routes remain the same - no migration needed:
- `GET /auth` - Start OAuth flow
- `GET /auth/signup` - OAuth signup
- `GET /auth/signin` - OAuth signin
- `GET /auth/callback` - OAuth callback
- `POST /auth/set-tokens` - Set OAuth tokens

### ✅ System Health Routes (Unchanged)
- `GET /health` - Basic health check

---

## 📧 Email Management Routes

| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `GET /emails/fetch` | `GET /api/v2/emails/fetch` | Fetch emails from Gmail |
| `GET /emails` | `GET /api/v2/emails` | View stored emails |
| `GET /promotional-emails` | `GET /api/v2/emails/promotional` | Get promotional emails |
| `POST /promotional-emails/:id/mark-read` | `POST /api/v2/emails/promotional/:id/mark-read` | Mark promotional email as read |
| `DELETE /promotional-emails/:id` | `DELETE /api/v2/emails/promotional/:id` | Delete promotional email |
| `GET /promotional-emails/stats` | `GET /api/v2/emails/promotional/stats` | Get promotional email stats |

## 📝 Draft Management Routes

| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `GET /drafts` | `GET /api/v2/drafts` | View generated drafts |
| `GET /drafts/:id` | `GET /api/v2/drafts/:id` | View specific draft |
| `GET /auto-drafts` | `GET /api/v2/auto-drafts` | List auto-generated drafts |
| `GET /auto-drafts/:id` | `GET /api/v2/auto-drafts/:id` | Get specific auto-draft |
| `PUT /auto-drafts/:id` | `PUT /api/v2/auto-drafts/:id` | Edit draft content |
| `POST /auto-drafts/:id/send` | `POST /api/v2/auto-drafts/:id/send` | Send draft as email |
| `DELETE /auto-drafts/:id` | `DELETE /api/v2/auto-drafts/:id` | Delete draft |
| `POST /auto-drafts/:id/approve` | `POST /api/v2/auto-drafts/:id/approve` | Approve draft |

## 🤖 AI Analysis & Intelligence Routes

| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `POST /ai/analyze-tone-real` | `POST /api/v2/ai/analyze-tone-real` | Analyze tone from real emails |
| `POST /ai/analyze-tone` | `POST /api/v2/ai/analyze-tone` | Analyze tone (mock) |
| `GET /tone-profiles` | `GET /api/v2/ai/tone-profiles` | View tone profiles |
| `GET /tone-profiles/:id` | `GET /api/v2/ai/tone-profiles/:id` | View specific tone profile |
| `POST /ai/refresh-tone` | `POST /api/v2/ai/refresh-tone` | Refresh tone analysis |
| `POST /ai/categorize-emails` | `POST /api/v2/ai/categorize-emails` | Categorize emails |
| `POST /ai/generate-drafts` | `POST /api/v2/ai/generate-drafts` | Generate AI drafts |
| `POST /ai/generate-drafts-with-context` | `POST /api/v2/ai/generate-drafts-with-context` | Generate context-aware drafts |

### Context Intelligence Routes (New Organization)
| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `POST /context/analyze-emails` | `POST /api/v2/ai/context/analyze-emails` | Run context analysis |
| `GET /context/stats` | `GET /api/v2/ai/context/stats` | Context statistics |
| `GET /context/threads` | `GET /api/v2/ai/context/threads` | Thread analytics |
| `GET /context/senders` | `GET /api/v2/ai/context/senders` | Sender insights |
| `GET /context/entities` | `GET /api/v2/ai/context/entities` | Entity extraction insights |
| `GET /context/thread/:threadId` | `GET /api/v2/ai/context/thread/:threadId` | Full thread context |
| `GET /context/health` | `GET /api/v2/ai/context/health` | Context system health |

### Response Generation Routes (New Organization)
| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `POST /response/generate-smart` | `POST /api/v2/ai/response/generate-smart` | Generate intelligent responses |
| `GET /response/templates` | `GET /api/v2/ai/response/templates` | Get response templates |
| `GET /response/stats` | `GET /api/v2/ai/response/stats` | Response statistics |
| `POST /response/feedback` | `POST /api/v2/ai/response/feedback` | Record response feedback |
| `GET /response/recent` | `GET /api/v2/ai/response/recent` | Get recent responses |

## 📅 Calendar Integration Routes

| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `POST /calendar/set-tokens` | `POST /api/v2/calendar/set-tokens` | Set calendar OAuth tokens |
| `GET /calendar/events` | `GET /api/v2/calendar/events` | Get calendar events |
| `POST /calendar/check-availability` | `POST /api/v2/calendar/check-availability` | Check availability |
| `POST /calendar/suggest-times` | `POST /api/v2/calendar/suggest-times` | Suggest time slots |
| `POST /calendar/create-event` | `POST /api/v2/calendar/create-event` | Create calendar event |
| `GET /calendar/preferences` | `GET /api/v2/calendar/preferences` | Get calendar preferences |
| `POST /calendar/preferences` | `POST /api/v2/calendar/preferences` | Update preferences |
| `GET /calendar/stats` | `GET /api/v2/calendar/stats` | Calendar statistics |
| `GET /calendar/health` | `GET /api/v2/calendar/health` | Calendar system health |

## 🤝 Meeting Management Routes

| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `GET /meetings` | `GET /api/v2/meetings` | Get meetings |
| `GET /meetings/stats` | `GET /api/v2/meetings/stats` | Meeting statistics |
| `GET /meetings/pipeline/health` | `GET /api/v2/meetings/pipeline/health` | Pipeline health |
| `POST /meetings/:id/status` | `POST /api/v2/meetings/:id/status` | Update meeting status |
| `POST /meetings/detect` | `POST /api/v2/meetings/detect` | Detect meeting requests |
| `POST /meetings/scan-emails` | `POST /api/v2/meetings/scan-emails` | Scan emails for meetings |
| `GET /meetings/requests` | `GET /api/v2/meetings/requests` | Get meeting requests |
| `PATCH /meetings/requests/:id` | `PATCH /api/v2/meetings/requests/:id` | Update meeting request |
| `GET /meetings/health` | `GET /api/v2/meetings/health` | Meeting system health |

### Meeting Confirmation Routes (New Organization)
| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `GET /meetings/confirmations` | `GET /api/v2/meetings/confirmations` | Get meeting confirmations |
| `POST /meetings/confirmations/:id/confirm` | `POST /api/v2/meetings/confirmations/:id/confirm` | Confirm meeting |
| `POST /meetings/confirmations/:id/cancel` | `POST /api/v2/meetings/confirmations/:id/cancel` | Cancel meeting |
| `GET /meetings/confirmations/:id/suggestions` | `GET /api/v2/meetings/confirmations/:id/suggestions` | Get time suggestions |

### Auto-Scheduling Routes (New Organization)
| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `POST /auto-scheduling/process-meeting` | `POST /api/v2/meetings/auto-scheduling/process-meeting` | Process meeting for scheduling |
| `POST /auto-scheduling/suggest-times` | `POST /api/v2/meetings/auto-scheduling/suggest-times` | Suggest optimal times |
| `POST /auto-scheduling/create-hold` | `POST /api/v2/meetings/auto-scheduling/create-hold` | Create calendar hold |
| `POST /auto-scheduling/confirm` | `POST /api/v2/meetings/auto-scheduling/confirm` | Confirm scheduled meeting |
| `GET /auto-scheduling/workflows` | `GET /api/v2/meetings/auto-scheduling/workflows` | Get scheduling workflows |
| `GET /auto-scheduling/holds` | `GET /api/v2/meetings/auto-scheduling/holds` | Get calendar holds |
| `POST /auto-scheduling/cleanup-holds` | `POST /api/v2/meetings/auto-scheduling/cleanup-holds` | Cleanup expired holds |
| `GET /auto-scheduling/health` | `GET /api/v2/meetings/auto-scheduling/health` | Auto-scheduling health |

## 🎓 Learning System Routes

| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `POST /learning/analyze-edit` | `POST /api/v2/learning/analyze-edit` | Analyze user edits |
| `GET /learning/success-metrics` | `GET /api/v2/learning/success-metrics` | Get success metrics |
| `GET /learning/insights` | `GET /api/v2/learning/insights` | Get learning insights |
| `GET /learning/performance-trend` | `GET /api/v2/learning/performance-trend` | Get performance trends |
| `POST /learning/weekly-analysis` | `POST /api/v2/learning/weekly-analysis` | Run weekly analysis |

## 📡 Webhook Management Routes

| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `GET /webhook-status` | `GET /api/v2/webhooks/status` | Check webhook status |
| `POST /webhook-renewal/manual` | `POST /api/v2/webhooks/renewal/manual` | Manual webhook renewal |
| `POST /test/webhook-suite` | `POST /api/v2/webhooks/test/suite` | Run webhook test suite |
| `GET /test/webhook-health` | `GET /api/v2/webhooks/test/health` | Webhook health check |
| `POST /webhooks/gmail` | `POST /api/v2/webhooks/gmail` | Gmail webhook endpoint |
| `POST /test-webhook` | `POST /api/v2/webhooks/test` | Manual webhook test |
| `POST /gmail/setup-webhook-all-users` | `POST /api/v2/webhooks/gmail/setup-webhook-all-users` | Setup webhooks for all users |
| `POST /gmail/setup-webhook` | `POST /api/v2/webhooks/gmail/setup-webhook` | Setup webhook for user |
| `GET /gmail/webhook-status` | `GET /api/v2/webhooks/gmail/webhook-status` | Gmail webhook status |
| `POST /gmail/stop-webhook` | `POST /api/v2/webhooks/gmail/stop-webhook` | Stop Gmail webhook |

## 🔧 Admin & System Routes

| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `POST /health/clear-failures` | `POST /api/v2/admin/health/clear-failures` | Clear system failures |
| `POST /admin/reset-context-schema` | `POST /api/v2/admin/schema/reset-context` | Reset context schema |
| `POST /admin/apply-phase23-schema` | `POST /api/v2/admin/schema/apply-phase23` | Apply phase 2.3 schema |
| `POST /admin/fix-context-column` | `POST /api/v2/admin/schema/fix-context-column` | Fix context column |
| `POST /admin/apply-phase2-2-schema` | `POST /api/v2/admin/schema/apply-phase2-2` | Apply phase 2.2 schema |
| `POST /admin/apply-phase3-calendar-schema` | `POST /api/v2/admin/schema/apply-phase3-calendar` | Apply calendar schema |
| `POST /admin/add-webhook-processed-flag` | `POST /api/v2/admin/schema/add-webhook-processed-flag` | Add webhook flag |

## 🔍 Debug & Testing Routes

| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `GET /debug/email/:emailId` | `GET /api/v2/debug/email/:emailId` | Inspect specific email |
| `POST /debug/init-phase33-schema` | `POST /api/v2/debug/init-phase33-schema` | Initialize schema |
| `GET /debug/draft-database/:id` | `GET /api/v2/debug/draft-database/:id` | Inspect draft in database |
| `POST /test-intelligent-router` | `POST /api/v2/debug/test-intelligent-router` | Test intelligent routing |

### Health & Testing Routes (New Organization)
| Legacy Route | New V2 Route | Description |
|-------------|-------------|-------------|
| `GET /health/email-parsing` | `GET /api/v2/misc/health/email-parsing` | Email parsing health |
| `GET /health/intelligent-router` | `GET /api/v2/misc/health/intelligent-router` | Router health check |
| `POST /test-smart-filtering` | `POST /api/v2/misc/test-smart-filtering` | Test smart filtering |
| `POST /test-create-draft` | `POST /api/v2/misc/test-create-draft` | Test draft creation |

---

## Migration Strategy

### Phase 1: Parallel Operation (Current)
Both legacy and V2 routes are available:
- Legacy routes: Continue working as before
- V2 routes: Available for new implementations

### Phase 2: Client Migration (Recommended)
Update your client applications to use V2 routes:
1. **Replace base URLs** in your API calls
2. **Update route paths** according to the mapping table above
3. **Test functionality** to ensure same behavior
4. **No authentication changes** needed - same auth flow

### Phase 3: Legacy Route Removal (Future)
Once all clients migrate, legacy routes will be removed.

## Example Migration

### Before (Legacy)
```javascript
// Legacy API calls
fetch('/emails/fetch')
fetch('/ai/analyze-tone-real', { method: 'POST' })
fetch('/meetings/requests')
fetch('/webhook-status')
```

### After (V2)
```javascript
// V2 API calls - same functionality, organized structure
fetch('/api/v2/emails/fetch')
fetch('/api/v2/ai/analyze-tone-real', { method: 'POST' })
fetch('/api/v2/meetings/requests')
fetch('/api/v2/webhooks/status')
```

## Benefits of V2 API Structure

1. **Logical Organization:** Routes grouped by functionality
2. **Versioning:** Future API changes won't break existing clients
3. **Discoverability:** Clear hierarchy makes API exploration easier
4. **Scalability:** Clean structure supports future feature additions
5. **RESTful Design:** Follows modern API design principles

## Support

If you encounter issues during migration:
1. Check that request methods (GET, POST, etc.) remain the same
2. Verify authentication headers are included for protected routes
3. Ensure request/response formats haven't changed (they should be identical)
4. Test with both legacy and V2 routes to compare responses

The migration preserves 100% backward compatibility - only the URLs change, not the functionality.