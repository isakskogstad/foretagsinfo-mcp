# Monitoring & Observability Strategy

## Overview

This document outlines the comprehensive monitoring strategy for the Personupplysning MCP Server in production.

---

## Monitoring Stack

### Layer 1: Infrastructure (Render.com)

**Built-in Metrics:**
- CPU usage (%)
- Memory usage (MB)
- Request count (per minute)
- Response time (p50, p95, p99)
- Error rate (%)
- Deployment status

**Access:** Render Dashboard → Metrics

**Retention:** 30 days

### Layer 2: Application (MCP Server)

**Structured Logging (Pino):**
```javascript
// Every request logged with:
{
  requestId: "uuid",
  toolName: "search_companies",
  args: { query: "Spotify", limit: 10 },
  duration: 234,
  status: "success"
}
```

**Custom Events:**
- Tool execution (start, end, error)
- Resource read operations
- Cache hits/misses
- API calls (Bolagsverket)

**Access:** Render Logs

**Retention:** 7 days

### Layer 3: Database (Supabase)

**Request Logging Table:**
```sql
CREATE TABLE api_request_log (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  organisationsidentitet TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  cache_hit BOOLEAN DEFAULT FALSE,
  requested_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Metrics Tracked:**
- Request count by endpoint
- Response time distribution
- Cache hit rate
- Error count by status code
- Database query performance

**Access:** Supabase Dashboard → Database → SQL Editor

**Retention:** 90 days (configurable)

### Layer 4: External APIs

**Bolagsverket API Monitoring:**
- OAuth token expiration tracking
- API call count (rate limit monitoring)
- Response time tracking
- Error rate (401, 429, 5xx)

---

## Key Metrics & SLIs

### Service Level Indicators (SLIs)

**1. Availability**
- **Metric:** Health check success rate
- **Target:** 99.5% uptime (3.6 hours downtime/month)
- **Measurement:** Render health checks (60s interval)

**2. Latency**
- **Metric:** Response time p95
- **Target:** < 2 seconds for cached requests
- **Target:** < 5 seconds for API requests
- **Measurement:** `api_request_log.response_time_ms`

**3. Error Rate**
- **Metric:** HTTP 5xx errors / total requests
- **Target:** < 0.5%
- **Measurement:** `api_request_log.status_code`

**4. Cache Effectiveness**
- **Metric:** Cache hit rate
- **Target:** > 80% after warm-up
- **Measurement:** `api_request_log.cache_hit`

---

## Dashboard Configuration

### Render Metrics Dashboard

**Default Graphs (Built-in):**

1. **CPU Usage**
   - Line chart, last 24 hours
   - Alert if > 80% for 15 minutes

2. **Memory Usage**
   - Line chart, last 24 hours
   - Alert if > 450MB (90% of 512MB limit)

3. **Request Rate**
   - Bar chart, requests per minute
   - Alert if spike > 10x average

4. **Response Time**
   - Line chart with p50, p95, p99
   - Alert if p95 > 5 seconds

5. **Error Rate**
   - Line chart, percentage
   - Alert if > 5%

### Custom SQL Dashboard (Supabase)

Create saved queries for regular monitoring:

**Query 1: Request Summary (Last 24h)**
```sql
CREATE OR REPLACE VIEW request_summary_24h AS
SELECT
  endpoint,
  COUNT(*) as total_requests,
  AVG(response_time_ms) as avg_response_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_ms,
  COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / COUNT(*) as cache_hit_rate,
  COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
  COUNT(*) FILTER (WHERE status_code >= 500) as server_error_count
FROM api_request_log
WHERE requested_at > NOW() - INTERVAL '24 hours'
GROUP BY endpoint;
```

**Query 2: Cache Performance**
```sql
CREATE OR REPLACE VIEW cache_performance AS
SELECT
  'Company Details' as cache_type,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE cache_expires_at > NOW()) as active_entries,
  AVG(fetch_count) as avg_fetch_count,
  MAX(fetched_at) as last_update
FROM company_details_cache
UNION ALL
SELECT
  'Document Lists',
  COUNT(*),
  COUNT(*) FILTER (WHERE cache_expires_at > NOW()),
  AVG(fetch_count),
  MAX(fetched_at)
