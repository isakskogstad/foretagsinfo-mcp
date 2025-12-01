# MCP Testing Guide

Quick reference for testing the complete MCP implementation.

---

## 1. Build and Test Locally

```bash
# Build TypeScript
npm run build

# Run in stdio mode (local testing)
npm run dev
```

---

## 2. MCP Inspector Testing

### Install and Run Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Test Tools

```javascript
// 1. Search companies
{
  "query": "Nordea",
  "limit": 5
}

// 2. Get company details
{
  "organisationsidentitet": "5560001712"
}

// 3. Get documents
{
  "organisationsidentitet": "5560001712"
}

// 4. Get annual report
{
  "organisationsidentitet": "5560001712",
  "year": 2023
}

// 5. Get cache stats
{}
```

### Test Resources

Click on "Resources" tab in Inspector, then read:

```
company://search?q=Nordea&limit=5
company://5560001712
company://5560001712/documents
company://5560001712/report/2023
company://stats
```

### Test Prompts

Click on "Prompts" tab, select prompt and provide arguments:

**analyze_company_finances:**
```json
{
  "organisationsidentitet": "5560001712",
  "year": "2023"
}
```

**compare_competitors:**
```json
{
  "organisationsidentitet": "5560001712",
  "competitor_org_numbers": "5560001713,5560001714"
}
```

**find_company_relationships:**
```json
{
  "organisationsidentitet": "5560001712"
}
```

**generate_company_report:**
```json
{
  "organisationsidentitet": "5560001712",
  "include_financials": "true"
}
```

---

## 3. Error Handling Tests

### Invalid Organization Number

```json
{
  "organisationsidentitet": "123"
}
```

**Expected:**
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid organisationsnummer: \"123\". Must be 10 digits",
    "statusCode": 400,
    "requestId": "uuid-xxxx",
    "timestamp": "2025-12-01T...",
    "metadata": {
      "orgNumber": "123",
      "format": "Expected 10 digits"
    }
  }
}
```

### Invalid Year

```json
{
  "organisationsidentitet": "5560001712",
  "year": 1800
}
```

**Expected:**
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid year: \"1800\". Must be between 1900 and 2025",
    "statusCode": 400,
    "requestId": "uuid-xxxx"
  }
}
```

### Company Not Found

```json
{
  "organisationsidentitet": "0000000000"
}
```

**Expected:**
```json
{
  "error": {
    "code": "COMPANY_NOT_FOUND",
    "message": "No company found with organisationsnummer: 0000000000",
    "statusCode": 404,
    "requestId": "uuid-xxxx"
  }
}
```

---

## 4. HTTP Server Testing

### Start HTTP Server

```bash
export MCP_TRANSPORT=http
export PORT=3000
npm start
```

### Health Check

```bash
curl http://localhost:3000/health | jq
```

**Expected:**
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

### Test SSE Connection

```bash
curl -N http://localhost:3000/mcp
```

**Expected:** SSE stream opens with initial handshake

---

## 5. Claude Desktop Integration

