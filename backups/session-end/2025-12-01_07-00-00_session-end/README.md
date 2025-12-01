# Personupplysning MCP Server

> **MCP server för svensk företags- och persondata** via Bolagsverket API och Supabase cache

Ett HTTP MCP-server som tillhandahåller sökfunktioner för svenska företag och hämtar detaljerad finansiell data från Bolagsverket, med lokal cache i Supabase för snabbare svar.

## 🚀 Features

- **Full MCP Protocol Implementation** - Tools, Resources, Prompts, and Notifications
- **Företagssökning** - Sök bland 1.85M svenska företag i lokal databas
- **Företagsdetaljer** - Hämta fullständig företagsinformation från Bolagsverket
- **Årsredovisningar** - Ladda ner och parsera iXBRL årsredovisningar
- **Smart caching** - Supabase cache-first strategi (30 dagar företagsdata, 7 dagar dokument)
- **Structured Logging** - Request IDs, duration tracking, and MCP notifications
- **HTTP MCP Server** - Publikt tillgänglig via Render deployment
- **Local development** - Stdio mode för lokal utveckling

## 📋 MCP Capabilities

### Tools (Active Operations)

| Tool | Description | Cache |
|------|-------------|-------|
| `search_companies` | Sök företag lokalt (1.85M) | Lokal DB |
| `get_company_details` | Hämta företagsinfo | 30 dagar |
| `get_company_documents` | Lista årsredovisningar | 7 dagar |
| `get_annual_report` | Hämta iXBRL årsredovisning | Permanent |
| `get_cache_stats` | Cache-statistik | - |

### Resources (Passive Data Access)

Resources expose company data as URIs that can be read by clients:

| Resource URI | Description | Example |
|--------------|-------------|---------|
| `company://search?q={query}&limit={limit}` | Search results | `company://search?q=Nordea&limit=10` |
| `company://{orgId}` | Company details | `company://5560001712` |
| `company://{orgId}/documents` | Document list | `company://5560001712/documents` |
| `company://{orgId}/report/{year}` | Annual report | `company://5560001712/report/2023` |
| `company://stats` | Cache statistics | `company://stats` |

### Prompts (Reusable Templates)

Pre-configured prompts for common business analysis workflows:

| Prompt | Description | Arguments |
|--------|-------------|-----------|
| `analyze_company_finances` | Analyze financial health | `organisationsidentitet`, `year?` |
| `compare_competitors` | Compare with competitors | `organisationsidentitet`, `competitor_org_numbers` |
| `find_company_relationships` | Find related companies | `organisationsidentitet` |
| `generate_company_report` | Generate comprehensive report | `organisationsidentitet`, `include_financials?` |

### Notifications

The server sends structured log notifications for:
- Tool execution (start, complete, error)
- Resource access (read, error)
- Prompt generation (start, complete, error)
- Cache hits/misses
- API calls and duration tracking

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────┐
│   Claude    │ ◄─────► │ HTTP MCP     │
│   Desktop   │   SSE   │ Server       │
└─────────────┘         │ (Render)     │
                        └──────┬───────┘
                               │
                        ┌──────┴───────┐
                        │              │
                   ┌────▼────┐   ┌─────▼────┐
                   │Supabase │   │Bolagsver-│
                   │ Cache   │   │ket API   │
                   └─────────┘   └──────────┘
```

## 🛠️ Installation

### Prerequisites

- Node.js 18+ och npm
- Supabase project (gratis tier fungerar)
- Bolagsverket API credentials ([portal.api.bolagsverket.se](https://portal.api.bolagsverket.se/))

### Local Development

1. **Clone repository:**
```bash
git clone <repo-url>
cd personupplysning
```

2. **Install dependencies:**
```bash
npm install
```

3. **Setup environment:**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Setup database:**
```bash
npm run db:setup
```

5. **Import company data (optional):**
```bash
npm run db:import
```

6. **Run in stdio mode (local):**
```bash
npm run dev
```

## 🌐 Production Deployment

### Quick Start

For production deployment on Render.com, follow the comprehensive deployment package:

**📚 Complete Deployment Package Available:**

1. **[PRODUCTION-DEPLOYMENT-SUMMARY.md](./PRODUCTION-DEPLOYMENT-SUMMARY.md)** - Start here! Complete overview
2. **[docs/DEPLOYMENT-GUIDE.md](./docs/DEPLOYMENT-GUIDE.md)** - Step-by-step deployment instructions
3. **[docs/DEPLOYMENT-CHECKLIST.md](./docs/DEPLOYMENT-CHECKLIST.md)** - Pre/post deployment checklist
4. **[docs/OPERATIONS-RUNBOOK.md](./docs/OPERATIONS-RUNBOOK.md)** - Day-to-day operations guide
5. **[docs/MONITORING-STRATEGY.md](./docs/MONITORING-STRATEGY.md)** - Monitoring and alerting setup
6. **[docs/COST-ANALYSIS.md](./docs/COST-ANALYSIS.md)** - Cost breakdown and optimization

### Deployment Summary

**Monthly Cost:** $32-50 USD
- Render (Starter/Standard): $7-25
- Supabase (Pro): $25
- Bolagsverket API (Free): $0

**Deployment Time:** 30-60 minutes
**Verification Time:** 15 minutes

### Quick Deploy Steps

1. **Complete Pre-Deployment Checklist:**
```bash
# Review checklist
cat docs/DEPLOYMENT-CHECKLIST.md | grep "Pre-Deployment" -A 100
```

2. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

3. **Create Render Service:**
   - Go to [dashboard.render.com](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect GitHub repository
   - Render auto-detects `render.yaml`

4. **Set Environment Variables:**
```
NODE_ENV=production
MCP_TRANSPORT=http
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
BOLAGSVERKET_CLIENT_ID=<your-client-id>
BOLAGSVERKET_CLIENT_SECRET=<your-client-secret>
NODE_OPTIONS=--max-old-space-size=384
LOG_LEVEL=info
```

5. **Deploy & Verify:**
```bash
# Wait for deployment (5-10 minutes)
# Then verify:
./scripts/verify-deployment.sh https://your-app.onrender.com
```

**See [docs/DEPLOYMENT-GUIDE.md](./docs/DEPLOYMENT-GUIDE.md) for complete instructions.**

### Connect from Claude Desktop

Add to your Claude Desktop MCP config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "personupplysning": {
      "type": "sse",
      "url": "https://personupplysning-mcp.onrender.com/sse"
    }
  }
}
```

