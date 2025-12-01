# Personupplysning MCP Server

## Overview
MCP server för svensk företags- och persondata via Bolagsverket API och Supabase cache. Tillhandahåller sökfunktioner för 1.85M svenska företag och detaljerad finansiell data med smart caching.

## Tech Stack
- **Runtime:** Node.js 18+, TypeScript
- **MCP SDK:** @modelcontextprotocol/sdk ^1.0.4
- **Database:** Supabase (PostgreSQL + Storage)
- **External API:** Bolagsverket API (OAuth2)
- **HTTP Client:** axios
- **Logging:** pino, pino-pretty
- **Testing:** vitest
- **Data:** parquet files (1.85M companies)

## Project Structure
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
│   └── verify-import.ts            # Utility: Verify imports
├── sql/
│   ├── 002-create-cache-tables.sql # Cache tables migration
│   └── 003-create-storage-bucket.sql # Storage setup
├── tests/
│   └── test-supabase.ts            # Supabase connection test
├── docs/
│   └── CACHING-ARCHITECTURE.md     # Architecture documentation
├── backups/                        # Automatic backups
│   ├── session-start/
│   ├── session-end/
│   └── changes/
├── dev/                            # Dev docs
│   └── active/                     # Active task documentation
├── render.yaml                     # Render deployment config
├── .env.example                    # Environment template
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Project dependencies
```

## MCP Tools
1. `search_companies` - Sök företag lokalt (1.85M) - Lokal DB
2. `get_company_details` - Hämta företagsinfo - 30 dagar cache
3. `get_company_documents` - Lista årsredovisningar - 7 dagar cache
4. `get_annual_report` - Hämta iXBRL årsredovisning - Permanent cache
5. `get_cache_stats` - Cache-statistik

## Database Schema
- `companies` - 1.85M svenska företag (lokal kopia)
- `company_details_cache` - API-svar från Bolagsverket (30 dagar TTL)
- `company_documents_cache` - Dokumentlistor (7 dagar TTL)
- `financial_reports` - Parsad finansiell data från iXBRL
- `api_request_log` - Request logging och analytics
- Storage: `company-documents` bucket - iXBRL ZIP-filer

## Instructions
- **Always use Planning Mode** for architecture changes or new features
- **Cache-first strategy** - Check Supabase before hitting Bolagsverket API
- **Security:** Never expose service role key publicly
- **GDPR compliance** - EU region (Frankfurt), no personal data without consent
- **OAuth2 tokens** - Cached with 1-minute safety buffer
- **Error handling** - Always handle API rate limits and token expiry
- **Testing** - Run tests before deployment

## Settings
**Build Commands:**
- `npm run build` - Compile TypeScript → dist/
- `npm test` - Run test suite

**Development:**
- `npm run dev` - Run in stdio mode (local)
- `npm run db:setup` - Setup Supabase schema
- `npm run db:import` - Import 1.85M companies
- `npm run test:supabase` - Test Supabase connection

**Production:**
- `npm start` - Run compiled JS (production)
- Deployed on Render: `https://personupplysning-mcp.onrender.com/mcp`

**Environment:**
- `NODE_ENV` - production/development
- `MCP_TRANSPORT` - http/stdio
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `BOLAGSVERKET_CLIENT_ID` - OAuth2 client ID
- `BOLAGSVERKET_CLIENT_SECRET` - OAuth2 client secret

## Agents
**Primary:** `mcp-expert`, `typescript-pro`, `backend-architect`
**Testing:** `mcp-testing-engineer`
**Deployment:** `mcp-deployment-orchestrator`
**Review:** `code-reviewer`

## Backup Info
- **Last session backup:** 2025-12-01 (to be created)
- **Backup retention policy:** Default (manual cleanup)

## Notes
- **Performance:** ~95% cache hit rate after warm-up
- **Local search:** < 100ms (Supabase full-text search)
- **Cached company details:** < 50ms
- **Fresh API call:** 1-3 seconds (Bolagsverket rate limits)
- **iXBRL download:** 2-5 seconds (file size dependent)
- **Transport:** SSE (Server-Sent Events) for HTTP mode
  - GET /sse - Establishes SSE connection
  - POST /messages?sessionId=<id> - Sends JSON-RPC messages
- **Health check:** GET /health endpoint available

## Active Tasks
- None currently

---

**Created:** 2025-12-01
**Last Updated:** 2025-12-01
