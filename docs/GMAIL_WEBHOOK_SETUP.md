# 📡 Gmail Webhook Setup Guide

## 🎯 Overview

Gmail webhooks enable real-time email notifications via Google Cloud Pub/Sub. When new emails arrive, Gmail sends push notifications to your endpoint instead of polling.

## 📋 Prerequisites

### 1. Google Cloud Project Setup
- Google Cloud Project with billing enabled
- Gmail API enabled
- Pub/Sub API enabled
- Service account with proper permissions

### 2. Environment Variables
Add to your `.env` file:
```bash
# Gmail Pub/Sub Topic (required)
GMAIL_PUBSUB_TOPIC=projects/your-project-id/topics/gmail-notifications

# Your domain for webhook endpoint (production)
WEBHOOK_DOMAIN=https://your-domain.com
```

## ⚙️ Setup Steps

### Step 1: Create Pub/Sub Topic
```bash
# Install Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# Login and set project
gcloud auth login
gcloud config set project your-project-id

# Create topic for Gmail notifications
gcloud pubsub topics create gmail-notifications

# Create subscription for your webhook
gcloud pubsub subscriptions create gmail-webhook-sub \
  --topic=gmail-notifications \
  --push-endpoint=https://your-domain.com/webhooks/gmail
```

### Step 2: Grant Gmail Permission to Publish
```bash
# Give Gmail permission to publish to your topic
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

### Step 3: Configure Domain Verification
- Verify your domain in Google Search Console
- Or use ngrok for development:
```bash
# Install ngrok: https://ngrok.com/
ngrok http 3000
# Use the HTTPS URL: https://abc123.ngrok.io
```

## 🚀 API Usage

### Setup Webhook
```bash
curl -X POST http://localhost:3000/gmail/setup-webhook
```

### Check Status
```bash
curl -X GET http://localhost:3000/gmail/webhook-status
```

### Stop Webhook
```bash
curl -X POST http://localhost:3000/gmail/stop-webhook
```

## 📊 How It Works

1. **📧 Email Arrives** → Gmail detects new email
2. **☁️ Pub/Sub Notification** → Gmail publishes to your topic
3. **📡 Webhook Called** → Google calls your `/webhooks/gmail` endpoint
4. **🔄 Process Changes** → Your app fetches and processes new emails
5. **✨ Generate Response** → AI analyzes and creates draft

## 🔧 Development Setup

### Using ngrok (Recommended)
```bash
# Terminal 1: Start your server
npm run dev

# Terminal 2: Expose via ngrok
ngrok http 3000

# Update .env with ngrok URL
WEBHOOK_DOMAIN=https://abc123.ngrok.io
GMAIL_PUBSUB_TOPIC=projects/your-project-id/topics/gmail-notifications
```

### Test Webhook
```bash
# Setup webhook (will use ngrok URL)
curl -X POST http://localhost:3000/gmail/setup-webhook

# Send yourself an email to trigger notification
# Check your server logs for webhook calls
```

## 📋 Troubleshooting

### Common Issues

1. **"Invalid topic name"**
   - Ensure GMAIL_PUBSUB_TOPIC is properly formatted
   - Format: `projects/PROJECT_ID/topics/TOPIC_NAME`

2. **"Permission denied"**
   - Grant Gmail publish permissions to your topic
   - Check service account permissions

3. **"Webhook verification failed"**
   - Ensure your endpoint is publicly accessible
   - Return 200 OK within 10 seconds

4. **"No notifications received"**
   - Check domain verification
   - Verify topic permissions
   - Ensure push subscription is active

### Debug Commands
```bash
# Check topic exists
gcloud pubsub topics list

# Check topic permissions
gcloud pubsub topics get-iam-policy gmail-notifications

# Test subscription
gcloud pubsub subscriptions pull gmail-webhook-sub --auto-ack
```

## 🔍 Webhook Payload Example

When Gmail sends a notification, your `/webhooks/gmail` endpoint receives:

```json
{
  "message": {
    "data": "base64-encoded-json",
    "messageId": "123456789",
    "publishTime": "2024-01-01T12:00:00Z"
  }
}
```

Decoded data contains:
```json
{
  "emailAddress": "user@gmail.com", 
  "historyId": "123456"
}
```

## ⏱️ Limitations

- **Expiration**: Watch requests expire (7 days max)
- **Rate Limits**: Gmail API quotas apply
- **Delay**: Notifications may have slight delay
- **Deduplication**: Handle duplicate notifications

## 🎯 Next Steps

1. ✅ Set up Pub/Sub topic
2. ✅ Configure webhook endpoints  
3. 🔄 Test with ngrok
4. 📧 Implement email processing pipeline
5. ✨ Add AI draft generation to webhook flow

## 📝 Production Considerations

- Set up proper domain with SSL
- Monitor webhook failures and retries  
- Implement proper error handling
- Scale Pub/Sub subscription as needed
- Set up monitoring and alerting