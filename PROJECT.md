# Personupplysning MCP Server

## Overview
En MCP-server som ger LLMs tillgång till att söka, hitta och analysera personuppgifter och företagsdata i Sverige genom att kombinera:
- Lokal databas med 1.88M företag (Bolagsverket dataset via Hugging Face)
- Bolagsverket API (officiell data + iXBRL styrelsedata)
- Merinfo.se scraping (rikaste persondata: ålder, telefon, adress)

## Tech Stack
- **Language:** TypeScript (Node.js 18+)
- **Framework:** MCP SDK (@modelcontextprotocol/sdk)
- **Transport:** stdio (local) + SSE (remote)
- **Databases:**
  - DuckDB: 1.88M företag (embedded, instant queries)
  - SQLite: Merinfo cache (30-day TTL, FTS5)
  - PostgreSQL: GDPR audit logs
- **External APIs:**
  - Bolagsverket API (OAuth2 + REST + iXBRL parsing)
  - Merinfo.se scraper (Playwright browser automation)

## Project Structure
```
personupplysning/
├── backups/                    # Automatic backups
│   ├── session-start/
│   ├── session-end/
│   └── changes/
├── data/                       # Datasets and databases
│   ├── bolagsverket_data.parquet  # 1.88M companies from Hugging Face
│   ├── companies.duckdb        # DuckDB database
│   └── merinfo_cache.db        # SQLite cache för Merinfo
├── vendors/                    # Cloned external repos
│   ├── Merinfo.se-MCP/        # Production-ready TypeScript MCP (4.5/5)
│   ├── alla-bolag-python-mcp/ # Python MCP reference (3.5/5)
│   └── oppna-bolagsdata/      # Data pipeline scripts
├── src/
│   ├── tools/                  # 15 MCP tools implementation
│   ├── services/
│   │   ├── bolagsverket/      # OAuth2 + API client + iXBRL parser
│   │   ├── merinfo/           # Forked från Merinfo.se-MCP
│   │   └── duckdb/            # Database service
│   ├── core/
│   │   ├── gdpr-logger.ts     # PostgreSQL audit logging
│   │   ├── rate-limiter.ts    # Token bucket algorithm
│   │   └── orchestrator.ts    # Smart routing mellan layers
│   ├── types/                  # TypeScript definitions
│   └── index.ts               # MCP server entry point
├── tests/
├── package.json
├── tsconfig.json
├── docker-compose.yml
└── .env
```

## Implementation Roadmap

### ✅ Week 0: Research & Testing (COMPLETED)
- Testade Bolagsverket API (8/8 passed)
- Analyserade Merinfo.se-MCP (4.5/5 stars)
- Analyserade Hugging Face datasets (1.88M företag)
- Skapade implementation plan

### 🔄 Week 1: Foundation (IN PROGRESS)
**Dag 1-2: Database Setup**
- [ ] Download Bolagsverket dataset (233 MB)
- [ ] Setup DuckDB
- [ ] Test Parquet queries

**Dag 3-4: Bolagsverket API Client**
- [ ] OAuth2 integration
- [ ] REST API client (/organisationer, /dokumentlista, /dokument)
- [ ] iXBRL parser (port från Python)

**Dag 5-7: Core MCP Tools (5 tools)**
- [ ] search_companies_local (DuckDB)
- [ ] get_company_details (Bolagsverket API)
- [ ] get_company_board (iXBRL parsing)
- [ ] get_company_financials (iXBRL parsing)
- [ ] verify_company_status (Bolagsverket API)

### 📅 Week 2: Merinfo Integration (PLANNED)
- Fork Merinfo MCP till src/services/merinfo/
- Person search tools (5 tools)
- Hybrid orchestration (smart routing)

### 📅 Week 3: Production Polish (PLANNED)
- Additional analytics tools (5 tools)
- GDPR logging (PostgreSQL)
- Docker deployment
- Documentation

## Credentials & Access

