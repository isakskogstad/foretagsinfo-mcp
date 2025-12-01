# Personupplysning MCP Server - Remediation Guide

**Date:** 2025-12-01
**Priority:** HIGH/MEDIUM issues identified in audit

---

## Quick Fix Summary

### 🔴 HIGH Priority (Fix This Week)

**4 HIGH severity XSS vulnerabilities + 5 MEDIUM validation issues**

**Estimated Time:** 3-4 hours total

---

## Fix #1: XSS Filter Enhancement (30 minutes)

### Issue
Current XSS filter in `src/utils/validators.ts` does not detect:
- `onload=` events
- `onfocus=` events
- SVG-based XSS
- Inline JavaScript expressions

### Solution

**File:** `src/utils/validators.ts`
**Lines:** 52-55

**BEFORE:**
```typescript
.refine(
  (val) => !/<script|javascript:|onerror=|onclick=/i.test(val),
  'Invalid characters detected in search query'
)
```

**AFTER:**
```typescript
.refine(
  (val) => !/(<script|javascript:|on\w+=|<iframe|<svg|<embed|<object|eval\(|atob\()/i.test(val),
  'Potentially dangerous patterns detected in search query'
)
```

### Test

```bash
# Run security tests to verify fix
npx tsx testing-audit/security-tests.ts
```

**Expected:** All 10 XSS tests should now pass

---

## Fix #2: Organization Number Validation (2 hours)

### Issue
Luhn checksum algorithm has 4 edge cases failing:
- Valid numbers rejected: `5560001712`, `556000-1712`
- Invalid numbers accepted: `0000000000`, `9999999999`

### Solution Option A: Use External Library (Recommended)

```bash
npm install personnummer
```

**File:** `src/utils/validators.ts`

```typescript
import { personnummer } from 'personnummer';

export const OrganisationsnummerSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$|^\d{6}-\d{4}$/, 'Invalid format')
  .transform((val) => val.replace(/[^0-9]/g, ''))
  .refine((val) => {
    try {
      // personnummer library validates Swedish org numbers
      return personnummer.valid(val);
    } catch {
      return false;
    }
  }, 'Invalid Swedish organization number');
```

### Solution Option B: Fix Luhn Algorithm

Research the correct implementation for Swedish organizational numbers. The current alternating pattern may need adjustment.

**Test fixtures to add:**

```typescript
// Known valid org numbers (test against Bolagsverket API)
const VALID_ORG_NUMBERS = [
  '5560001712', // Spotify
  '5560743089', // IKEA
  '5560283201', // H&M
];

// Known invalid checksums
const INVALID_ORG_NUMBERS = [
  '5560001713', // Wrong checksum
  '0000000000', // All zeros
  '9999999999', // All nines
];
```

### Test

```bash
# Run validation tests
npx tsx -e "
import { OrganisationsnummerSchema } from './src/utils/validators.js';

const tests = [
  { input: '5560001712', expected: true },
  { input: '556000-1712', expected: true },
  { input: '0000000000', expected: false },
  { input: '9999999999', expected: false },
];

tests.forEach(t => {
  try {
    const result = OrganisationsnummerSchema.parse(t.input);
    console.log(\`✅ \${t.input}: \${t.expected ? 'PASS' : 'FAIL (should reject)'}\`);
  } catch (e) {
    console.log(\`✅ \${t.input}: \${!t.expected ? 'PASS' : 'FAIL (should accept)'}\`);
  }
});
"
```

---

## Fix #3: Database Query Performance (1 hour)

### Issue
Local search P95 latency: 4,279ms (target: <100ms)

### Solution

**Step 1: Add Full-Text Search Index**

Create file: `sql/004-create-search-index.sql`

```sql
-- Full-text search index for Swedish company names
CREATE INDEX idx_companies_name_tsvector ON companies
USING gin(to_tsvector('swedish', organisationsnamn));

-- Analyze table for optimal query planning
ANALYZE companies;
```

**Step 2: Run Migration**

```bash
# Connect to Supabase and run migration
psql $SUPABASE_URL -f sql/004-create-search-index.sql
```

**Step 3: Update Query (Optional)**

If you want to use the index explicitly:

**File:** `src/services/company-data-service.ts` (line 314-318)

**BEFORE:**
```typescript
.or(`organisationsnamn.ilike.%${query}%,organisationsidentitet.eq.${query}`)
```

**AFTER:**
```typescript
.or(`organisationsnamn.ilike.%${query}%,organisationsidentitet.eq.${query}`)
// Note: Supabase will automatically use the index for ILIKE queries
```

### Test

```bash
# Run performance tests
npx tsx testing-audit/performance-tests.ts
```

**Expected:** P95 should drop below 200ms (with index)

---

## Fix #4: HTTP Authentication (Optional - 2 hours)

### Issue
HTTP endpoint at `/mcp` has no authentication

### Solution

**Step 1: Add Environment Variable**

`.env`:
```bash
MCP_API_KEY=your-secure-random-key-here-min-32-chars
```

