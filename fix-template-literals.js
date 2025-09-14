// Fix template literal syntax errors
const fs = require('fs');

let content = fs.readFileSync('/Users/parthahir/Desktop/chief/test-phase1-meeting-pipeline.js', 'utf8');

// Fix all the template literal issues - replace \`\${ with `${
content = content.replace(/\\`\\\\?\${/g, '`${');
// Fix all the template literal issues - replace }\` with }`
content = content.replace(/}\\`/g, '}`);

// Write back the corrected content
fs.writeFileSync('/Users/parthahir/Desktop/chief/test-phase1-meeting-pipeline.js', content);

console.log('✅ Fixed template literal syntax errors');