# Cost Analysis & Optimization

## Executive Summary

**Monthly Operating Cost:** $32 - $57 USD

**Cost Breakdown:**
- Render.com: $7 - $25/month
- Supabase: $25/month
- Bolagsverket API: $0/month (free tier)

**Cost per Request:** $0.0016 - $0.0057 (assuming 1000 requests/month)

---

## Detailed Cost Breakdown

### 1. Hosting - Render.com

#### Starter Plan ($7/month) - RECOMMENDED for initial deployment

**Specifications:**
- 512 MB RAM
- 0.5 CPU (shared)
- 100 GB bandwidth/month
- Automatic SSL
- No cold starts (always on)
- Free subdomain (.onrender.com)

**Suitable for:**
- Traffic: < 5,000 requests/day
- Concurrent users: < 50
- Response time: 1-3s acceptable
- Development/staging environments

**Limitations:**
- Shared CPU (performance varies)
- 512 MB RAM (may need optimization)
- Limited to 1 instance (no auto-scaling)

#### Standard Plan ($25/month) - Upgrade when needed

**Specifications:**
- 2 GB RAM
- 1 CPU (dedicated)
- 100 GB bandwidth/month
- Automatic SSL
- Custom domains (1 free)
- Zero-downtime deploys

**Suitable for:**
- Traffic: < 50,000 requests/day
- Concurrent users: < 500
- Response time: < 1s required
- Production with SLA requirements

**When to upgrade:**
- Memory usage consistently > 400 MB
- CPU usage > 70%
- Response time p95 > 3s
- Need auto-scaling
- Need dedicated resources

#### Pro Plan ($85/month) - Future scaling

**Specifications:**
- 8 GB RAM
- 2 CPUs (dedicated)
- 500 GB bandwidth/month
- Horizontal auto-scaling (up to 10 instances)
- Advanced metrics
- Priority support

**Suitable for:**
- Traffic: > 50,000 requests/day
- High availability requirements
- Need horizontal scaling

**Not needed unless:**
- Traffic exceeds 100k requests/day
- Need 99.9% SLA
- Multiple geographic regions

### 2. Database - Supabase

#### Free Plan ($0/month) - NOT RECOMMENDED for production

**Specifications:**
- 500 MB database
- 1 GB bandwidth
- 2 GB file storage
- Community support
- Pauses after 1 week inactivity

**Why NOT suitable:**
- Database pauses (unacceptable for production)
- 500 MB too small (current: ~500 MB for 1.88M companies)
- No pooler (connection limits)
- No daily backups

#### Pro Plan ($25/month) - RECOMMENDED

**Specifications:**
- 8 GB database (auto-scales)
- 100 GB bandwidth
- 100 GB file storage
- No pausing
- Daily backups (7 day retention)
- Database branching
- Connection pooler
- Email support

**Current Usage Estimate:**
- Database: ~600 MB (1.88M companies + indexes)
- Bandwidth: ~5-10 GB/month (assuming 1000-2000 requests/day)
- Storage: ~1-5 GB (for cached annual reports)

**Suitable for:**
- All production deployments
- Up to 100k requests/day
- Database size < 8 GB

**When to upgrade to Team ($599/month):**
- Database > 8 GB
- Need 99.95% SLA
- Need read replicas
- Need advanced security features

### 3. External APIs - Bolagsverket

#### Free Tier ($0/month) - Current usage

**Specifications:**
- 1,000 API calls/month
- OAuth2 authentication
- All endpoints included
- Community support

**Current Usage:**
With 80% cache hit rate:
- 1,000 requests/month → 200 API calls
- 5,000 requests/month → 1,000 API calls (at limit!)

**When cache is cold (first month):**
- Every unique company lookup = 1 API call
- Document list per company = 1 API call
- Annual report download = 1 API call

**Estimation:**
- Month 1 (cold cache): ~800-1000 API calls
- Month 2+ (warm cache): ~100-300 API calls

#### Paid Tier (Contact for pricing) - Future upgrade

**When needed:**
- Consistently hitting 1,000 call/month limit
- Need higher rate limits
- Need SLA guarantees
- Need dedicated support

**Contact:** https://portal.api.bolagsverket.se/

---

## Cost Projections

### Scenario 1: Low Traffic (100-500 requests/day)

**Monthly Costs:**
```
Render (Starter):        $7
Supabase (Pro):         $25
Bolagsverket (Free):     $0
────────────────────────────
Total:                  $32/month
```

**Cost per Request:** $0.0021 - $0.0107 (depending on volume)

**Recommended for:**
- Internal tools
- Proof of concept
- Limited user base (< 50 users)

### Scenario 2: Medium Traffic (500-2000 requests/day)