### Bolagsverket API (VERIFIED WORKING)
- **CLIENT_ID:** UIiATHgXGSP6HIyOlqWZkX51dnka
- **CLIENT_SECRET:** (stored in .env)
- **Token Endpoint:** https://portal.api.bolagsverket.se/oauth2/token
- **API Base:** https://gw.api.bolagsverket.se/vardefulla-datamangder/v1

### Hugging Face Dataset
- **URL:** https://huggingface.co/datasets/PierreMesure/oppna-bolagsdata-bolagsverket
- **License:** CC-BY-4.0
- **Size:** 233 MB (1,883,264 companies)
- **Format:** Parquet

## MCP Tools (15 total)

### Företagssökning (7 tools)
1. `search_companies_local` - DuckDB full-text search
2. `get_company_details` - Bolagsverket API
3. `get_company_board` - iXBRL + Merinfo enrichment
4. `get_company_financials` - iXBRL parsing (78+ metrics)
5. `get_company_history` - iXBRL archives
6. `verify_company_status` - Konkurs/likvidation
7. `search_bankruptcies` - DuckDB query

### Personuppgifter (5 tools)
8. `search_person` - Merinfo cache + live scraping
9. `get_person_details` - Bolagsverket + Merinfo merge
10. `get_person_companies` - Cross-reference
11. `get_person_contact` - Telefon & adress
12. `verify_person_role` - Officiell verifiering

### Analytics & Network (3 tools)
13. `get_company_network` - Graph analysis
14. `list_industries` - SNI aggregation
15. `get_similar_companies` - Similarity search

## Performance Targets
- 90% of queries: <500ms (cache hits)
- 10% of queries: 3-8s (cache miss → scraping)
- DuckDB queries: 10-50ms
- Bolagsverket API: <2s total

## GDPR Compliance
- **Audit Logging:** ALL person searches logged to PostgreSQL
- **Rate Limiting:** 100 searches/hour per user
- **Purpose Validation:** Journalistik, rekrytering, kreditprövning
- **User Consent:** Required before data access
- **PII Handling:** Adresser, telefonnummer, personnummer

## Build Commands
```bash
# Development
npm install
npm run dev

# Build
npm run build

# Test
npm test

# Docker
docker-compose up -d
```

## Environment Variables
```
# Bolagsverket API
BOLAGSVERKET_CLIENT_ID=UIiATHgXGSP6HIyOlqWZkX51dnka
BOLAGSVERKET_CLIENT_SECRET=xxx

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=personupplysning
POSTGRES_PASSWORD=xxx

# Rate Limiting
MAX_SEARCHES_PER_HOUR=100
CACHE_TTL_DAYS=30
```

## Backup Info
- **Session-start backups:** Created at beginning of each session
- **Session-end backups:** Created when ending work session
- **Continuous backups:** Before ANY file modification
- **Retention:** Manual cleanup as needed

## Notes
- **Data Sources:** Endast FREE sources (Bolagsverket API + Merinfo scraping + Hugging Face)
- **No API subscriptions:** UC, Creditsafe, Ratsit INTE använda (kostar pengar)
- **Hybrid Approach:** 3-layer architecture för optimal performance + kostnad
- **80% Code Reuse:** Merinfo.se-MCP är production-ready, fork och integrera
- **Critical Dependency:** Playwright för Merinfo scraping (memory overhead)
- **Bolagsverket Limitation:** iXBRL endast signatories (inte full board)
- **Merinfo Risk:** HTML parsing kan bryta om site ändras
- **GDPR Critical:** Audit logging är OBLIGATORISK (risk för böter annars)

## Resources
- **Implementation Plan:** `/Users/isak/.claude/plans/tidy-dancing-goose.md`
- **Bolagsverket API Guide:** `/Users/isak/Desktop/Bolagsverket_API_Guide.md`
- **Bolagsverket Datatillgänglighet:** `/Users/isak/Desktop/Bolagsverket_API_Datatillganglighet.md`
- **Python iXBRL Parser:** `/Users/isak/Desktop/extract_financials.py`

---

**Created:** 2025-12-01
**Status:** Week 1 (Foundation) - IN PROGRESS
**Next Milestone:** 5 core MCP tools functional by Week 1 end