FROM company_documents_cache
UNION ALL
SELECT
  'Financial Reports',
  COUNT(*),
  COUNT(*),  -- Always active (no expiry)
  NULL,
  MAX(created_at)
FROM financial_reports;
```

**Query 3: Error Analysis**
```sql
CREATE OR REPLACE VIEW error_analysis_24h AS
SELECT
  status_code,
  endpoint,
  COUNT(*) as error_count,
  MAX(requested_at) as last_occurrence,
  ARRAY_AGG(DISTINCT organisationsidentitet) FILTER (WHERE organisationsidentitet IS NOT NULL) as affected_companies
FROM api_request_log
WHERE status_code >= 400
  AND requested_at > NOW() - INTERVAL '24 hours'
GROUP BY status_code, endpoint
ORDER BY error_count DESC;
```

**Query 4: Slow Queries**
```sql
CREATE OR REPLACE VIEW slow_queries_24h AS
SELECT
  endpoint,
  organisationsidentitet,
  response_time_ms,
  cache_hit,
  requested_at
FROM api_request_log
WHERE response_time_ms > 2000
  AND requested_at > NOW() - INTERVAL '24 hours'
ORDER BY response_time_ms DESC
LIMIT 50;
```

**Query 5: Bolagsverket API Usage**
```sql
CREATE OR REPLACE VIEW bolagsverket_api_usage AS
SELECT
  DATE_TRUNC('day', requested_at) as day,
  COUNT(*) FILTER (WHERE cache_hit = false) as api_calls,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status_code = 429) as rate_limit_hits,
  AVG(response_time_ms) FILTER (WHERE cache_hit = false) as avg_api_response_ms
FROM api_request_log
WHERE endpoint IN ('getCompanyDetails', 'getDocumentList', 'getAnnualReport')
  AND requested_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', requested_at)
ORDER BY day DESC;
```

### Save these views in Supabase

```sql
-- Run these in Supabase SQL Editor to create persistent views
-- They'll appear in the dashboard for easy querying
```

---

## Alerting Configuration

### Critical Alerts (Immediate Response Required)

**1. Service Down**
- **Condition:** Health check fails 3 consecutive times
- **Channel:** Email + SMS
- **Response Time:** 5 minutes
- **Action:** Check OPERATIONS-RUNBOOK.md "Service Down" section

**2. High Error Rate**
- **Condition:** Error rate > 10% for 5 minutes
- **Channel:** Email
- **Response Time:** 15 minutes
- **Action:** Investigate logs, check database connection

**3. Memory Exhaustion**
- **Condition:** Memory > 480MB (95% of limit)
- **Channel:** Email
- **Response Time:** 15 minutes
- **Action:** Restart service, consider upgrade

**4. Database Connection Lost**
- **Condition:** All database queries failing
- **Channel:** Email + SMS
- **Response Time:** 5 minutes
- **Action:** Check Supabase status, verify credentials

### Warning Alerts (Investigation Required)

**1. High Response Time**
- **Condition:** p95 > 5s for 15 minutes
- **Channel:** Email
- **Response Time:** 1 hour
- **Action:** Run slow query analysis

**2. Low Cache Hit Rate**
- **Condition:** Cache hit rate < 50% for 1 hour
- **Channel:** Email
- **Response Time:** 4 hours
- **Action:** Investigate cache configuration

**3. API Rate Limit Warning**
- **Condition:** > 800 Bolagsverket API calls in 30 days
- **Channel:** Email
- **Response Time:** 24 hours
- **Action:** Review API usage, optimize caching

**4. High CPU Usage**
- **Condition:** CPU > 70% for 30 minutes
- **Channel:** Email
- **Response Time:** 4 hours
- **Action:** Check for runaway processes

### Info Alerts (Awareness Only)

**1. Deployment Success/Failure**
- **Channel:** Email
- **Response Time:** N/A
- **Action:** Verify deployment if failed

**2. Daily Summary**
- **Schedule:** 9 AM UTC daily
- **Channel:** Email
- **Content:**
  - Total requests (24h)
  - Error count
  - Cache hit rate
  - p95 response time
  - Bolagsverket API usage

---

## Alert Setup Guide

### Render Notifications

**1. Enable Email Notifications:**
```
Render Dashboard → Account Settings → Notifications
✓ Deployment failures
✓ Service crashes
✓ Health check failures
```

**2. Add Team Members:**
```
Render Dashboard → Team
Add emails for:
- On-call engineer
- Team lead
- Backup contact
```

### Supabase Alerts (via Webhooks)

**Option 1: Use Supabase Edge Functions**

Create an Edge Function to check metrics and send alerts:

```typescript
// supabase/functions/check-metrics/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Check error rate
  const { data: errors } = await supabase
    .from('api_request_log')
    .select('*', { count: 'exact', head: true })
    .gte('status_code', 500)
    .gte('requested_at', new Date(Date.now() - 3600000).toISOString())

  const errorRate = (errors?.count || 0) / 100  // Assume ~100 req/hour

  if (errorRate > 0.1) {
    // Send alert (implement your alert mechanism)
    await fetch('https://your-alert-webhook.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert: 'High Error Rate',
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
        timestamp: new Date().toISOString()
      })
    })
  }

  return new Response('OK')
})
```

**Schedule with pg_cron:**
```sql
-- Run every 5 minutes
SELECT cron.schedule(
  'check-metrics',
  '*/5 * * * *',
  $$ SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/check-metrics',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) $$
);
```

### External Uptime Monitoring

**Recommended: UptimeRobot (Free Tier)**

1. Sign up: https://uptimerobot.com/
2. Add HTTP(s) monitor:
   - URL: `https://personupplysning-mcp.onrender.com/health`
   - Interval: 5 minutes
   - Alert contacts: Your email