**Monthly Costs:**
```
Render (Standard):      $25
Supabase (Pro):         $25
Bolagsverket (Free):     $0
────────────────────────────
Total:                  $50/month
```

**Cost per Request:** $0.0008 - $0.0033

**Recommended for:**
- Small business applications
- Department-wide tools
- 50-200 users

### Scenario 3: High Traffic (2000-10,000 requests/day)

**Monthly Costs:**
```
Render (Standard):      $25
Supabase (Pro):         $25
Bolagsverket (Paid):    $??  (TBD based on volume)
────────────────────────────
Total:                  $50+ /month
```

**Cost per Request:** $0.0008+

**Requires:**
- Paid Bolagsverket API plan
- Potentially Supabase Team plan ($599/month)

**Recommended for:**
- Production SaaS applications
- High-availability requirements
- 200+ concurrent users

---

## Cost Optimization Strategies

### 1. Cache Optimization (HIGHEST IMPACT)

**Current Strategy:**
- Company details: 30 days TTL
- Document lists: 7 days TTL
- Annual reports: permanent cache

**Optimization:**

**Increase TTL for stable data:**
```javascript
// Company details change rarely
cacheTTL: 90 days  // Was: 30 days
// Saves ~66% of API calls
```

**Pre-warm cache for popular companies:**
```sql
-- Identify most-requested companies
SELECT organisationsidentitet, COUNT(*) as requests
FROM api_request_log
GROUP BY organisationsidentitet
ORDER BY requests DESC
LIMIT 100;

-- Fetch these proactively during low-traffic hours
```

**Expected Savings:**
- API calls: -50% to -70%
- Response time: -30% to -50%
- Bolagsverket costs: $0 (stay in free tier longer)

### 2. Database Optimization

**Index Optimization:**
```sql
-- Drop unused indexes (saves storage + write performance)
SELECT * FROM find_unused_indexes();

-- Expected: Drop 2-3 unused indexes
-- Savings: ~50-100 MB storage, 10-20% faster writes
```

**Query Optimization:**
```sql
-- Use covering indexes for hot queries
CREATE INDEX CONCURRENTLY idx_companies_search_optimized
ON companies(organisationsnamn text_pattern_ops)
INCLUDE (organisationsidentitet, organisationsform, status);

-- Reduces query time from 200ms to 20ms
```

**Connection Pooling:**
```javascript
// Reduce connection overhead
const supabase = createClient(url, key, {
  db: { pool: { min: 2, max: 10 } }
});

// Savings: ~20% faster queries, lower CPU
```

**Expected Savings:**
- Query performance: +30%
- Database CPU: -20%
- Potential to delay Supabase upgrade: 6-12 months

### 3. Render Instance Optimization

**Memory Management:**
```bash
# Current: 384 MB heap limit
NODE_OPTIONS=--max-old-space-size=384

# Optimize for Starter plan (512 MB total)
NODE_OPTIONS=--max-old-space-size=320

# Leaves 192 MB for OS and buffers
```

**Code Optimization:**
```javascript
// Stream large responses instead of loading into memory
async getAnnualReport() {
  // Before: Load entire file into memory (10-50 MB)
  const buffer = await this.bolagsverket.getDocument(id);

  // After: Stream to Supabase Storage
  const stream = await this.bolagsverket.getDocumentStream(id);
  await this.supabase.storage.upload(path, stream);
}

// Savings: -50 MB peak memory
```

**Expected Savings:**
- Memory headroom: +30%
- Delay upgrade to Standard plan: 3-6 months
- Cost savings: $18/month × 3-6 months = $54-108

### 4. Bandwidth Optimization

**Compress API Responses:**
```javascript
// Enable gzip compression
app.use(compression());

// Savings: -60% bandwidth
```

**Pagination:**
```javascript
// Don't return all 1.88M companies
searchCompanies(query, limit = 10) {
  // Before: Potential to return thousands
  // After: Max 10 (configurable up to 100)
}

// Savings: -90% response size
```

**Expected Savings:**
- Bandwidth: -50% to -70%
- Response time: -20% to -30%
- Future-proof for higher Render tiers (bandwidth included)

### 5. Monitoring & Alerting (Prevent Costly Incidents)

**Early Warning Alerts:**
- API limit warning at 800/1000 calls
- Memory warning at 400/512 MB
- Database size warning at 7/8 GB

**Prevent:**
- Unexpected API overage charges
- Service crashes (lost requests)
- Emergency upgrades (no time to optimize)

**Expected Savings:**
- Avoided downtime: $0-1000+ (depending on business impact)
- Avoided emergency upgrades: $0-50/month

---

## Monthly Cost Tracking Template