### Local Testing (stdio)

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "personupplysning-local": {
      "command": "node",
      "args": [
        "/absolute/path/to/personupplysning/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

### HTTP Testing (local)

```json
{
  "mcpServers": {
    "personupplysning-http": {
      "type": "sse",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Production (Render)

```json
{
  "mcpServers": {
    "personupplysning": {
      "type": "sse",
      "url": "https://personupplysning-mcp.onrender.com/mcp"
    }
  }
}
```

---

## 6. Notification Verification

Check Claude Desktop logs for notifications:

**macOS:**
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Expected notifications:**
```
[INFO] Executing tool - requestId: uuid-1234, toolName: get_company_details
[INFO] Tool execution completed - requestId: uuid-1234, duration: 245ms
[INFO] Reading resource - requestId: uuid-5678, uri: company://5560001712
[INFO] Resource read successfully - requestId: uuid-5678, duration: 123ms
```

---

## 7. Performance Testing

### Cache Hit Rate

```bash
# Run cache stats tool multiple times
# First run: cache miss, slower
# Second run: cache hit, faster

# Tool 1: get_cache_stats
# Check: cache_hit_rate_24h should increase
```

### Response Times

**Expected response times:**

| Operation | Cache | Expected Time |
|-----------|-------|---------------|
| `search_companies` | Local DB | < 100ms |
| `get_company_details` | Cache hit | < 50ms |
| `get_company_details` | Cache miss | 1-3s |
| `get_company_documents` | Cache hit | < 50ms |
| `get_company_documents` | Cache miss | 1-3s |
| `get_annual_report` | Cached | < 100ms |
| `get_annual_report` | Fresh | 2-5s |

---

## 8. Logging Verification

### Check Structured Logs

```bash
# Run server in development mode
npm run dev

# Logs should show:
# - Request IDs for all operations
# - Duration tracking
# - Cache hits/misses
# - Error details (with stack traces in dev)
```

**Example log output:**
```
12:34:56 INFO  [personupplysning-mcp]: Environment variables validated successfully
12:34:56 INFO  [personupplysning-mcp]: Server starting
  mode: "stdio"
12:34:57 INFO  [personupplysning-mcp]: Tool request received
  requestId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  toolName: "get_company_details"
  args: { organisationsidentitet: "5560001712" }
12:34:57 INFO  [personupplysning-mcp]: Cache HIT
  organisationsidentitet: "5560001712"
12:34:57 INFO  [personupplysning-mcp]: Tool request completed
  requestId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  toolName: "get_company_details"
  duration: 45
```

---

## 9. Environment Validation Testing

### Test Missing Environment Variables

```bash
# Remove required env var
unset BOLAGSVERKET_CLIENT_ID

# Try to start server
npm start
```

**Expected output:**
```
❌ Environment validation failed:
   Missing required environment variables: BOLAGSVERKET_CLIENT_ID

Please configure these variables in your .env file.
```

**Server should exit with code 1**

---

## 10. Integration Test Scenarios

### Scenario 1: Search and Analyze Flow

1. Search for companies: `search_companies` with query "Nordea"
2. Get details for result: `get_company_details` with org number
3. List documents: `get_company_documents`
4. Get latest report: `get_annual_report`
5. Use prompt: `analyze_company_finances` with org number

**Expected:** All steps complete successfully, data flows logically

### Scenario 2: Resource Access Flow

1. Read resource: `company://search?q=Nordea&limit=5`
2. Pick company from results
3. Read resource: `company://{orgId}`
4. Read resource: `company://{orgId}/documents`
5. Read resource: `company://{orgId}/report/2023`

**Expected:** Same data as tools, but via resource URIs

### Scenario 3: Prompt Template Flow

1. Get prompt: `analyze_company_finances`
2. Verify pre-loaded company data in prompt
3. Use prompt in Claude conversation
4. Get prompt: `generate_company_report`
5. Verify comprehensive data

**Expected:** Prompts include all relevant data pre-fetched

---

## Troubleshooting

### Server Won't Start

1. Check environment variables: `npm run db:setup` to verify .env
2. Check TypeScript compilation: `npm run build`
3. Check Node version: `node --version` (should be 18+)
4. Check logs for specific error messages

### Tools Work, Resources Don't

1. Verify MCP SDK version: `npm list @modelcontextprotocol/sdk`
2. Check resource URI format
3. Verify client supports resources (MCP Inspector does)

### Prompts Don't Return Data

1. Check prompt arguments are correct
2. Verify company exists in database
3. Check Bolagsverket API credentials
4. Review server logs for errors

### Notifications Not Showing

1. Verify client supports notifications
2. Check log level: `export LOG_LEVEL=debug`
3. Review MCP Inspector console output
4. Check Claude Desktop logs

---

## Success Criteria

✅ All 5 tools return valid JSON
✅ All 5 resources return valid data
✅ All 4 prompts generate valid messages
✅ Notifications appear in logs
✅ Request IDs present in all operations
✅ Error handling returns structured errors
✅ Cache statistics show hit rate
✅ Health endpoint returns 200 OK
✅ Server starts without errors
✅ Environment validation works

---

**Happy Testing!** 🚀

For issues, check:
- Server logs (stderr for stdio, stdout for HTTP)
- Claude Desktop logs (`~/Library/Logs/Claude/`)
- Render deployment logs (if deployed)
- MCP Inspector console output
