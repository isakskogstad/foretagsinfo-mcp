# Production Deployment Guide - Render.com

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Initial Deployment](#initial-deployment)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Rollback Procedure](#rollback-procedure)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- [x] GitHub account with repository access
- [x] Render.com account (free tier available)
- [x] Supabase account with Pro plan (recommended for production)
- [x] Bolagsverket API credentials

### Required Data
- [x] 1.88M companies imported to Supabase (`companies` table)
- [x] Database schema created (run SQL migrations)
- [x] Indexes optimized (run `/sql/004-optimize-indexes.sql`)
- [x] Storage bucket created (`company-documents`)

### Local Testing Complete
- [x] All environment variables configured
- [x] Build succeeds: `npm run build`
- [x] Server starts: `npm start`
- [x] Health check responds: `curl http://localhost:3000/health`
- [x] MCP endpoint accessible: `curl http://localhost:3000/mcp`

---

## Pre-Deployment Checklist

### 1. Environment Variables Ready

Create a `.env.production` file (DO NOT commit to git):

```bash
# Node Environment
NODE_ENV=production

# MCP Transport
MCP_TRANSPORT=http

# Server Configuration
PORT=3000  # Render will override this
HOST=0.0.0.0

# Supabase (from https://supabase.com/dashboard/project/_/settings/api)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Bolagsverket API (from https://portal.api.bolagsverket.se/)
BOLAGSVERKET_CLIENT_ID=your-client-id-here
BOLAGSVERKET_CLIENT_SECRET=your-client-secret-here

# Performance
NODE_OPTIONS=--max-old-space-size=384

# Logging
LOG_LEVEL=info
```

### 2. Verify Supabase Configuration

**Database Tables:**
```sql
-- Check table exists and row count
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  (SELECT count(*) FROM companies) AS row_count
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'companies';

-- Expected: ~1.88M rows, ~500MB size
```

**Indexes Status:**
```sql
-- Verify all indexes are created
SELECT
  indexname,
  tablename,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Expected: 15+ indexes on various tables
```

**Cache Tables:**
```sql
-- Verify cache tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'company_details_cache',
    'company_documents_cache',
    'financial_reports',
    'api_request_log'
  );

-- Expected: All 4 tables
```

**Storage Bucket:**
```sql
-- Check in Supabase Dashboard > Storage
-- Bucket name: company-documents
-- Public: false
-- File size limit: 50MB
```

### 3. Security Audit

**RLS Policies:**
```sql
-- Verify Row Level Security is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true;

-- Expected: All cache tables have RLS enabled
```

**API Keys:**
- [ ] Service Role Key is NOT in code (only in Render environment)
- [ ] Bolagsverket credentials are NOT in code
- [ ] No secrets in git history (`git log --all -p | grep -i "password\|secret\|key"`)

### 4. Performance Baseline

Run local performance test:
```bash
# Start server
npm start

# In another terminal, run basic tests
curl http://localhost:3000/health
curl http://localhost:3000/mcp

# Expected: < 100ms response time
```

---

## Initial Deployment

### Step 1: Create Render Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the `personupplysning` repository

### Step 2: Configure Service

**Service Name:** `personupplysning-mcp`

**Region:** Frankfurt (EU for GDPR compliance)

**Branch:** `main` (or your production branch)

**Root Directory:** Leave empty (project root)

**Runtime:** Node

**Build Command:**
```bash
npm ci --production=false && npm run build
```

**Start Command:**
```bash
node dist/index.js
```

**Plan:** Starter ($7/month)
- 512 MB RAM
- 0.5 CPU
- Shared infrastructure
- **Upgrade to Standard ($25/month) if:**
  - Traffic > 1000 requests/day
  - Need dedicated resources
  - Require auto-scaling

### Step 3: Add Environment Variables

In Render Dashboard → Settings → Environment:

```
NODE_ENV = production
MCP_TRANSPORT = http
HOST = 0.0.0.0
SUPABASE_URL = https://thjwryuhtwlfxwduyqqd.supabase.co
SUPABASE_SERVICE_ROLE_KEY = [paste from Supabase]
BOLAGSVERKET_CLIENT_ID = [paste from Bolagsverket portal]
BOLAGSVERKET_CLIENT_SECRET = [paste from Bolagsverket portal]
NODE_OPTIONS = --max-old-space-size=384
LOG_LEVEL = info
```

**Security Best Practice:**
- DO NOT paste keys in shared documents
- Use Render's "Secret File" feature for sensitive configs
- Rotate keys every 90 days

### Step 4: Configure Health Checks

Render → Settings → Health & Alerts:

**Health Check Path:** `/health`

**Expected Response:** 200 OK with JSON:
```json
{
  "status": "healthy",
  "server": "personupplysning-mcp",
  "version": "0.1.0",
  "uptime": 123.45,
  "endpoint": "/mcp",
  "environment": {
    "SUPABASE_URL": "configured",
    "SUPABASE_SERVICE_ROLE_KEY": "configured",
    "BOLAGSVERKET_CLIENT_ID": "configured",
    "BOLAGSVERKET_CLIENT_SECRET": "configured"
  }
}
```

**Health Check Interval:** 60 seconds

**Unhealthy Threshold:** 3 consecutive failures

### Step 5: Deploy

1. Click "Create Web Service"
2. Wait for initial build (5-10 minutes)
3. Monitor build logs in real-time

**Expected Build Output:**
```
==> Cloning from https://github.com/...
==> Running 'npm ci --production=false && npm run build'
==> Installing dependencies...
==> Compiling TypeScript...
==> Build complete!
==> Your service is live at https://personupplysning-mcp.onrender.com
```

---

## Post-Deployment Verification

### 1. Health Check (Required)

```bash
# Should return 200 OK with environment status
curl https://personupplysning-mcp.onrender.com/health

# Expected output:
{
  "status": "healthy",
  "server": "personupplysning-mcp",
  "version": "0.1.0",
  "uptime": 45.2,
  "endpoint": "/mcp",
  "environment": {
    "SUPABASE_URL": "configured",
    "SUPABASE_SERVICE_ROLE_KEY": "configured",
    "BOLAGSVERKET_CLIENT_ID": "configured",
    "BOLAGSVERKET_CLIENT_SECRET": "configured"
  }
}
```

### 2. MCP Endpoint Test (Required)

```bash
# Test SSE connection (will hang, this is expected)
curl -N https://personupplysning-mcp.onrender.com/mcp

# Should see SSE headers
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### 3. Database Connection Test

Check Render logs for startup messages:
```
✓ personupplysning-mcp v0.1.0 running on http://0.0.0.0:10000
✓ Health check: http://0.0.0.0:10000/health
✓ MCP endpoint: http://0.0.0.0:10000/mcp
Environment:
  NODE_ENV: production
  SUPABASE_URL: ✓ configured
  SUPABASE_SERVICE_ROLE_KEY: ✓ configured
  BOLAGSVERKET_CLIENT_ID: ✓ configured
  BOLAGSVERKET_CLIENT_SECRET: ✓ configured
```

### 4. Functional Test (via MCP Client)

If you have an MCP client:
```json
{
  "method": "tools/call",
  "params": {
    "name": "search_companies",
    "arguments": {
      "query": "Spotify",
      "limit": 5
    }
  }
}
```

Expected: List of companies matching "Spotify"

### 5. Performance Baseline

```bash
# Test response time
time curl https://personupplysning-mcp.onrender.com/health

# Expected: < 500ms (first request may be slower due to cold start)
```

### 6. Error Handling Test

```bash
# Test 404 handling
curl https://personupplysning-mcp.onrender.com/invalid-path

# Expected: 404 with JSON error
{
  "error": "Not found",
  "endpoints": {
    "health": "/",
    "mcp": "/mcp (GET for SSE, POST for JSON-RPC)"
  }
}
```

---

## Monitoring & Maintenance

### Daily Monitoring

**Render Metrics Dashboard:**
- CPU usage (should be < 60% average)
- Memory usage (should be < 400MB)
- Request count
- Error rate (should be < 1%)
- Response time (p95 < 2s)

**Supabase Monitoring:**
1. Go to Supabase Dashboard → Database → Logs
2. Check for:
   - Connection pool exhaustion
   - Slow queries (> 5s)
   - Failed authentication attempts

**Cache Hit Rate:**
```sql
SELECT
  COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / COUNT(*) as cache_hit_rate,
  COUNT(*) as total_requests
FROM api_request_log
WHERE requested_at > NOW() - INTERVAL '24 hours';

-- Expected: > 80% cache hit rate after warm-up
```

### Weekly Maintenance

**1. Database Optimization (Sunday 3 AM UTC):**
```sql
-- Automated via pg_cron (if enabled)
SELECT public.optimize_tables();
SELECT public.refresh_financial_summary();
```

**2. Unused Index Check:**
```sql
SELECT * FROM public.find_unused_indexes();

-- If any indexes have 0 scans after 1 week, consider dropping
```

**3. Cache Cleanup (automatic):**
```sql
-- Expired entries are automatically excluded from queries
-- Manual cleanup (optional):
DELETE FROM company_details_cache
WHERE cache_expires_at < NOW() - INTERVAL '7 days';

DELETE FROM company_documents_cache
WHERE cache_expires_at < NOW() - INTERVAL '7 days';
```

### Monthly Review

**1. Cost Analysis:**
- Render bill (expected: $7/month starter or $25/month standard)
- Supabase bill (expected: $25/month Pro plan)
- Bolagsverket API usage (free tier: 1000 requests/month)

**2. Security Updates:**
```bash
# Check for outdated dependencies
npm outdated

# Update dependencies (test locally first)
npm update
npm audit fix
```

**3. Performance Review:**
- Check p95 response times
- Analyze slow queries
- Review error logs

---

## Rollback Procedure

### Quick Rollback (< 5 minutes)

**Option 1: Render Dashboard**
1. Go to Render Dashboard → Events
2. Find previous successful deployment
3. Click "Rollback to this version"

**Option 2: Git Revert**
```bash
# Identify problematic commit
git log --oneline

# Revert to previous version
git revert <commit-hash>
git push origin main

# Render auto-deploys
```

### Emergency Rollback (< 1 minute)

**Disable Service Temporarily:**
1. Render Dashboard → Settings
2. "Suspend Service"
3. Fix issues locally
4. Re-enable when ready

---

## Troubleshooting

### Issue: Service won't start

**Symptoms:** Build succeeds but service crashes on startup

**Check:**
1. Render logs for error messages
2. Environment variables are set correctly
3. Database connection is working

**Solution:**
```bash
# Check logs
render logs --tail 100

# Common fixes:
# - Missing environment variable → Add in Render dashboard
# - Database unreachable → Check Supabase status
# - Port binding issue → Ensure HOST=0.0.0.0
```

### Issue: High memory usage

**Symptoms:** Memory > 450MB, service crashes

**Solution:**
```bash
# 1. Check for memory leaks in logs
# 2. Reduce NODE_OPTIONS heap size
NODE_OPTIONS=--max-old-space-size=320

# 3. Upgrade to Standard plan (1GB RAM)
```

### Issue: Slow response times

**Symptoms:** p95 > 5s, timeout errors

**Check:**
```sql
-- Find slow Supabase queries
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Solution:**
1. Add missing indexes
2. Optimize cache TTL
3. Enable connection pooling
4. Upgrade Supabase plan

### Issue: Cache not working

**Symptoms:** Low cache hit rate (< 50%)

**Check:**
```sql
SELECT * FROM public.get_index_stats()
WHERE tablename LIKE '%cache%';
```

**Solution:**
1. Verify cache tables exist
2. Check TTL configuration
3. Ensure cache writes succeed

### Issue: Bolagsverket API errors

**Symptoms:** 401 Unauthorized or 429 Rate Limit

**Check:**
1. Token expiration logic
2. API credentials are valid
3. Rate limit not exceeded (1000/month free tier)

**Solution:**
```bash
# Test credentials locally
curl -X POST https://portal.api.bolagsverket.se/oauth2/token \
  -u "$BOLAGSVERKET_CLIENT_ID:$BOLAGSVERKET_CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=vardefulla-datamangder:read"

# If invalid → Regenerate in Bolagsverket portal
```

### Issue: Database connection pool exhausted

**Symptoms:** "Too many clients" errors

**Solution:**
```javascript
// Increase Supabase connection limit (Pro plan)
// Or implement connection pooling:
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key, {
  db: {
    pool: {
      min: 2,
      max: 10
    }
  }
})
```

---

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)
- [Bolagsverket API Documentation](https://portal.api.bolagsverket.se/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

---

**Last Updated:** 2025-12-01
**Deployment Version:** 0.1.0
**Production URL:** https://personupplysning-mcp.onrender.com