**Note:** The server uses SSE (Server-Sent Events) transport with two endpoints:
- `GET /sse` - Establishes SSE connection
- `POST /messages?sessionId=<id>` - Sends JSON-RPC messages

## 📁 Project Structure

```
personupplysning/
├── src/
│   ├── index.ts                    # HTTP/stdio MCP server
│   ├── clients/
│   │   ├── bolagsverket-api.ts     # Bolagsverket API client
│   │   └── __tests__/              # API client tests
│   └── services/
│       └── company-data-service.ts # Cache-first service layer
├── scripts/
│   ├── setup-supabase.ts           # Database setup
│   ├── import-parquet.ts           # Import 1.85M companies
│   ├── download-annual-report.ts   # Example script
│   ├── check-tables.ts             # Utility: Check tables
│   ├── verify-import.ts            # Utility: Verify imports
│   └── schema.sql                  # Database schema
├── sql/
│   ├── 002-create-cache-tables.sql # Cache tables migration
│   └── 003-create-storage-bucket.sql # Storage setup
├── tests/
│   └── test-supabase.ts            # Supabase connection test
├── docs/
│   └── CACHING-ARCHITECTURE.md     # Architecture documentation
├── render.yaml                      # Render deployment config
├── .env.example                    # Environment template
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Project dependencies
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (`production`/`development`) | Yes |
| `MCP_TRANSPORT` | Transport mode (`http`/`stdio`) | Yes |
| `PORT` | HTTP server port (default: 3000) | HTTP only |
| `HOST` | Bind address (default: 0.0.0.0) | HTTP only |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `BOLAGSVERKET_CLIENT_ID` | Bolagsverket OAuth2 client ID | Yes |
| `BOLAGSVERKET_CLIENT_SECRET` | Bolagsverket OAuth2 client secret | Yes |

### Cache TTL Configuration

Cache expiration kan konfigureras i `src/services/company-data-service.ts`:

```typescript
this.cacheTTL = 30 * 24 * 60 * 60 * 1000; // 30 days company details
this.documentCacheTTL = 7 * 24 * 60 * 60 * 1000; // 7 days document lists
```

## 📊 Database Schema

### Tables

- `companies` - 1.85M svenska företag (lokal kopia)
- `company_details_cache` - API-svar från Bolagsverket (30 dagar TTL)
- `company_documents_cache` - Dokumentlistor (7 dagar TTL)
- `financial_reports` - Parsad finansiell data från iXBRL
- `api_request_log` - Request logging och analytics

### Storage

- `company-documents` bucket - Lagrar nedladdade iXBRL ZIP-filer

## 🧪 Testing

Run tests:
```bash
npm test
```

Test specific file:
```bash
npm test -- bolagsverket-api.test.ts
```

Test API connection:
```bash
npx tsx scripts/download-annual-report.ts
```

## 📝 Development Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run dev` | Run in stdio mode (local) |
| `npm start` | Run compiled JS (production) |
| `npm test` | Run test suite |
| `npm run db:setup` | Setup Supabase schema |
| `npm run db:import` | Import 1.85M companies |

## 🔒 Security

- **OAuth2 tokens** cached with 1-minute safety buffer before expiry
- **Service role key** required for Supabase (never expose publicly)
- **API credentials** stored in environment variables only
- **GDPR compliance** - EU Render region (Frankfurt)
- **No personal data** persisted without consent

## 📈 Performance

- **Cache hit rate:** ~95% after warm-up
- **Local search:** < 100ms (Supabase full-text search)
- **Cached company details:** < 50ms
- **Fresh API call:** 1-3 seconds (Bolagsverket rate limits)
- **iXBRL download:** 2-5 seconds (depends on file size)

## 🐛 Troubleshooting

### Health Check Fails

Check endpoint:
```bash
curl https://personupplysning-mcp.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "server": "personupplysning-mcp",
  "version": "0.1.0",
  "uptime": 123.45,
  "endpoint": "/mcp",
  "environment": {
    "SUPABASE_URL": "configured",
    "BOLAGSVERKET_CLIENT_ID": "configured"
  }
}
```

### MCP Connection Issues

1. Check Render logs for startup errors
2. Verify all environment variables are set
3. Test health endpoint first
4. Check Claude Desktop logs (`~/Library/Logs/Claude/`)

### Database Connection Failed

```bash
# Test Supabase connection
npx tsx tests/test-supabase.ts
```

### Bolagsverket API 401/403

- Verify credentials in Render environment
- Check token expiry (should auto-refresh)
- Ensure OAuth2 scope: `vardefulla-datamangder:ping vardefulla-datamangder:read`

## 📜 License

MIT

## 🤝 Contributing

Contributions welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📧 Support

For issues or questions:
- Open a GitHub issue
- Check existing issues first

---

**Built with:** TypeScript, MCP SDK, Supabase, Bolagsverket API
**Deployed on:** Render (EU region - Frankfurt)
