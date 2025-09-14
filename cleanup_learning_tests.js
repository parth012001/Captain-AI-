#!/usr/bin/env node

/**
 * LEARNING TEST CLEANUP SCRIPT
 * Removes test files after testing is complete
 */

const fs = require('fs');
const path = require('path');

function cleanupTestFiles() {
  console.log('🧹 Cleaning up learning test files...');
  
  const testFiles = [
    'LEARNING_SYSTEM_TEST.js',
    'run_learning_tests.js',
    'cleanup_learning_tests.js'
  ];
  
  let cleanedCount = 0;
  
  testFiles.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`   ✅ Removed: ${file}`);
        cleanedCount++;
      } else {
        console.log(`   ℹ️  Not found: ${file}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed to remove: ${file} - ${error.message}`);
    }
  });
  
  console.log(`\n🎉 Cleanup complete! Removed ${cleanedCount} test files.`);
  console.log('✅ Learning system testing is complete and cleaned up.');
}

if (require.main === module) {
  cleanupTestFiles();
}

module.exports = cleanupTestFiles;
