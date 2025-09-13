#!/bin/bash
# Auto-restart script for memory issues
# Run this as a cron job for automated memory management

APP_NAME="chief-ai-safe"
MEMORY_THRESHOLD=200

echo "[$(date)] Checking app memory usage..."

# Get current memory usage from health endpoint
MEMORY_USAGE=$(fly ssh console -a $APP_NAME -C "curl -s localhost:3000/health/ready | jq '.checks.memory.details.heapUsed'")

echo "Current memory usage: ${MEMORY_USAGE}MB"

if (( $(echo "$MEMORY_USAGE > $MEMORY_THRESHOLD" | bc -l) )); then
    echo "🚨 Memory usage ${MEMORY_USAGE}MB exceeds threshold ${MEMORY_THRESHOLD}MB"
    echo "🔄 Restarting app to prevent memory leak..."
    
    # Restart the app
    fly restart -a $APP_NAME
    
    echo "✅ App restarted successfully"
    
    # Send notification (optional)
    echo "📧 Sending restart notification..."
    # Add your notification logic here
    
else
    echo "✅ Memory usage normal (${MEMORY_USAGE}MB < ${MEMORY_THRESHOLD}MB)"
fi