3. Expected response:
   - Status: 200 OK
   - Keyword: `"healthy"`

**Alternative: Pingdom, StatusCake, or custom monitoring**

---

## Log Retention & Analysis

### Log Levels

**Production (Default):**
```bash
LOG_LEVEL=info
```

Logs:
- Info: Tool executions, cache hits/misses
- Warn: Retry attempts, slow queries
- Error: Failed requests, exceptions

**Debug Mode (Temporary):**
```bash
LOG_LEVEL=debug
```

Logs everything including:
- Database queries
- API request/response details
- Cache lookups

**Performance Mode:**
```bash
LOG_LEVEL=warn
```

Only logs warnings and errors.

### Log Analysis Queries

**Find patterns in Render logs:**

```bash
# Download last 7 days logs
render logs --tail 10000 > logs.txt

# Analysis examples:
grep "Error:" logs.txt | sort | uniq -c
grep "duration" logs.txt | awk '{print $NF}' | sort -n | tail -20
grep "cache_hit" logs.txt | grep -c "true"
```

### Long-term Log Storage (Optional)

For logs > 7 days, integrate with:

**Option 1: Log Aggregation Service**
- Logtail (formerly Timber.io)
- Papertrail
- Datadog Logs

**Option 2: Custom Storage**
- Stream logs to Supabase table
- Store in S3 bucket
- Export to BigQuery for analysis

---

## Performance Baselines

### Expected Performance (After Warm-up)

| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| **Health check** | < 100ms | < 500ms | > 1s |
| **Search companies (cached)** | < 200ms | < 1s | > 2s |
| **Company details (cached)** | < 100ms | < 500ms | > 1s |
| **Company details (API)** | < 2s | < 5s | > 10s |
| **Document list (API)** | < 3s | < 8s | > 15s |
| **Annual report download** | < 5s | < 15s | > 30s |

### Resource Usage Baselines

| Resource | Idle | Normal | Peak | Limit |
|----------|------|--------|------|-------|
| **CPU** | 5-10% | 20-40% | 60-80% | 100% |
| **Memory** | 150MB | 250MB | 400MB | 512MB |
| **Requests/min** | 0 | 5-20 | 50-100 | 1000 |

### Database Performance