```markdown
## Costs for: [Month YYYY-MM]

### Services
- Render Plan: [Starter/Standard/Pro]  $___
- Supabase Plan: [Pro/Team]            $___
- Bolagsverket API: [Free/Paid]        $___
- Other (monitoring, etc.):            $___
                                       ─────
**Total:**                             $___

### Usage Metrics
- Total Requests: ___
- Unique Companies: ___
- Bolagsverket API Calls: ___ / 1,000
- Database Size: ___ MB / 8 GB
- Bandwidth: ___ GB / 100 GB
- Storage: ___ GB / 100 GB

### Cost per Request: $___.____

### Notes:
[Any anomalies, optimization opportunities, or upcoming changes]

### Action Items:
- [ ] [Optimization task 1]
- [ ] [Optimization task 2]
```

---

## ROI Analysis

### Cost vs. Alternative Solutions

**Option 1: Current Setup (Render + Supabase + Bolagsverket)**
- Monthly: $32-50
- Setup time: 4-8 hours
- Maintenance: 2-4 hours/month
- Scalability: Excellent

**Option 2: Self-hosted (VPS + PostgreSQL + Bolagsverket)**
- VPS (DigitalOcean): $12-24/month
- Managed PostgreSQL: $15-30/month
- Backup storage: $5/month
- **Total: $32-59/month**
- Setup time: 20-40 hours
- Maintenance: 8-16 hours/month
- Scalability: Manual

**Option 3: Serverless (AWS Lambda + RDS + API Gateway)**
- Lambda: $0-20/month (depending on traffic)
- RDS (smallest): $15-30/month
- API Gateway: $3.50 per million requests
- **Total: $18-50/month**
- Setup time: 12-24 hours
- Maintenance: 4-8 hours/month
- Scalability: Automatic (expensive at scale)

**Conclusion:** Current setup offers best balance of:
- ✅ Low initial cost
- ✅ Minimal maintenance
- ✅ Easy scaling
- ✅ Built-in backups/monitoring
- ✅ No infrastructure management

---

## Budget Planning

### Year 1 Projection

**Months 1-3: Startup Phase**
```
Render (Starter):    $7  × 3 = $21
Supabase (Pro):     $25  × 3 = $75
                            ────
Subtotal:                   $96
```

**Months 4-12: Growth Phase**
```
Render (Standard):  $25  × 9 = $225
Supabase (Pro):     $25  × 9 = $225
                            ────
Subtotal:                  $450
```

**Year 1 Total: $546**

**Per-request cost (assuming 50k requests/year):** $0.011

### Year 2 Projection (With Growth)

**Assuming 3x traffic growth:**

```
Render (Standard):  $25  × 12 = $300
Supabase (Pro):     $25  × 12 = $300
Bolagsverket (Paid): Estimated $50/month × 12 = $600
                            ────
Year 2 Total:             $1,200
```

**Per-request cost (assuming 150k requests/year):** $0.008

---

## Cost Alerts & Thresholds

### Set Up Billing Alerts

**Render:**
```
Dashboard → Billing → Set Alert
- Alert at: $50/month (if on Starter, unexpected upgrade)
- Alert at: $100/month (if on Standard, unexpected overage)
```

**Supabase:**
```
Dashboard → Billing → Usage Alerts
- Database size: 7 GB / 8 GB (87%)
- Bandwidth: 80 GB / 100 GB (80%)
- Storage: 80 GB / 100 GB (80%)
```

**Bolagsverket API:**
```
Custom monitoring via sql:
SELECT COUNT(*) FROM api_request_log
WHERE cache_hit = false
  AND requested_at > DATE_TRUNC('month', NOW());

Alert if > 800 calls in current month
```

---

## Optimization Checklist

**Monthly Review:**
- [ ] Check actual costs vs. budget
- [ ] Review Bolagsverket API usage (< 800/1000?)
- [ ] Check database size growth
- [ ] Identify optimization opportunities
- [ ] Update cost projections

**Quarterly Review:**
- [ ] Analyze cost per request trend
- [ ] Review cache hit rate (optimize TTL if needed)
- [ ] Consider plan upgrades/downgrades
- [ ] Benchmark against alternatives
- [ ] Update year-end projections

**Annual Review:**
- [ ] Calculate total cost of ownership
- [ ] ROI analysis
- [ ] Budget planning for next year
- [ ] Evaluate alternative solutions
- [ ] Negotiate better rates (if high volume)

---

## Additional Resources

- [Render Pricing](https://render.com/pricing)
- [Supabase Pricing](https://supabase.com/pricing)
- [Bolagsverket API Portal](https://portal.api.bolagsverket.se/)
- [Cost Optimization Best Practices](https://www.render.com/docs/cost-optimization)

---

**Last Updated:** 2025-12-01
**Next Review:** 2025-01-01
