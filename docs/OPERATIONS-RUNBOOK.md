# Operations Runbook - Personupplysning MCP Server

## Quick Reference

**Production URL:** https://personupplysning-mcp.onrender.com

**Health Check:** https://personupplysning-mcp.onrender.com/health

**MCP Endpoint:** https://personupplysning-mcp.onrender.com/mcp

**Render Dashboard:** https://dashboard.render.com/

**Supabase Dashboard:** https://supabase.com/dashboard/project/thjwryuhtwlfxwduyqqd

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Common Operations](#common-operations)
3. [Incident Response](#incident-response)
4. [Performance Tuning](#performance-tuning)
5. [Maintenance Tasks](#maintenance-tasks)
6. [Debugging Guide](#debugging-guide)

---

## Service Overview

### Architecture

```
┌─────────────┐
│   Client    │
│  (MCP App)  │
└─────┬───────┘
      │ SSE (HTTP)
      │
┌─────▼────────────────────────┐
│  Render Web Service          │
│  personupplysning-mcp        │
│                              │
│  ┌──────────────────────┐   │
│  │  Node.js HTTP Server │   │
│  │  (SSE Transport)     │   │
│  └──────────┬───────────┘   │
│             │                │
│  ┌──────────▼───────────┐   │
│  │  MCP Server          │   │
│  │  (Tools, Resources)  │   │
│  └──────────┬───────────┘   │
│             │                │
│  ┌──────────▼───────────┐   │
│  │  Company Data Service│   │
│  │  (Cache-first logic) │   │
│  └──────┬──────┬────────┘   │
└─────────┼──────┼────────────┘
          │      │
   ┌──────▼──┐  ┌▼──────────────┐
   │Supabase │  │ Bolagsverket  │
   │Database │  │ API (OAuth2)  │
   │+ Storage│  └───────────────┘
   └─────────┘
```

### Key Components

1. **HTTP Server** (SSE Transport)
   - Endpoint: `/mcp` (GET for SSE connections)
   - Health: `/health` (GET for status)
   - Port: 10000 (Render assigns dynamically)

2. **Company Data Service**
   - Cache-first strategy
   - 30-day TTL for company details
   - 7-day TTL for document lists
   - Permanent cache for financial reports

3. **Supabase Database**
   - 1.88M companies in `companies` table
   - Cache tables for API responses
   - Request logging for analytics

4. **Bolagsverket API**
   - OAuth2 authentication
   - Rate limit: 1000 requests/month (free tier)
   - Retry logic: 3 attempts with exponential backoff

---

## Common Operations

### 1. View Service Logs

**Via Render Dashboard:**
```
1. Go to https://dashboard.render.com/
2. Select "personupplysning-mcp"
3. Click "Logs" tab
4. Set time range (last hour, day, etc.)
```

**Via Render CLI:**
```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# View logs (last 100 lines)
render logs --tail 100 personupplysning-mcp

# Follow logs in real-time
render logs --follow personupplysning-mcp
```

### 2. Restart Service

**Via Dashboard:**
```
1. Render Dashboard → personupplysning-mcp
2. Click "Manual Deploy" → "Deploy latest commit"
```

**Via CLI:**
```bash
render services:restart personupplysning-mcp
```

**When to restart:**
- High memory usage (> 450MB)
- Unresponsive health checks
- After environment variable changes

### 3. Update Environment Variables

**Via Dashboard:**
```
1. Render Dashboard → personupplysning-mcp → Settings
2. Scroll to "Environment Variables"
3. Edit variable value
4. Click "Save Changes"
5. Service auto-restarts
```

**Important:** Service will restart after variable changes!

### 4. Deploy New Version

**Automatic (on git push):**
```bash
git add .
git commit -m "feat: new feature"
git push origin main

# Render auto-deploys in ~5 minutes
```

**Manual:**
```
1. Render Dashboard → personupplysning-mcp
2. Click "Manual Deploy"
3. Select branch
4. Click "Deploy"
```

### 5. Check Service Metrics

**Via Dashboard:**
```
1. Render Dashboard → personupplysning-mcp
2. Click "Metrics" tab
3. View:
   - CPU usage
   - Memory usage
   - Request count
   - Response time
   - Error rate
```

**Key Metrics to Monitor:**
- **CPU:** Should be < 60% average
- **Memory:** Should be < 400MB (512MB limit on Starter)
- **Response Time (p95):** Should be < 2s
- **Error Rate:** Should be < 1%

### 6. Database Queries

**Cache Statistics:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM public.get_cache_stats();

-- Expected output:
-- cache_hit_rate_24h: > 80%
-- cached_company_details: growing over time
-- cached_document_lists: growing over time
```

**Request Analytics:**
```sql
-- Last 24 hours request summary
SELECT
  endpoint,
  COUNT(*) as total_requests,
  AVG(response_time_ms) as avg_response_ms,
  COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / COUNT(*) as cache_hit_rate,
  COUNT(*) FILTER (WHERE status_code >= 400) as error_count
FROM api_request_log
WHERE requested_at > NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY total_requests DESC;
```

**Slow Queries:**
```sql
-- Find queries taking > 1 second
SELECT
  endpoint,
  organisationsidentitet,
  response_time_ms,
  requested_at
FROM api_request_log
WHERE response_time_ms > 1000
  AND requested_at > NOW() - INTERVAL '24 hours'
ORDER BY response_time_ms DESC
LIMIT 20;
```

---

## Incident Response

### INCIDENT: Service Down (HTTP 503)

**Symptoms:**
- Health check returns 503 Service Unavailable
- MCP endpoint not responding
- Render dashboard shows "Unhealthy"

**Diagnosis:**
```bash
# Check service status
render services:get personupplysning-mcp

# Check recent logs
render logs --tail 100 personupplysning-mcp

# Look for:
# - "Error: ECONNREFUSED" → Database connection failed
# - "Out of memory" → Memory limit exceeded
# - "Error: listen EADDRINUSE" → Port already in use
```

**Resolution:**

**1. Database Connection Issue:**
```bash
# Check Supabase status
curl https://thjwryuhtwlfxwduyqqd.supabase.co/rest/v1/

# If down, wait for Supabase recovery
# If up, check credentials:
# - Render Dashboard → Environment Variables
# - Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

**2. Out of Memory:**
```bash
# Immediate: Restart service
render services:restart personupplysning-mcp

# Long-term: Reduce memory usage
# Option A: Lower NODE_OPTIONS
NODE_OPTIONS=--max-old-space-size=320

# Option B: Upgrade to Standard plan (1GB RAM)
```

**3. Port Already in Use:**
```bash
# Restart service (clears port binding)
render services:restart personupplysning-mcp
```

**Escalation:**
- If not resolved in 15 minutes → Open Render Support ticket
- If database issue → Open Supabase Support ticket

---

### INCIDENT: High Error Rate (>5%)

**Symptoms:**
- Metrics show error rate > 5%
- Logs contain frequent error messages
- Cache hit rate drops

**Diagnosis:**
```sql
-- Check error breakdown
SELECT
  status_code,
  endpoint,
  COUNT(*) as error_count
FROM api_request_log
WHERE status_code >= 400
  AND requested_at > NOW() - INTERVAL '1 hour'
GROUP BY status_code, endpoint
ORDER BY error_count DESC;
```

**Common Causes:**

**1. Bolagsverket API Rate Limit (429):**
```sql
-- Check API request count
SELECT COUNT(*)
FROM api_request_log
WHERE endpoint LIKE '%getCompanyDetails%'
  AND cache_hit = false
  AND requested_at > NOW() - INTERVAL '30 days';

-- If > 1000 → Hit monthly limit
```

**Resolution:**
- Wait for rate limit reset (monthly)
- Rely on cached data
- Consider upgrading Bolagsverket API plan

**2. Supabase Connection Pool Exhausted:**
```
Error: too many clients already
```

**Resolution:**
```javascript
// Increase connection pool (requires code change)
// In company-data-service.ts:
const supabase = createClient(url, key, {
  db: { pool: { min: 2, max: 10 } }
})

// Or upgrade Supabase plan
```

**3. Invalid OAuth Token:**
```
Error: 401 Unauthorized
```

**Resolution:**
```bash
# Check Bolagsverket credentials
# Test locally:
curl -X POST https://portal.api.bolagsverket.se/oauth2/token \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=vardefulla-datamangder:read"

# If fails → Regenerate credentials in Bolagsverket portal
```

---

### INCIDENT: Slow Response Times (p95 > 5s)

**Symptoms:**
- Health check takes > 2s
- Timeout errors in logs
- Poor user experience

**Diagnosis:**
```sql
-- Find slowest queries
SELECT
  endpoint,
  MAX(response_time_ms) as max_ms,
  AVG(response_time_ms) as avg_ms,
  COUNT(*) as count
FROM api_request_log
WHERE requested_at > NOW() - INTERVAL '1 hour'
GROUP BY endpoint
ORDER BY max_ms DESC;
```

**Common Causes:**

**1. Missing Database Index:**
```sql
-- Check if indexes are used
SELECT * FROM public.get_index_stats()
WHERE idx_scan = 0
  AND tablename = 'companies';

-- If unused → May need different index
```

**2. Large Result Sets:**
```sql
-- Check for unbounded queries
SELECT
  COUNT(*) as company_count
FROM companies
WHERE organisationsnamn ILIKE '%AB%';

-- If > 10,000 → Need pagination or better filtering
```

**3. Cold Start (First Request):**
- Render free tier spins down after 15 min inactivity
- First request after spin-down takes 30-60s
- Upgrade to Starter or Standard to avoid spin-down

**Resolution:**
- Add missing indexes
- Implement pagination
- Upgrade Render plan
- Enable keep-alive pings

---

### INCIDENT: Cache Not Working

**Symptoms:**
- Cache hit rate < 50%
- Every request hits Bolagsverket API
- High API usage

**Diagnosis:**
```sql
-- Check cache table contents
SELECT
  COUNT(*) as cached_companies,
  MAX(fetched_at) as last_fetch,
  MIN(cache_expires_at) as oldest_expiry
FROM company_details_cache;

-- Expected: Growing count, recent fetches
```

**Common Causes:**

**1. Cache Table Missing:**
```sql
-- Verify table exists
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'company_details_cache';

-- If empty → Run /sql/002-create-cache-tables.sql
```

**2. RLS Blocking Writes:**
```sql
-- Check RLS policies
SELECT * FROM pg_policies
WHERE tablename = 'company_details_cache';

-- Should have policy:
-- "Service write cache" FOR ALL USING (auth.role() = 'service_role')
```

**3. TTL Too Short:**
```javascript
// Check service configuration
// In company-data-service.ts:
this.cacheTTL = (config?.cacheTTLDays || 30) * 24 * 60 * 60 * 1000;

// Should be 30 days (2,592,000,000 ms)
```

**Resolution:**
- Create missing tables
- Fix RLS policies
- Adjust TTL configuration

---

## Performance Tuning

### Database Optimization

**1. Run Weekly Maintenance:**
```sql
-- Optimize tables and refresh stats
SELECT public.optimize_tables();

-- Refresh materialized views
SELECT public.refresh_financial_summary();
```

**2. Find and Drop Unused Indexes:**
```sql
-- Find indexes with 0 scans
SELECT * FROM public.find_unused_indexes();

-- Drop if confirmed unused (backup first!)
DROP INDEX CONCURRENTLY idx_unused_example;
```

**3. Monitor Index Usage:**
```sql
-- Check index effectiveness
SELECT * FROM public.get_index_stats()
ORDER BY idx_scan DESC;

-- Indexes with high scan count are working well
```

### Application Optimization

**1. Memory Management:**
```bash
# Current setting (384MB heap)
NODE_OPTIONS=--max-old-space-size=384

# If memory issues persist:
# - Check for memory leaks in logs
# - Monitor memory growth over time
# - Consider upgrade to Standard plan
```

**2. Connection Pooling:**
```javascript
// Configure Supabase client
const supabase = createClient(url, key, {
  db: {
    pool: {
      min: 2,      // Minimum connections
      max: 10,     // Maximum connections
      idleTimeoutMillis: 30000
    }
  }
})
```

**3. Logging Level:**
```bash
# Production (default)
LOG_LEVEL=info

# Debugging (verbose)
LOG_LEVEL=debug

# Minimal logging (performance)
LOG_LEVEL=warn
```

### Cache Optimization

**1. Adjust TTL for Different Data:**
```javascript
// In company-data-service.ts
const cacheTTL = {
  companyDetails: 30 * 24 * 60 * 60 * 1000,    // 30 days
  documentList: 7 * 24 * 60 * 60 * 1000,       // 7 days
  financialReports: Infinity                    // Never expire
}
```

**2. Cache Warming (Optional):**
```sql
-- Pre-fetch popular companies
-- Run this query to identify top requested companies:
SELECT
  organisationsidentitet,
  COUNT(*) as request_count
FROM api_request_log
WHERE requested_at > NOW() - INTERVAL '30 days'
GROUP BY organisationsidentitet
ORDER BY request_count DESC
LIMIT 100;

-- Then fetch these via API to warm cache
```

---

## Maintenance Tasks

### Daily Tasks (Automated)

**Render:**
- Health checks every 60 seconds
- Automatic restarts on failures
- Log retention: 7 days

**Supabase:**
- Automatic backups at 2 AM UTC
- Log retention: 7 days (free tier), 90 days (Pro)

### Weekly Tasks (Manual - Sunday)

**1. Database Optimization:**
```sql
-- Run maintenance functions
SELECT public.optimize_tables();
SELECT public.refresh_financial_summary();

-- Check execution time (should be < 5 minutes)
```

**2. Performance Review:**
```sql
-- Cache hit rate (target > 80%)
SELECT
  COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / COUNT(*) as hit_rate
FROM api_request_log
WHERE requested_at > NOW() - INTERVAL '7 days';

-- Slow queries (identify and optimize)
SELECT
  endpoint,
  COUNT(*) as slow_count,
  AVG(response_time_ms) as avg_ms
FROM api_request_log
WHERE response_time_ms > 2000
  AND requested_at > NOW() - INTERVAL '7 days'
GROUP BY endpoint
ORDER BY slow_count DESC;
```

**3. Error Review:**
```bash
# Check logs for patterns
render logs --tail 1000 personupplysning-mcp | grep -i error

# Common patterns:
# - Network errors → Check Supabase/Bolagsverket status
# - Memory errors → Consider upgrade
# - Auth errors → Check credentials
```

### Monthly Tasks

**1. Dependency Updates:**
```bash
# Check for updates
npm outdated

# Update dependencies (test locally first!)
npm update
npm audit fix

# Deploy if successful
git commit -am "chore: update dependencies"
git push
```

**2. Security Audit:**
```bash
# Run security audit
npm audit

# Fix vulnerabilities
npm audit fix

# If critical issues, apply patches immediately
```

**3. Cost Review:**
```
Render:
- Starter: $7/month
- Standard: $25/month (if upgraded)

Supabase:
- Pro: $25/month
- Check storage usage (100GB included)
- Check bandwidth usage (unlimited)

Bolagsverket API:
- Free tier: 1000 requests/month
- Check usage in API portal
```

**4. Rotate Credentials:**
```
Every 90 days:
1. Generate new Supabase Service Role Key
2. Generate new Bolagsverket API credentials
3. Update in Render environment variables
4. Verify service still works
5. Revoke old credentials
```

---

## Debugging Guide

### Enable Debug Logging

**Temporarily:**
```bash
# In Render Dashboard → Environment Variables
LOG_LEVEL=debug

# Service auto-restarts
# Check logs for detailed output
```

**Locally:**
```bash
# In .env
LOG_LEVEL=debug
NODE_ENV=development

# Run locally
npm run dev

# Check output for detailed trace
```

### Common Debug Patterns

**1. Database Connection:**
```javascript
// Add to company-data-service.ts (temporarily)
console.log('Supabase URL:', process.env.SUPABASE_URL)
console.log('Supabase Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING')

// Test connection
const { data, error } = await supabase.from('companies').select('count')
console.log('DB Connection:', error ? 'FAILED' : 'SUCCESS')
```

**2. Bolagsverket API:**
```javascript
// Add to bolagsverket-api.ts (temporarily)
console.log('Fetching token...')
const token = await this.getAccessToken()
console.log('Token received:', token.substring(0, 20) + '...')

console.log('Making API request...')
const response = await this.makeAuthenticatedRequest('GET', '/isalive')
console.log('API Response:', response)
```

**3. Cache Behavior:**
```javascript
// Add to company-data-service.ts
console.log('Checking cache for:', organisationsidentitet)
console.log('Cache result:', cached ? 'HIT' : 'MISS')
console.log('Cache expires:', cached?.cache_expires_at)
```

### Log Analysis

**Find Errors:**
```bash
render logs --tail 1000 | grep -i "error"
```

**Find Slow Requests:**
```bash
render logs --tail 1000 | grep "duration.*[5-9][0-9][0-9][0-9]"
# Finds requests > 5000ms
```

**Find Memory Issues:**
```bash
render logs --tail 1000 | grep -i "memory\|heap"
```

---

## Emergency Contacts

**Render Support:**
- Email: support@render.com
- Dashboard: https://dashboard.render.com/support
- Expected response: 24-48 hours (free tier)

**Supabase Support:**
- Email: support@supabase.com
- Dashboard: https://supabase.com/dashboard/support
- Expected response: 24 hours (Pro plan)

**Bolagsverket API:**
- Portal: https://portal.api.bolagsverket.se/
- Support: Contact via portal
- Expected response: 2-5 business days

---

## Additional Resources

- [Render Status Page](https://status.render.com/)
- [Supabase Status Page](https://status.supabase.com/)
- [MCP Protocol Docs](https://modelcontextprotocol.io/)
- [Project Documentation](/docs/)

---

**Last Updated:** 2025-12-01
**Maintained by:** [Your name/team]
**Version:** 1.0