| Query | Target | Acceptable | Critical |
|-------|--------|------------|----------|
| **Full-text search** | < 50ms | < 200ms | > 500ms |
| **Index lookup** | < 10ms | < 50ms | > 100ms |
| **Cache insert** | < 50ms | < 200ms | > 500ms |
| **Join query** | < 100ms | < 500ms | > 1s |

---

## Reporting

### Daily Report (Automated)

**Email sent at 9 AM UTC:**

```
Subject: [Personupplysning MCP] Daily Report - 2025-12-01

Summary (Last 24 hours):
- Total Requests: 1,234
- Error Count: 5 (0.4%)
- Cache Hit Rate: 87.3%
- p95 Response Time: 1.2s
- API Calls (Bolagsverket): 156/1000 monthly limit
- Uptime: 99.8%

Top 5 Endpoints:
1. search_companies - 567 requests
2. get_company_details - 423 requests
3. get_company_documents - 178 requests
4. get_annual_report - 45 requests
5. get_cache_stats - 21 requests

Errors:
- 401 Unauthorized: 3 (token refresh needed)
- 503 Service Unavailable: 2 (database connection)

Action Items:
- Investigate database connection drops
- Monitor token refresh logic

Full details: https://dashboard.render.com/
```

### Weekly Report (Manual)

**Run every Sunday:**

```sql
-- Generate weekly summary
SELECT
  'Week of ' || DATE_TRUNC('week', NOW() - INTERVAL '7 days') as period,
  COUNT(*) as total_requests,
  COUNT(DISTINCT organisationsidentitet) as unique_companies,
  AVG(response_time_ms) as avg_response_ms,
  COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / COUNT(*) as cache_hit_rate,
  COUNT(*) FILTER (WHERE status_code >= 400) as total_errors,
  COUNT(*) FILTER (WHERE cache_hit = false AND endpoint IN ('getCompanyDetails', 'getDocumentList', 'getAnnualReport')) as api_calls
FROM api_request_log
WHERE requested_at > NOW() - INTERVAL '7 days';
```

### Monthly Report (Manual)

**Run first of each month:**

```sql
-- Generate monthly summary
SELECT
  TO_CHAR(DATE_TRUNC('month', NOW() - INTERVAL '1 month'), 'YYYY-MM') as month,
  COUNT(*) as total_requests,
  COUNT(DISTINCT organisationsidentitet) as unique_companies,
  COUNT(*) FILTER (WHERE cache_hit = false) as api_calls,
  SUM(response_time_ms) / 1000 / 60 as total_processing_minutes,
  (SELECT COUNT(*) FROM company_details_cache) as cached_companies,
  (SELECT COUNT(*) FROM financial_reports) as stored_reports
FROM api_request_log
WHERE requested_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
  AND requested_at < DATE_TRUNC('month', NOW());
```

**Include:**
- Cost breakdown (Render + Supabase + API)
- Performance trends
- Growth metrics
- Optimization recommendations

---

## Continuous Improvement

### Monthly Review Checklist

- [ ] Review performance baselines (still accurate?)
- [ ] Analyze slow queries (any new patterns?)
- [ ] Check unused indexes (any to drop?)
- [ ] Review error patterns (any recurring issues?)
- [ ] Update alert thresholds (too sensitive/loose?)
- [ ] Check capacity planning (need to upgrade?)

### Quarterly Goals

**Q1 2025:**
- Establish baseline metrics
- Implement all monitoring queries
- Set up external uptime monitoring
- Document all alerts

**Q2 2025:**
- Optimize cache TTL based on data
- Implement automated reporting
- Set up log aggregation (optional)
- Review and adjust SLIs

**Q3 2025:**
- Machine learning anomaly detection (optional)
- Advanced analytics dashboard (optional)
- Predictive scaling (if needed)

---

## Additional Resources

- [Render Metrics Docs](https://render.com/docs/metrics)
- [Supabase Logs Docs](https://supabase.com/docs/guides/platform/logs)
- [Pino Logging Best Practices](https://getpino.io/)
- [SLI/SLO Guide](https://sre.google/sre-book/service-level-objectives/)

---

**Last Updated:** 2025-12-01
**Next Review:** 2025-02-01
