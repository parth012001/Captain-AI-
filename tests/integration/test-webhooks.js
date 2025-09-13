#!/usr/bin/env node

/**
 * Simple webhook testing script
 * Run: node test-webhooks.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Webhook Testing Script...\n');
  
  // Test 1: Health Check
  console.log('1️⃣ Running quick health check...');
  try {
    const health = await makeRequest('GET', '/test/webhook-health');
    
    if (health.status === 200) {
      console.log(`   ✅ Health Check: ${health.data.status}`);
      if (!health.data.healthy) {
        console.log('   ⚠️ Issues found:');
        health.data.issues.forEach(issue => console.log(`     - ${issue}`));
      }
    } else {
      console.log(`   ❌ Health Check Failed (${health.status})`);
    }
  } catch (error) {
    console.log(`   ❌ Health Check Error: ${error.message}`);
  }

  console.log('');

  // Test 2: Webhook Status
  console.log('2️⃣ Checking webhook status...');
  try {
    const status = await makeRequest('GET', '/webhook-status');
    
    if (status.status === 200) {
      console.log(`   ✅ Found ${status.data.totalActive} active webhooks`);
      console.log(`   📊 ${status.data.needingRenewal} webhook(s) need renewal`);
      
      if (status.data.webhooks.length > 0) {
        console.log('   📋 Active users:');
        status.data.webhooks.forEach(webhook => {
          const expiresIn = webhook.timeUntilExpiration 
            ? Math.round(webhook.timeUntilExpiration / (1000 * 60 * 60 * 24)) 
            : 'unknown';
          console.log(`     - ${webhook.gmailAddress}: expires in ${expiresIn} days`);
        });
      }
    } else {
      console.log(`   ❌ Status Check Failed (${status.status})`);
    }
  } catch (error) {
    console.log(`   ❌ Status Check Error: ${error.message}`);
  }

  console.log('');

  // Test 3: Manual Renewal
  console.log('3️⃣ Testing manual webhook renewal...');
  try {
    const renewal = await makeRequest('POST', '/webhook-renewal/manual');
    
    if (renewal.status === 200) {
      console.log('   ✅ Manual renewal completed successfully');
    } else {
      console.log(`   ❌ Manual Renewal Failed (${renewal.status})`);
    }
  } catch (error) {
    console.log(`   ❌ Manual Renewal Error: ${error.message}`);
  }

  console.log('');

  // Test 4: Full Test Suite (optional - can be time consuming)
  const runFullSuite = process.argv.includes('--full');
  
  if (runFullSuite) {
    console.log('4️⃣ Running comprehensive test suite (this may take 30+ seconds)...');
    try {
      const suite = await makeRequest('POST', '/test/webhook-suite');
      
      if (suite.status === 200) {
        console.log(`   ✅ Test Suite Completed: ${suite.data.summary.status}`);
        console.log(`   📊 Results: ${suite.data.summary.passed}/${suite.data.summary.totalTests} passed`);
        console.log(`   ⏱️ Duration: ${suite.data.summary.totalDuration}ms`);
        console.log(`   💡 ${suite.data.recommendation}`);
        
        if (suite.data.summary.failed > 0) {
          console.log('\n   ❌ Failed tests:');
          suite.data.results
            .filter(r => r.status === 'FAIL')
            .forEach(r => console.log(`     - ${r.testName}: ${r.details}`));
        }
      } else {
        console.log(`   ❌ Test Suite Failed (${suite.status})`);
      }
    } catch (error) {
      console.log(`   ❌ Test Suite Error: ${error.message}`);
    }
  } else {
    console.log('4️⃣ Skipping full test suite (use --full flag to run)');
  }

  console.log('\n🎯 Quick Testing Summary:');
  console.log('   To run full test suite: node test-webhooks.js --full');
  console.log('   To test new user flow: visit http://localhost:3000/auth');
  console.log('   To check real-time: send test emails and monitor logs');
  console.log('\n✨ Testing completed!');
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⏹️ Testing interrupted by user');
  process.exit(0);
});

// Handle server not running
process.on('unhandledRejection', (error) => {
  if (error.code === 'ECONNREFUSED') {
    console.log('\n❌ Cannot connect to server at localhost:3000');
    console.log('💡 Make sure to start the server first: npm start');
    process.exit(1);
  }
});

runTests().catch(console.error);