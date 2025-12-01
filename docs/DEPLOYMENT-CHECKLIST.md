# Production Deployment Checklist

## Pre-Deployment (Complete ALL items)

### Code Quality
- [ ] All TypeScript compiles without errors (`npm run build`)
- [ ] No console.error or console.log in production code
- [ ] Environment variables validated (`validateEnvironmentOrThrow()`)
- [ ] No hardcoded credentials or secrets in code
- [ ] Git history clean (no committed secrets)

### Testing
- [ ] Local build succeeds: `npm run build`
- [ ] Local server starts: `npm start`
- [ ] Health endpoint responds: `curl http://localhost:3000/health`
- [ ] MCP endpoint accessible: `curl http://localhost:3000/mcp`
- [ ] Search companies works (test with "Spotify")
- [ ] Company details fetch works (test with valid org number)
- [ ] Cache tables accessible (check Supabase)

### Database
- [ ] Companies table populated (1.88M rows)
- [ ] All cache tables created (`company_details_cache`, `company_documents_cache`, `financial_reports`, `api_request_log`)
- [ ] Indexes optimized (run `/sql/004-optimize-indexes.sql`)
- [ ] RLS policies enabled on all tables
- [ ] Storage bucket created (`company-documents`)
- [ ] Database connection pooling configured

### Credentials
- [ ] Supabase URL ready
- [ ] Supabase Service Role Key ready (NOT anon key)
- [ ] Bolagsverket Client ID ready
- [ ] Bolagsverket Client Secret ready
- [ ] All credentials tested locally

### Configuration
- [ ] `render.yaml` reviewed and updated
- [ ] `.env.example` up to date
- [ ] `package.json` scripts verified
- [ ] `tsconfig.json` production-ready

---

## Deployment Steps

### 1. Create Render Service
- [ ] Login to Render Dashboard
- [ ] Create new Web Service
- [ ] Connect GitHub repository
- [ ] Select correct branch (main)
- [ ] Service name: `personupplysning-mcp`
- [ ] Region: Frankfurt (EU)
- [ ] Plan: Starter ($7/month)

### 2. Configure Build
- [ ] Build command: `npm ci --production=false && npm run build`
- [ ] Start command: `node dist/index.js`
- [ ] Root directory: (empty - project root)
- [ ] Auto-deploy: enabled

### 3. Set Environment Variables
- [ ] `NODE_ENV = production`
- [ ] `MCP_TRANSPORT = http`
- [ ] `HOST = 0.0.0.0`
- [ ] `SUPABASE_URL = <your-url>`
- [ ] `SUPABASE_SERVICE_ROLE_KEY = <your-key>`
- [ ] `BOLAGSVERKET_CLIENT_ID = <your-id>`
- [ ] `BOLAGSVERKET_CLIENT_SECRET = <your-secret>`
- [ ] `NODE_OPTIONS = --max-old-space-size=384`
- [ ] `LOG_LEVEL = info`

### 4. Configure Health Check
- [ ] Health check path: `/health`
- [ ] Interval: 60 seconds
- [ ] Unhealthy threshold: 3 failures
- [ ] Expected status: 200 OK

### 5. Deploy
- [ ] Click "Create Web Service"
- [ ] Monitor build logs
- [ ] Wait for "Live" status (5-10 minutes)
- [ ] Note deployment URL

---

## Post-Deployment Verification (Complete ALL within 15 minutes)

### Immediate Tests (< 5 minutes)
- [ ] Health check responds: `curl https://your-app.onrender.com/health`
- [ ] Returns status "healthy"
- [ ] All environment variables show "configured"
- [ ] MCP endpoint accessible: `curl -N https://your-app.onrender.com/mcp`
- [ ] SSE headers present (text/event-stream)

### Functional Tests (< 5 minutes)
- [ ] Search companies via MCP client
- [ ] Get company details via MCP client
- [ ] Check Render logs for errors
- [ ] Verify startup message in logs

### Performance Tests (< 5 minutes)
- [ ] Health check response < 500ms
- [ ] Memory usage < 400MB
- [ ] CPU usage < 60%
- [ ] No error logs

### Database Tests
- [ ] Check Supabase logs for connections
- [ ] Verify cache writes (check `api_request_log` table)
- [ ] Test cache hit rate query
- [ ] No connection errors in logs

---

## Monitoring Setup (Complete within 1 hour)

### Render Alerts
- [ ] Enable email notifications for:
  - [ ] Deploy failures
  - [ ] Service crashes
  - [ ] High memory usage (> 450MB)
  - [ ] Health check failures

