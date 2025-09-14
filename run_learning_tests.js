#!/usr/bin/env node

/**
 * LEARNING SYSTEM TEST RUNNER
 * Safely executes comprehensive learning system tests
 */

const { spawn } = require('child_process');
const path = require('path');

class LearningTestRunner {
  constructor() {
    this.serverProcess = null;
    this.testResults = null;
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting server for testing...');
      
      this.serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let serverReady = false;
      const timeout = setTimeout(() => {
        if (!serverReady) {
          console.log('⏰ Server startup timeout - proceeding with tests');
          resolve(false);
        }
      }, 15000);

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running') || output.includes('listening')) {
          clearTimeout(timeout);
          serverReady = true;
          console.log('✅ Server started successfully');
          resolve(true);
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('EADDRINUSE') || error.includes('port')) {
          console.log('ℹ️  Server already running on port 3000');
          clearTimeout(timeout);
          serverReady = true;
          resolve(true);
        }
      });

      this.serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async runTests() {
    console.log('🧪 Running learning system tests...');
    
    return new Promise((resolve, reject) => {
      const testProcess = spawn('node', ['LEARNING_SYSTEM_TEST.js'], {
        cwd: process.cwd(),
        stdio: 'inherit'
      });

      testProcess.on('close', (code) => {
        console.log(`\n📊 Test execution completed with exit code: ${code}`);
        resolve(code === 0);
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async stopServer() {
    if (this.serverProcess) {
      console.log('🛑 Stopping test server...');
      this.serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!this.serverProcess.killed) {
        this.serverProcess.kill('SIGKILL');
      }
      
      console.log('✅ Server stopped');
    }
  }

  async run() {
    try {
      console.log('🧠 LEARNING SYSTEM COMPREHENSIVE TEST SUITE');
      console.log('=' + '='.repeat(60));
      console.log('This will test the AI Learning System thoroughly');
      console.log('⏱️  Expected duration: 2-5 minutes');
      console.log('=' + '='.repeat(60));

      // Start server
      await this.startServer();
      
      // Wait a moment for server to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Run tests
      const testsPassed = await this.runTests();
      
      return testsPassed;
      
    } catch (error) {
      console.error('❌ Test runner error:', error);
      return false;
    } finally {
      await this.stopServer();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new LearningTestRunner();
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = LearningTestRunner;
