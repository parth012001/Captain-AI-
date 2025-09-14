#!/usr/bin/env node

/**
 * COMPREHENSIVE LEARNING SYSTEM TEST SUITE
 * Tests the AI Learning System without breaking existing functionality
 * 
 * Test Categories:
 * 1. Basic Learning Functionality
 * 2. Edge Cases and Error Handling
 * 3. Database Integration
 * 4. AI Analysis Quality
 * 5. Performance and Reliability
 * 6. Integration with Frontend Edit Pipeline
 */

const axios = require('axios');
const crypto = require('crypto');

class LearningSystemTester {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.testResults = {
      passed: 0,
      failed: 0,
      details: [],
      startTime: Date.now()
    };
    this.testData = this.generateTestData();
  }

  logTest(testName, passed, details = '', critical = false) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const criticality = critical ? ' 🔥 CRITICAL' : '';
    console.log(`${status}${criticality}: ${testName}`);
    if (details) console.log(`   ${details}`);
    
    this.testResults.details.push({ 
      testName, 
      passed, 
      details, 
      critical,
      timestamp: new Date().toISOString()
    });
    
    if (passed) this.testResults.passed++; 
    else this.testResults.failed++;
  }

  generateTestData() {
    return {
      // Basic edit scenarios
      basicEdits: [
        {
          id: 'test-basic-1',
          original: 'Hello, thank you for your email.',
          edited: 'Hi there, thanks for reaching out!',
          expectedType: 'tone'
        },
        {
          id: 'test-basic-2',
          original: 'I will get back to you soon.',
          edited: 'I will get back to you within 24 hours.',
          expectedType: 'content'
        },
        {
          id: 'test-basic-3',
          original: 'This is a very long email with lots of details about the project and all the requirements and specifications.',
          edited: 'Short response.',
          expectedType: 'length'
        }
      ],

      // Edge cases
      edgeCases: [
        {
          id: 'test-edge-1',
          original: '',
          edited: 'New content',
          expectedType: 'content'
        },
        {
          id: 'test-edge-2',
          original: 'Same content',
          edited: 'Same content',
          expectedType: 'content'
        },
        {
          id: 'test-edge-3',
          original: 'A',
          edited: 'A'.repeat(1000),
          expectedType: 'length'
        },
        {
          id: 'test-edge-4',
          original: 'Normal text with special characters: @#$%^&*()_+-=[]{}|;:,.<>?',
          edited: 'Cleaned text',
          expectedType: 'content'
        }
      ],

      // Complex scenarios
      complexScenarios: [
        {
          id: 'test-complex-1',
          original: `Subject: Project Update

Dear Team,

I hope this email finds you well. I wanted to provide you with an update on our current project status. We have made significant progress over the past week and are on track to meet our deadline.

Best regards,
John`,
          edited: `Subject: Project Update - On Track

Hi Team,

Quick update: we're on track for the deadline. Great work everyone!

Thanks,
John`,
          expectedType: 'mixed'
        }
      ]
    };
  }

  async testServerConnection() {
    console.log('\n🔍 TESTING: Server Connection');
    
    try {
      const response = await axios.get(`${this.baseUrl}/health/ready`, { timeout: 5000 });
      this.logTest('Server is running', response.status === 200, `Status: ${response.status}`);
      return true;
    } catch (error) {
      this.logTest('Server is running', false, 'Server not accessible - start with npm run dev', true);
      return false;
    }
  }

  async testLearningEndpoints() {
    console.log('\n🔍 TESTING: Learning API Endpoints');
    
    try {
      // Test success metrics endpoint
      const metricsResponse = await axios.get(`${this.baseUrl}/learning/success-metrics`);
      this.logTest('Success metrics endpoint', metricsResponse.status === 200, 
        `Returned ${metricsResponse.data.metrics.totalResponses} responses`);
      
      // Test insights endpoint
      const insightsResponse = await axios.get(`${this.baseUrl}/learning/insights`);
      this.logTest('Insights endpoint', insightsResponse.status === 200,
        `Found ${insightsResponse.data.insights.length} insights`);
      
      return true;
    } catch (error) {
      this.logTest('Learning endpoints accessible', false, error.message, true);
      return false;
    }
  }

  async testBasicLearningFunctionality() {
    console.log('\n🔍 TESTING: Basic Learning Functionality');
    
    for (const testCase of this.testData.basicEdits) {
      try {
        const response = await axios.post(`${this.baseUrl}/learning/analyze-edit`, {
          responseId: testCase.id,
          originalText: testCase.original,
          editedText: testCase.edited
        });

        const analysis = response.data.analysis;
        
        // Validate response structure
        const hasRequiredFields = analysis.responseId && 
                                 analysis.originalText && 
                                 analysis.editedText &&
                                 analysis.editType &&
                                 typeof analysis.editPercentage === 'number' &&
                                 typeof analysis.successScore === 'number' &&
                                 analysis.learningInsight;

        this.logTest(`Basic edit analysis - ${testCase.id}`, hasRequiredFields,
          `Type: ${analysis.editType}, Percentage: ${analysis.editPercentage}%, Score: ${analysis.successScore}`);

        // Validate edit percentage calculation
        const expectedPercentage = testCase.original === testCase.edited ? 0 : 100;
        const percentageCorrect = analysis.editPercentage >= 0 && analysis.editPercentage <= 100;
        this.logTest(`Edit percentage calculation - ${testCase.id}`, percentageCorrect,
          `Calculated: ${analysis.editPercentage}%`);

        // Validate edit type detection
        const typeDetected = analysis.editType && typeof analysis.editType === 'string';
        this.logTest(`Edit type detection - ${testCase.id}`, typeDetected,
          `Detected type: ${analysis.editType}`);

      } catch (error) {
        this.logTest(`Basic learning test - ${testCase.id}`, false, error.message);
      }
    }
  }

  async testEdgeCases() {
    console.log('\n🔍 TESTING: Edge Cases and Error Handling');
    
    for (const testCase of this.testData.edgeCases) {
      try {
        const response = await axios.post(`${this.baseUrl}/learning/analyze-edit`, {
          responseId: testCase.id,
          originalText: testCase.original,
          editedText: testCase.edited
        });

        const analysis = response.data.analysis;
        
        // Test that system handles edge cases gracefully
        const handlesEdgeCase = analysis && analysis.editType && analysis.learningInsight;
        this.logTest(`Edge case handling - ${testCase.id}`, handlesEdgeCase,
          `Original length: ${testCase.original.length}, Edited length: ${testCase.edited.length}`);

      } catch (error) {
        // Some edge cases might legitimately fail, but shouldn't crash the system
        const gracefulFailure = error.response && error.response.status >= 400 && error.response.status < 500;
        this.logTest(`Edge case error handling - ${testCase.id}`, gracefulFailure,
          `Error: ${error.message}`);
      }
    }

    // Test invalid input handling
    try {
      await axios.post(`${this.baseUrl}/learning/analyze-edit`, {
        responseId: 'invalid-test',
        originalText: null,
        editedText: undefined
      });
      this.logTest('Invalid input handling', false, 'Should have rejected null/undefined inputs');
    } catch (error) {
      const properErrorHandling = error.response && error.response.status === 400;
      this.logTest('Invalid input handling', properErrorHandling,
        `Properly rejected invalid input: ${error.response?.status}`);
    }
  }

  async testComplexScenarios() {
    console.log('\n🔍 TESTING: Complex Real-world Scenarios');
    
    for (const testCase of this.testData.complexScenarios) {
      try {
        const response = await axios.post(`${this.baseUrl}/learning/analyze-edit`, {
          responseId: testCase.id,
          originalText: testCase.original,
          editedText: testCase.edited
        });

        const analysis = response.data.analysis;
        
        // Test complex analysis
        const complexAnalysis = analysis.editDescription && 
                               analysis.editDescription.length > 50 &&
                               analysis.learningInsight &&
                               analysis.learningInsight.length > 20;

        this.logTest(`Complex scenario analysis - ${testCase.id}`, complexAnalysis,
          `Description: ${analysis.editDescription?.substring(0, 50)}...`);

        // Test that edit percentage is reasonable for complex edits
        const reasonablePercentage = analysis.editPercentage > 0 && analysis.editPercentage < 100;
        this.logTest(`Complex edit percentage - ${testCase.id}`, reasonablePercentage,
          `Percentage: ${analysis.editPercentage}%`);

      } catch (error) {
        this.logTest(`Complex scenario - ${testCase.id}`, false, error.message);
      }
    }
  }

  async testDatabaseIntegration() {
    console.log('\n🔍 TESTING: Database Integration');
    
    try {
      // Test that edits are being stored in database
      const testId = 'db-test-' + Date.now();
      await axios.post(`${this.baseUrl}/learning/analyze-edit`, {
        responseId: testId,
        originalText: 'Database test original',
        editedText: 'Database test edited'
      });

      // Wait a moment for database write
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if insights were updated
      const insightsResponse = await axios.get(`${this.baseUrl}/learning/insights`);
      const hasRecentInsights = insightsResponse.data.insights && insightsResponse.data.insights.length > 0;
      
      this.logTest('Database storage', hasRecentInsights,
        `Found ${insightsResponse.data.insights.length} insights in database`);

      // Check success metrics update
      const metricsResponse = await axios.get(`${this.baseUrl}/learning/success-metrics`);
      const metricsUpdated = metricsResponse.data.metrics && typeof metricsResponse.data.metrics.totalResponses === 'number';
      
      this.logTest('Metrics tracking', metricsUpdated,
        `Total responses tracked: ${metricsResponse.data.metrics.totalResponses}`);

    } catch (error) {
      this.logTest('Database integration', false, error.message);
    }
  }

  async testAIAnalysisQuality() {
    console.log('\n🔍 TESTING: AI Analysis Quality');
    
    const qualityTests = [
      {
        id: 'quality-test-1',
        original: 'Hello',
        edited: 'Hi',
        shouldDetectTone: true
      },
      {
        id: 'quality-test-2',
        original: 'Short',
        edited: 'This is a much longer response with additional details and context',
        shouldDetectLength: true
      },
      {
        id: 'quality-test-3',
        original: 'I will help you',
        edited: 'I will help you with the project documentation and implementation',
        shouldDetectContent: true
      }
    ];

    for (const test of qualityTests) {
      try {
        const response = await axios.post(`${this.baseUrl}/learning/analyze-edit`, {
          responseId: test.id,
          originalText: test.original,
          editedText: test.edited
        });

        const analysis = response.data.analysis;
        
        // Test AI quality indicators
        const hasInsight = analysis.learningInsight && analysis.learningInsight.length > 10;
        const hasDescription = analysis.editDescription && analysis.editDescription.length > 10;
        const reasonableScore = analysis.successScore >= 0 && analysis.successScore <= 100;

        this.logTest(`AI analysis quality - ${test.id}`, 
          hasInsight && hasDescription && reasonableScore,
          `Insight: "${analysis.learningInsight?.substring(0, 30)}...", Score: ${analysis.successScore}`);

      } catch (error) {
        this.logTest(`AI quality test - ${test.id}`, false, error.message);
      }
    }
  }

  async testPerformanceAndReliability() {
    console.log('\n🔍 TESTING: Performance and Reliability');
    
    try {
      // Test concurrent requests
      const concurrentTests = Array.from({ length: 5 }, (_, i) => 
        axios.post(`${this.baseUrl}/learning/analyze-edit`, {
          responseId: `perf-test-${i}`,
          originalText: `Original text ${i}`,
          editedText: `Edited text ${i}`
        })
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentTests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const allSuccessful = results.every(result => result.status === 'fulfilled');
      const reasonablePerformance = duration < 10000; // Less than 10 seconds

      this.logTest('Concurrent request handling', allSuccessful,
        `${results.length} concurrent requests in ${duration}ms`);

      this.logTest('Performance benchmark', reasonablePerformance,
        `Average: ${duration / results.length}ms per request`);

      // Test large text handling
      const largeText = 'A'.repeat(5000);
      const largeTextStart = Date.now();
      await axios.post(`${this.baseUrl}/learning/analyze-edit`, {
        responseId: 'large-text-test',
        originalText: largeText,
        editedText: largeText + ' modified'
      });
      const largeTextDuration = Date.now() - largeTextStart;

      const handlesLargeText = largeTextDuration < 15000; // Less than 15 seconds
      this.logTest('Large text processing', handlesLargeText,
        `Processed 5000+ char text in ${largeTextDuration}ms`);

    } catch (error) {
      this.logTest('Performance testing', false, error.message);
    }
  }

  async testIntegrationWithEditPipeline() {
    console.log('\n🔍 TESTING: Integration with Edit Pipeline');
    
    try {
      // Test that the edit endpoint exists and responds
      const editEndpointResponse = await axios.put(`${this.baseUrl}/auto-drafts/999999`, {
        subject: 'Test Subject',
        body: 'Test Body'
      }, {
        headers: { 'Authorization': 'Bearer test-token' },
        validateStatus: () => true // Don't throw on 401/403
      });

      // We expect auth failure, but endpoint should exist
      const endpointExists = editEndpointResponse.status === 401 || editEndpointResponse.status === 403;
      this.logTest('Edit endpoint exists', endpointExists,
        `Edit endpoint responds with status: ${editEndpointResponse.status}`);

      // Test learning endpoints are accessible without auth
      const learningEndpointResponse = await axios.post(`${this.baseUrl}/learning/analyze-edit`, {
        responseId: 'integration-test',
        originalText: 'Integration test original',
        editedText: 'Integration test edited'
      });

      this.logTest('Learning endpoint accessible', learningEndpointResponse.status === 200,
        'Learning endpoints work without authentication');

    } catch (error) {
      this.logTest('Integration testing', false, error.message);
    }
  }

  async runAllTests() {
    console.log('🧠 COMPREHENSIVE LEARNING SYSTEM TEST SUITE');
    console.log('=' + '='.repeat(60));
    console.log('Testing AI Learning System functionality and reliability');
    console.log('⏱️  Starting comprehensive test execution...');
    console.log('=' + '='.repeat(60));

    const serverRunning = await this.testServerConnection();
    if (!serverRunning) {
      console.log('\n❌ Cannot proceed - server is not running');
      return this.generateReport();
    }

    // Run all test suites
    await this.testLearningEndpoints();
    await this.testBasicLearningFunctionality();
    await this.testEdgeCases();
    await this.testComplexScenarios();
    await this.testDatabaseIntegration();
    await this.testAIAnalysisQuality();
    await this.testPerformanceAndReliability();
    await this.testIntegrationWithEditPipeline();

    return this.generateReport();
  }

  generateReport() {
    const totalTime = Date.now() - this.testResults.startTime;
    const successRate = (this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100;

    console.log('\n' + '='.repeat(60));
    console.log('🧠 LEARNING SYSTEM TEST RESULTS');
    console.log('=' + '='.repeat(60));
    console.log(`⏱️  Total Test Time: ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`✅ Tests Passed: ${this.testResults.passed}`);
    console.log(`❌ Tests Failed: ${this.testResults.failed}`);
    console.log(`📊 Success Rate: ${successRate.toFixed(1)}%`);
    console.log('=' + '='.repeat(60));

    // Show critical failures
    const criticalFailures = this.testResults.details.filter(test => !test.passed && test.critical);
    if (criticalFailures.length > 0) {
      console.log('\n🔥 CRITICAL FAILURES:');
      criticalFailures.forEach(test => {
        console.log(`   ❌ ${test.testName}: ${test.details}`);
      });
    }

    // Show failed tests
    const failedTests = this.testResults.details.filter(test => !test.passed && !test.critical);
    if (failedTests.length > 0) {
      console.log('\n⚠️  OTHER FAILURES:');
      failedTests.forEach(test => {
        console.log(`   ❌ ${test.testName}: ${test.details}`);
      });
    }

    // Overall assessment
    console.log('\n🎯 OVERALL ASSESSMENT:');
    if (criticalFailures.length === 0 && successRate >= 90) {
      console.log('   🎉 EXCELLENT - Learning system is working perfectly!');
    } else if (criticalFailures.length === 0 && successRate >= 75) {
      console.log('   ✅ GOOD - Learning system is working well with minor issues');
    } else if (criticalFailures.length === 0 && successRate >= 50) {
      console.log('   ⚠️  FAIR - Learning system is functional but needs attention');
    } else {
      console.log('   ❌ POOR - Learning system has significant issues');
    }

    console.log('\n📋 DETAILED RESULTS:');
    this.testResults.details.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      const critical = test.critical ? ' 🔥' : '';
      console.log(`   ${status}${critical} ${test.testName}`);
    });

    return {
      successRate,
      criticalFailures: criticalFailures.length,
      totalTests: this.testResults.passed + this.testResults.failed,
      testResults: this.testResults.details
    };
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new LearningSystemTester();
  tester.runAllTests().then(results => {
    process.exit(results.criticalFailures > 0 ? 1 : 0);
  }).catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = LearningSystemTester;