### Supabase Alerts
- [ ] Database size monitoring
- [ ] Connection pool monitoring
- [ ] Slow query alerts (> 5s)
- [ ] Daily backup enabled

### Custom Monitoring
- [ ] Create Grafana dashboard (or alternative)
- [ ] Set up uptime monitoring (UptimeRobot/Pingdom)
- [ ] Configure error tracking (Sentry optional)

---

## Security Checklist

### Access Control
- [ ] Render dashboard protected with 2FA
- [ ] Supabase dashboard protected with 2FA
- [ ] GitHub repository has branch protection
- [ ] Service Role Key not exposed publicly
- [ ] RLS policies tested and working

### Network Security
- [ ] HTTPS only (Render default)
- [ ] Supabase connection encrypted (default)
- [ ] No CORS issues (if applicable)
- [ ] Rate limiting configured (Render default)

### Secrets Management
- [ ] No secrets in git history
- [ ] No secrets in logs
- [ ] Environment variables encrypted (Render default)
- [ ] Key rotation plan documented

---

## Performance Optimization

### Database
- [ ] Indexes created on all tables
- [ ] Cache tables have appropriate TTL
- [ ] Connection pooling configured
- [ ] Materialized views refreshed

### Application
- [ ] Memory limit configured (NODE_OPTIONS)
- [ ] Logging level set to `info`
- [ ] Retry logic enabled (3 retries)
- [ ] Circuit breaker patterns implemented

### Caching Strategy
- [ ] Company details: 30 days TTL
- [ ] Document lists: 7 days TTL
- [ ] Financial reports: permanent cache
- [ ] OAuth tokens: cached with 1-minute buffer

---

## Rollback Plan

### Conditions for Rollback
- [ ] Service won't start after 3 attempts
- [ ] Error rate > 10%
- [ ] Response time p95 > 10s
- [ ] Memory usage > 500MB (crashes)
- [ ] Database connection failures

### Rollback Procedure
1. [ ] Go to Render Dashboard → Events
2. [ ] Identify last working deployment
3. [ ] Click "Rollback to this version"
4. [ ] Monitor health check
5. [ ] Verify functionality
6. [ ] Document issue for later fix

### Emergency Contact
- Render Support: support@render.com
- Supabase Support: support@supabase.com
- On-call developer: [Your contact info]

---

## Documentation

### Updated Files
- [ ] README.md with production URL
- [ ] PROJECT.md with deployment info
- [ ] DEPLOYMENT-GUIDE.md reviewed
- [ ] OPERATIONS-RUNBOOK.md reviewed

### Deployment Notes
- [ ] Deployment date and time recorded
- [ ] Deployment version tagged in git
- [ ] Changelog updated
- [ ] Team notified of deployment

---

## Sign-Off

**Deployed by:** ___________________

**Date/Time:** ___________________

**Production URL:** https://personupplysning-mcp.onrender.com

**Deployment Status:** ⬜ Success ⬜ Failed ⬜ Rolled Back

**Notes:**
```
[Add any deployment-specific notes or issues encountered]
```

---

## Automated Verification Script

Run this script post-deployment:

```bash
#!/bin/bash
# deployment-verify.sh

URL="https://personupplysning-mcp.onrender.com"

echo "🔍 Verifying deployment..."

# Health check
echo -n "✓ Health check... "
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health")
if [ "$HEALTH" -eq 200 ]; then
  echo "✓ PASS"
else
  echo "✗ FAIL (HTTP $HEALTH)"
  exit 1
fi

# MCP endpoint
echo -n "✓ MCP endpoint... "
MCP=$(curl -s -o /dev/null -w "%{http_code}" "$URL/mcp")
if [ "$MCP" -eq 200 ]; then
  echo "✓ PASS"
else
  echo "✗ FAIL (HTTP $MCP)"
  exit 1
fi

# Response time
echo -n "✓ Response time... "
TIME=$(curl -s -o /dev/null -w "%{time_total}" "$URL/health")
if (( $(echo "$TIME < 2.0" | bc -l) )); then
  echo "✓ PASS (${TIME}s)"
else
  echo "⚠ SLOW (${TIME}s)"
fi

echo ""
echo "✅ Deployment verified successfully!"
echo "🚀 Production URL: $URL"
```

**Usage:**
```bash
chmod +x deployment-verify.sh
./deployment-verify.sh
```

---

**Last Updated:** 2025-12-01
**Version:** 1.0
