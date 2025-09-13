#!/usr/bin/env node
/**
 * Cost & Memory Monitoring Script
 * Run this locally to get alerts about your app
 */

const https = require('https');

const CONFIG = {
  APP_URL: process.env.FLY_APP_URL || 'https://chief-ai-safe.fly.dev',
  CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
  MEMORY_THRESHOLD: 150, // MB
  WEBHOOK_URL: process.env.SLACK_WEBHOOK || null // Optional Slack notifications
};

async function checkAppHealth() {
  try {
    const response = await fetch(`${CONFIG.APP_URL}/health/ready`);
    const health = await response.json();
    
    const memoryUsed = health.checks.memory.details.heapUsed;
    const isHealthy = health.healthy;
    
    console.log(`[${new Date().toISOString()}] Memory: ${memoryUsed}MB, Healthy: ${isHealthy}`);
    
    // ALERT CONDITIONS
    if (memoryUsed > CONFIG.MEMORY_THRESHOLD) {
      console.error(`🚨 HIGH MEMORY ALERT: ${memoryUsed}MB (threshold: ${CONFIG.MEMORY_THRESHOLD}MB)`);
      
      if (CONFIG.WEBHOOK_URL) {
        await sendSlackAlert(memoryUsed);
      }
      
      // Could add email alerts here
      await sendEmailAlert(memoryUsed);
    }
    
    if (!isHealthy) {
      console.error(`🚨 APP UNHEALTHY: Check Fly.io dashboard immediately`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to check app health:`, error.message);
  }
}

async function sendEmailAlert(memoryUsage) {
  // Simple email alert (you can configure with SendGrid, etc.)
  console.log(`📧 EMAIL ALERT: Your Chief AI app is using ${memoryUsage}MB memory`);
  console.log(`📧 Action needed: Check Fly.io dashboard and consider restarting app`);
}

async function sendSlackAlert(memoryUsage) {
  if (!CONFIG.WEBHOOK_URL) return;
  
  const message = {
    text: `🚨 Chief AI Memory Alert`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Memory Usage Alert*\nYour app is using ${memoryUsage}MB\nThreshold: ${CONFIG.MEMORY_THRESHOLD}MB`
        }
      }
    ]
  };
  
  try {
    await fetch(CONFIG.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
  }
}

// Start monitoring
console.log(`🔍 Starting monitoring for ${CONFIG.APP_URL}`);
console.log(`📊 Memory threshold: ${CONFIG.MEMORY_THRESHOLD}MB`);
console.log(`⏰ Check interval: ${CONFIG.CHECK_INTERVAL / 1000}s`);

checkAppHealth(); // Initial check
setInterval(checkAppHealth, CONFIG.CHECK_INTERVAL);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Monitoring stopped');
  process.exit(0);
});