**Step 2: Add Middleware**

**File:** `src/index.ts` (insert after line 757, before SSE connection)

```typescript
// MCP endpoint - Supports both GET (SSE) and POST (JSON-RPC)
if (req.url === '/mcp') {
  // Authenticate request
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.MCP_API_KEY;

  if (!expectedKey) {
    logger.warn('MCP_API_KEY not configured - authentication disabled');
  } else if (apiKey !== expectedKey) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Unauthorized',
      message: 'Valid API key required in X-API-Key header'
    }));
    return;
  }

  // ... rest of existing code
```

**Step 3: Update Documentation**

Update `README.md` with authentication instructions:

```markdown
## HTTP Transport Authentication

When using HTTP transport, include your API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-key-here" \
  https://personupplysning-mcp.onrender.com/mcp
```
```

### Test

```bash
# Test unauthorized request
curl -v https://personupplysning-mcp.onrender.com/mcp
# Expected: 401 Unauthorized

# Test authorized request
curl -v -H "X-API-Key: your-key-here" \
  https://personupplysning-mcp.onrender.com/mcp
# Expected: 200 OK (SSE connection)
```

---

## Fix #5: Rate Limiting (Optional - 2 hours)

### Issue
No rate limiting on HTTP endpoint

### Solution

**Step 1: Install Dependency**

```bash
npm install express-rate-limit
```

**Step 2: Add Rate Limiter**

**File:** `src/index.ts`

```typescript
import rateLimit from 'express-rate-limit';

// Add near top of file
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per 15 minutes
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});
```

**Step 3: Apply to HTTP Server**

```typescript
async function startHTTPServer() {
  const PORT = parseInt(process.env.PORT || '3000');
  const HOST = process.env.HOST || '0.0.0.0';

  const httpServer = http.createServer(async (req, res) => {
    // Apply rate limiting
    const rateLimitMiddleware = limiter(req, res, () => {});
    if (rateLimitMiddleware === false) {
      return; // Rate limit exceeded, already handled by limiter
    }

    // ... rest of existing code
```

### Test

```bash
# Send 101 requests in quick succession
for i in {1..101}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "X-API-Key: your-key" \
    https://personupplysning-mcp.onrender.com/health
done

# First 100 should return 200
# 101st should return 429 (Too Many Requests)
```

---

## Deployment Checklist

### Before Deploying Fixes

- [ ] Create backup of current production code
- [ ] Run all tests locally
- [ ] Verify TypeScript compilation: `npm run build`
- [ ] Test in development environment
- [ ] Update environment variables (if adding API key)

### Deployment Steps

1. **Backup Production**
   ```bash
   mkdir -p backups/session-start/2025-12-01_pre-security-fixes
   cp -r src/ backups/session-start/2025-12-01_pre-security-fixes/
   ```

2. **Apply Fixes**
   - Fix #1: XSS filter (required)
   - Fix #2: Org number validation (required)
   - Fix #3: Database index (recommended)
   - Fix #4: HTTP auth (optional)
   - Fix #5: Rate limiting (optional)

3. **Test**
   ```bash
   npm run build
   npx tsx testing-audit/security-tests.ts
   ./testing-audit/smoke-test.sh
   ```

4. **Deploy**
   ```bash
   git add .
   git commit -m "security: Fix XSS vulnerabilities and validation issues"
   git push origin main
   # Render will auto-deploy
   ```

5. **Verify Production**
   ```bash
   curl https://personupplysning-mcp.onrender.com/health
   # Should return {"status":"healthy",...}
   ```

### After Deployment

- [ ] Monitor logs for errors
- [ ] Verify cache statistics
- [ ] Test search functionality
- [ ] Check performance metrics
- [ ] Re-run security tests against production

---

## Rollback Procedure

If issues arise after deployment:

```bash
# Revert to previous version
git revert HEAD
git push origin main

# Or restore from backup
cp -r backups/session-start/2025-12-01_pre-security-fixes/src/ src/
npm run build
git add .
git commit -m "rollback: Restore previous version"
git push origin main
```

---

## Monitoring After Fixes

### Key Metrics to Watch

1. **Error Rate**
   - Should remain < 1%
   - Watch for validation errors

2. **Response Time**
   - Search P95 should be < 200ms (with index)
   - Cache hits should be < 50ms

3. **Cache Hit Rate**
   - Should be > 90% after warm-up
   - Monitor via `get_cache_stats` tool

4. **Security Events**
   - Watch logs for blocked XSS attempts
   - Monitor invalid org number rejections

### Logging

```bash
# View production logs (Render)
# Dashboard → Logs

# Filter for security events
# Search for: "Invalid characters detected"
# Search for: "Validation error"
```

---

## Support

If you encounter issues during remediation:

1. Check test output for specific failures
2. Review error logs for details
3. Verify environment variables are set
4. Ensure database migrations ran successfully
5. Test individual fixes in isolation

---

**Document Version:** 1.0
**Last Updated:** 2025-12-01
**Next Review:** After all fixes deployed
