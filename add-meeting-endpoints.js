// Add Meeting Pipeline API Endpoints to index.ts
const fs = require('fs');

const meetingEndpoints = `
// Meeting Pipeline API Endpoints
app.get('/meetings', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status, urgency, meetingType, limit = 20, offset = 0 } = req.query;
    
    console.log(\`📋 Fetching meeting requests for user: \${userId.substring(0, 8)}...\`);
    
    const meetings = await meetingPipelineService.getMeetingRequests(userId, {
      status,
      urgency,
      meetingType,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    const stats = await meetingPipelineService.getMeetingStats(userId);
    
    console.log(\`✅ Retrieved \${meetings.length} meeting requests\`);
    
    res.json({
      message: 'Meeting requests fetched successfully',
      meetings,
      stats,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: stats.total
      }
    });
  } catch (error) {
    console.error('❌ Error fetching meeting requests:', error);
    res.status(500).json({ error: 'Failed to fetch meeting requests' });
  }
});

app.get('/meetings/stats', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    
    const stats = await meetingPipelineService.getMeetingStats(userId);
    
    res.json({
      message: 'Meeting statistics fetched successfully',
      stats
    });
  } catch (error) {
    console.error('❌ Error fetching meeting stats:', error);
    res.status(500).json({ error: 'Failed to fetch meeting statistics' });
  }
});

app.get('/meetings/pipeline/health', authMiddleware.authenticate, async (req, res) => {
  try {
    const health = await meetingPipelineService.healthCheck();
    
    res.json({
      message: 'Meeting pipeline health check',
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error checking meeting pipeline health:', error);
    res.status(500).json({ error: 'Meeting pipeline health check failed' });
  }
});

app.post('/meetings/:id/status', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    const meetingId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!['pending', 'scheduled', 'declined', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: pending, scheduled, declined, or cancelled' });
    }
    
    console.log(\`📝 Updating meeting \${meetingId} status to: \${status}\`);
    
    // Update meeting status in database
    const result = await pool.query(
      'UPDATE meeting_requests SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [status, meetingId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting request not found' });
    }
    
    console.log(\`✅ Meeting status updated successfully\`);
    
    res.json({
      message: 'Meeting status updated successfully',
      meeting: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error updating meeting status:', error);
    res.status(500).json({ error: 'Failed to update meeting status' });
  }
});

`;

// Read the current index.ts file
let indexContent = fs.readFileSync('/Users/parthahir/Desktop/chief/src/index.ts', 'utf8');

// Find a good place to insert the meeting endpoints (after existing email routes)
const insertPoint = indexContent.indexOf('app.get(\'/promotional-emails\'');

if (insertPoint === -1) {
  console.error('❌ Could not find insertion point in index.ts');
  process.exit(1);
}

// Insert the meeting endpoints
const beforeInsert = indexContent.substring(0, insertPoint);
const afterInsert = indexContent.substring(insertPoint);

const newContent = beforeInsert + meetingEndpoints + '\n' + afterInsert;

// Write the updated content
fs.writeFileSync('/Users/parthahir/Desktop/chief/src/index.ts', newContent);

console.log('✅ Meeting API endpoints added to index.ts');
console.log('📋 Added endpoints:');
console.log('   - GET  /meetings                  - List meeting requests');
console.log('   - GET  /meetings/stats           - Meeting statistics');
console.log('   - GET  /meetings/pipeline/health - Pipeline health check');
console.log('   - POST /meetings/:id/status      - Update meeting status');