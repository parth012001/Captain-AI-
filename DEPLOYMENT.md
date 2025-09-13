# Chief AI - Production Deployment Guide

## 🚀 Production-Ready Features

Your Chief AI system now includes enterprise-grade production features:

### ✅ **Production Features Added:**
- **Environment Validation** - Fails fast on startup if configuration is incomplete
- **Professional Logging** - Structured logging with levels (debug, info, warn, error)  
- **Security Middleware** - Rate limiting, security headers, request logging
- **Health Check Endpoints** - Liveness and readiness probes for load balancers
- **Docker Support** - Multi-stage builds with security best practices
- **Monitoring & Metrics** - Basic performance and error tracking
- **Graceful Shutdown** - Proper signal handling for container environments

## 🏗️ Deployment Options

### **Option 1: Docker Deployment (Recommended)**

```bash
# 1. Build the production image
docker build -t chief-ai:latest .

# 2. Run with Docker Compose (includes PostgreSQL)
docker-compose up -d

# 3. Check health
curl http://localhost:3000/health/ready
```

### **Option 2: Direct Node.js Deployment**

```bash
# 1. Install dependencies
npm ci --production

# 2. Build the application
npm run build

# 3. Set production environment
export NODE_ENV=production

# 4. Start the application
npm start
```

### **Option 3: Container Orchestration (Kubernetes/ECS)**

Use the provided Dockerfile with your orchestration platform. The container includes:
- Health checks for liveness/readiness probes
- Non-root user for security
- Proper signal handling
- Multi-stage build for smaller images

## 🔧 Environment Configuration

### **Required Environment Variables:**
```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@host:5432/chief_ai

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret  
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Security
JWT_SECRET=your_super_secure_32_character_jwt_secret

# Optional
WEBHOOK_RENEWAL_INTERVAL=6
```

### **Production Security Requirements:**
- **JWT_SECRET**: Must be at least 32 characters in production
- **DATABASE_URL**: Must use SSL in production (`?sslmode=require`)
- **HTTPS**: Required for OAuth callback URLs in production
- **Environment Variables**: Never commit to version control

## 📊 Health Check Endpoints

### **Liveness Probe (Load Balancer)**
```bash
GET /health
# Returns: 200 OK if service is running
```

### **Readiness Probe (Comprehensive)**
```bash
GET /health/ready
# Checks: Database, Memory, External Services
# Returns: 200 if ready, 503 if not ready
```

### **Metrics Endpoint (Monitoring)**
```bash
GET /health/metrics  
# Returns: System metrics, memory usage, uptime
```

## 🔒 Security Features

### **Rate Limiting**
- General endpoints: 100 requests/15 minutes
- Auth endpoints: 10 requests/15 minutes  
- API endpoints: 200 requests/15 minutes

### **Security Headers**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: enabled
- Strict-Transport-Security (production only)

### **Request Logging**
All requests logged with:
- Method, URL, status code
- Response time, client IP
- User agent, error details

## 📈 Monitoring Integration

### **Built-in Metrics**
```javascript
// Access metrics programmatically
const metrics = monitoring.getMetrics();
// Returns: request counts, error rates, performance data
```

### **Log Levels**
```bash
LOG_LEVEL=debug  # Development
LOG_LEVEL=info   # Production default  
LOG_LEVEL=warn   # High-traffic production
LOG_LEVEL=error  # Minimal logging
```

### **External Monitoring Integration**
Ready for integration with:
- **Prometheus** (metrics endpoint)
- **ELK Stack** (structured JSON logs)
- **DataDog/New Relic** (custom metrics)
- **Sentry** (error tracking)

## 🗄️ Database Setup

### **PostgreSQL Requirements**
- PostgreSQL 15+ recommended
- Extensions: None required (pure SQL)
- SSL: Required in production

### **Schema Initialization**
```bash
# Automatic on first startup
npm start
# Or manually run migrations
npm run db:migrate
```

### **Backup Strategy**
```bash
# Automated backup (recommended)
pg_dump $DATABASE_URL > chief_ai_backup_$(date +%Y%m%d).sql

# Point-in-time recovery setup
# Configure WAL archiving in PostgreSQL
```

## 🚢 Container Deployment

### **Docker Best Practices**
- Multi-stage build (reduces image size)
- Non-root user (security)
- Health checks (orchestration)
- Proper signal handling (graceful shutdown)
- .dockerignore (faster builds)

### **Container Sizing**
- **CPU**: 0.5-1 vCPU for most workloads
- **Memory**: 512MB-1GB depending on load
- **Storage**: 1GB for logs and temp files

### **Environment-Specific Configs**
```yaml
# docker-compose.prod.yml
services:
  chief-ai:
    environment:
      NODE_ENV: production
      LOG_LEVEL: warn
      # Add production secrets via Docker secrets or env files
```

## 🔄 CI/CD Pipeline

### **Basic Pipeline Steps**
```yaml
# .github/workflows/deploy.yml
1. Run tests: npm test
2. Build application: npm run build  
3. Build Docker image: docker build
4. Run security scan: docker scan
5. Deploy to production: docker push
6. Health check: curl /health/ready
```

### **Rolling Deployment**
```bash
# Zero-downtime deployment with health checks
1. Start new container
2. Wait for health check: /health/ready -> 200
3. Stop old container
4. Verify: /health/metrics
```

## 🚨 Production Troubleshooting

### **Common Issues**
```bash
# Environment validation failed
Error: Missing required environment variables
Solution: Check .env file and required variables

# Database connection failed  
Error: Cannot connect to database
Solution: Verify DATABASE_URL and network connectivity

# High memory usage
Warning: Memory usage > 1GB
Solution: Check /health/metrics and restart if needed

# Rate limiting triggered
Status: 429 Too Many Requests
Solution: Implement client-side rate limiting
```

### **Log Analysis**
```bash
# View structured logs
docker logs chief-ai-app | jq '.level, .message'

# Filter by log level
docker logs chief-ai-app | grep '"level":"error"'

# Monitor performance
docker logs chief-ai-app | grep '"PERFORMANCE"'
```

### **Health Check Debugging**
```bash
# Detailed health status
curl http://localhost:3000/health/ready | jq '.'

# Specific component health
curl http://localhost:3000/health/metrics | jq '.process'
```

## ✅ Production Readiness Checklist

### **Before Deployment:**
- [ ] All environment variables configured
- [ ] Database SSL enabled
- [ ] HTTPS/SSL certificates installed
- [ ] Rate limiting configured
- [ ] Log aggregation setup
- [ ] Monitoring/alerting configured
- [ ] Backup strategy implemented
- [ ] Security headers verified

### **After Deployment:**
- [ ] Health checks returning 200
- [ ] Database connections stable
- [ ] OAuth flow working
- [ ] Email processing functional
- [ ] Logs flowing to aggregation system
- [ ] Metrics being collected
- [ ] Alerts configured and tested

## 🎯 Performance Expectations

### **Baseline Performance**
- **Startup Time**: < 30 seconds
- **Health Check**: < 100ms response time
- **Email Processing**: < 2 seconds per email
- **Memory Usage**: 256-512MB steady state
- **Database Queries**: < 100ms average

### **Scaling Thresholds**
- **CPU > 70%**: Consider horizontal scaling
- **Memory > 80%**: Investigate memory leaks
- **Response Time > 2s**: Check database performance
- **Error Rate > 5%**: Investigate application issues

---

**Your Chief AI system is now production-ready with enterprise-grade features!** 🚀

For questions or issues, check the logs at `/health/metrics` and verify all environment variables are properly configured.