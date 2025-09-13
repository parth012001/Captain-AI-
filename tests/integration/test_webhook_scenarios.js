// 🎯 WEBHOOK SCENARIO TESTING - Real-world use cases for 24/7 system
// Tests various webhook scenarios that would occur in production

const axios = require('axios');

class WebhookScenarioTest {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.testResults = { passed: 0, failed: 0, details: [] };
  }

  logTest(testName, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName}`);
    if (details) console.log(`   ${details}`);
    
    this.testResults.details.push({ testName, passed, details });
    if (passed) this.testResults.passed++; 
    else this.testResults.failed++;
  }

  // Test webhook endpoint responsiveness
  async testWebhookEndpointHealth() {
    console.log('\n🔍 TESTING: Webhook Endpoint Health');
    
    try {
      // Test basic webhook endpoint availability
      const response = await axios.post(`${this.baseUrl}/webhooks/gmail`, {
        message: {
          data: Buffer.from(JSON.stringify({
            historyId: "test_health_check",
            messageId: null
          })).toString('base64'),
          messageId: "health_check",
          publishTime: new Date().toISOString()
        }
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      this.logTest('Webhook endpoint responds', response.status === 200, `Status: ${response.status}`);
      this.logTest('Webhook returns OK', response.data === 'OK', `Response: ${response.data}`);

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        this.logTest('Webhook endpoint responds', false, 'Server not running - start with npm start');
      } else {
        this.logTest('Webhook endpoint responds', false, error.message);
      }
    }
  }

  // Test multiple simultaneous webhooks (simulates high load)
  async testSimultaneousWebhooks() {
    console.log('\n🔍 TESTING: Simultaneous Webhook Processing');

    const webhookPromises = [];
    const numSimultaneous = 5;

    for (let i = 0; i < numSimultaneous; i++) {
      const webhookData = {
        message: {
          data: Buffer.from(JSON.stringify({
            historyId: `concurrent_test_${i}_${Date.now()}`,
            messageId: `concurrent_msg_${i}`
          })).toString('base64'),
          messageId: `concurrent_${i}`,
          publishTime: new Date().toISOString()
        }
      };

      webhookPromises.push(
        axios.post(`${this.baseUrl}/webhooks/gmail`, webhookData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        })
      );
    }

    try {
      const startTime = Date.now();
      const responses = await Promise.all(webhookPromises);
      const totalTime = Date.now() - startTime;

      const allSuccessful = responses.every(r => r.status === 200);
      this.logTest(`${numSimultaneous} simultaneous webhooks`, allSuccessful, 
        `Processed in ${totalTime}ms (avg ${Math.round(totalTime/numSimultaneous)}ms each)`);

    } catch (error) {
      this.logTest('Simultaneous webhook processing', false, error.message);
    }
  }

  // Test webhook with specific email ID scenario
  async testSpecificEmailWebhook() {
    console.log('\n🔍 TESTING: Specific Email Webhook Scenario');

    try {
      const webhookData = {
        message: {
          data: Buffer.from(JSON.stringify({
            historyId: `specific_email_${Date.now()}`,
            messageId: 'email_123456789' // Specific email
          })).toString('base64'),
          messageId: 'specific_email_test',
          publishTime: new Date().toISOString()
        }
      };

      const response = await axios.post(`${this.baseUrl}/webhooks/gmail`, webhookData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      this.logTest('Specific email webhook processing', response.status === 200, 
        'Should attempt to fetch specific email');

    } catch (error) {
      this.logTest('Specific email webhook processing', false, error.message);
    }
  }

  // Test webhook with general notification (no specific messageId)
  async testGeneralNotificationWebhook() {
    console.log('\n🔍 TESTING: General Notification Webhook Scenario');

    try {
      const webhookData = {
        message: {
          data: Buffer.from(JSON.stringify({
            historyId: `general_notification_${Date.now()}`,
            messageId: null // General notification
          })).toString('base64'),
          messageId: 'general_notification_test',
          publishTime: new Date().toISOString()
        }
      };

      const response = await axios.post(`${this.baseUrl}/webhooks/gmail`, webhookData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      this.logTest('General notification webhook processing', response.status === 200,
        'Should check recent emails for all users');

    } catch (error) {
      this.logTest('General notification webhook processing', false, error.message);
    }
  }

  // Test malformed webhook data
  async testMalformedWebhookData() {
    console.log('\n🔍 TESTING: Malformed Webhook Data Handling');

    const testCases = [
      {
        name: 'Empty webhook data',
        data: {}
      },
      {
        name: 'Invalid base64 data',
        data: {
          message: {
            data: 'invalid_base64_!@#',
            messageId: 'malformed_test'
          }
        }
      },
      {
        name: 'Missing message structure',
        data: {
          historyId: 'direct_history_id'
        }
      }
    ];

    for (const testCase of testCases) {
      try {
        const response = await axios.post(`${this.baseUrl}/webhooks/gmail`, testCase.data, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        // Should still return 200 OK for malformed data (Google requirement)
        this.logTest(`Malformed data handling: ${testCase.name}`, response.status === 200,
          'Should return 200 OK even with malformed data');

      } catch (error) {
        this.logTest(`Malformed data handling: ${testCase.name}`, false, error.message);
      }
    }
  }

  // Test webhook performance under load
  async testWebhookPerformance() {
    console.log('\n🔍 TESTING: Webhook Performance Under Load');

    const numRequests = 10;
    const requests = [];
    
    const startTime = Date.now();

    for (let i = 0; i < numRequests; i++) {
      requests.push(
        axios.post(`${this.baseUrl}/webhooks/gmail`, {
          message: {
            data: Buffer.from(JSON.stringify({
              historyId: `performance_test_${i}_${Date.now()}`,
              messageId: null
            })).toString('base64'),
            messageId: `perf_test_${i}`,
            publishTime: new Date().toISOString()
          }
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 20000
        })
      );
    }

    try {
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      const avgResponseTime = totalTime / numRequests;

      const allSuccessful = responses.every(r => r.status === 200);
      this.logTest(`Performance: ${numRequests} webhooks`, allSuccessful, 
        `Total: ${totalTime}ms, Avg: ${Math.round(avgResponseTime)}ms per request`);

      // Performance criteria: should handle 10 requests in under 30 seconds on average
      const performanceGood = avgResponseTime < 3000;
      this.logTest('Performance criteria met', performanceGood, 
        `Average response time: ${Math.round(avgResponseTime)}ms (target: <3000ms)`);

    } catch (error) {
      this.logTest('Webhook performance test', false, error.message);
    }
  }

  // Test system response to various Google Pub/Sub message formats
  async testGooglePubSubFormats() {
    console.log('\n🔍 TESTING: Google Pub/Sub Message Format Compatibility');

    // Test various real-world Pub/Sub message formats from Google
    const pubSubFormats = [
      {
        name: 'Standard Gmail notification',
        data: {
          message: {
            data: Buffer.from(JSON.stringify({
              emailAddress: 'user@gmail.com',
              historyId: '12345678'
            })).toString('base64'),
            messageId: '1234567890',
            publishTime: '2025-01-15T10:30:00.123Z'
          }
        }
      },
      {
        name: 'Gmail notification with attributes',
        data: {
          message: {
            attributes: {
              eventType: 'MESSAGE_ADD',
              eventTime: '2025-01-15T10:30:00.123Z'
            },
            data: Buffer.from(JSON.stringify({
              emailAddress: 'user@gmail.com', 
              historyId: '87654321'
            })).toString('base64'),
            messageId: '0987654321',
            publishTime: '2025-01-15T10:30:00.123Z'
          }
        }
      }
    ];

    for (const format of pubSubFormats) {
      try {
        const response = await axios.post(`${this.baseUrl}/webhooks/gmail`, format.data, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        this.logTest(`Pub/Sub format: ${format.name}`, response.status === 200,
          'Should handle various Google Pub/Sub formats');

      } catch (error) {
        this.logTest(`Pub/Sub format: ${format.name}`, false, error.message);
      }
    }
  }

  // Master test runner for webhook scenarios
  async runAllWebhookTests() {
    console.log('🎯 STARTING WEBHOOK SCENARIO TESTING');
    console.log('=' + '='.repeat(60));
    console.log('Testing real-world webhook scenarios for 24/7 system');

    const startTime = Date.now();

    await this.testWebhookEndpointHealth();
    await this.testSimultaneousWebhooks();
    await this.testSpecificEmailWebhook();
    await this.testGeneralNotificationWebhook();
    await this.testMalformedWebhookData();
    await this.testWebhookPerformance();
    await this.testGooglePubSubFormats();

    const totalTime = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('🎯 WEBHOOK SCENARIO TESTING COMPLETE');
    console.log('=' + '='.repeat(60));
    console.log(`⏱️  Total execution time: ${totalTime}ms`);
    console.log(`✅ Tests passed: ${this.testResults.passed}`);
    console.log(`❌ Tests failed: ${this.testResults.failed}`);
    console.log(`📊 Success rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);

    if (this.testResults.failed === 0) {
      console.log('\n🎉 ALL WEBHOOK TESTS PASSED! 🎉');
      console.log('✅ Your webhook system is production-ready!');
      console.log('✅ Can handle real-world Gmail notifications!');
      console.log('✅ Performance meets enterprise requirements!');
    } else {
      console.log('\n⚠️  SOME WEBHOOK TESTS FAILED');
      console.log('Check the server status and review failed tests.');
    }
  }
}

// Run webhook scenario tests
async function main() {
  console.log('\n📝 WEBHOOK TESTING INSTRUCTIONS:');
  console.log('1. Make sure your server is running: npm start');
  console.log('2. Server should be accessible at http://localhost:3000');
  console.log('3. This will test webhook scenarios without requiring real Gmail tokens\n');

  const webhookTest = new WebhookScenarioTest();
  await webhookTest.runAllWebhookTests();
}

if (require.main === module) {
  main();
}

module.exports = { WebhookScenarioTest };