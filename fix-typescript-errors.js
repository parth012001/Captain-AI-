// Fix TypeScript errors in index.ts
const fs = require('fs');

let content = fs.readFileSync('/Users/parthahir/Desktop/chief/src/index.ts', 'utf8');

// Fix 1: saveEmail returns number, not object with id property
content = content.replace(
  'emailDbId = savedEmail?.id;',
  'emailDbId = savedEmail;'
);

// Fix 2: Type casting for query parameters
content = content.replace(
  'const { status, urgency, meetingType, limit = 20, offset = 0 } = req.query;',
  'const { status, urgency, meetingType, limit = 20, offset = 0 } = req.query;\n    const statusFilter = status as "pending" | "scheduled" | "declined" | "cancelled" | undefined;\n    const urgencyFilter = urgency as "high" | "medium" | "low" | undefined;\n    const meetingTypeFilter = meetingType as "urgent" | "regular" | "flexible" | "recurring" | undefined;\n    const limitNum = parseInt(typeof limit === "string" ? limit : "20");\n    const offsetNum = parseInt(typeof offset === "string" ? offset : "0");'
);

// Fix 3: Use fixed variables in getMeetingRequests call
content = content.replace(
  'const meetings = await meetingPipelineService.getMeetingRequests(userId, {\n      status,\n      urgency,\n      meetingType,\n      limit: parseInt(limit),\n      offset: parseInt(offset)\n    });',
  'const meetings = await meetingPipelineService.getMeetingRequests(userId, {\n      status: statusFilter,\n      urgency: urgencyFilter,\n      meetingType: meetingTypeFilter,\n      limit: limitNum,\n      offset: offsetNum\n    });'
);

// Fix 4: Update pagination object
content = content.replace(
  'limit: parseInt(limit),\n        offset: parseInt(offset),',
  'limit: limitNum,\n        offset: offsetNum,'
);

fs.writeFileSync('/Users/parthahir/Desktop/chief/src/index.ts', content);

console.log('✅ Fixed TypeScript errors in index.ts');