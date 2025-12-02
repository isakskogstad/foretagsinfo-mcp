# Företagsinfo MCP

## Overview
**MCP server för svensk företagsinformation** via Bolagsverkets API. Ingen lokal databas - alla förfrågningar går direkt till Bolagsverkets Värdefulla datamängder API.

## Tech Stack
- **Runtime:** Node.js 18+, TypeScript (strict mode, Node16 module resolution)
- **MCP SDK:** @modelcontextprotocol/sdk ^1.0.4
- **External API:** Bolagsverket Värdefulla datamängder API (OAuth2)
- **HTTP Client:** axios (med retry logic och exponentiell backoff)
- **iXBRL Parsing:** fast-xml-parser, jszip
- **Logging:** pino (structured logging, stderr för stdio mode)
- **Validation:** Zod (input validation), Luhn checksum

## Project Structure
```
foretagsinfo-mcp/
├── src/
│   ├── index.ts              # stdio entry point
│   ├── http-server.ts        # HTTP entry point (Render)
│   ├── api-client/
│   │   ├── bolagsverket.ts   # OAuth2 + API-klient
│   │   └── types.ts          # TypeScript-typer
│   ├── tools/
│   │   ├── index.ts          # Tool registration
│   │   ├── get-company.ts
│   │   ├── get-documents.ts
│   │   └── get-annual-report.ts
│   ├── resources/
│   │   └── index.ts          # URI-baserade resurser
│   ├── prompts/
│   │   └── index.ts          # Analysmallar
│   └── utils/
│       ├── ixbrl-parser.ts   # iXBRL ZIP parsing
│       ├── validators.ts     # Luhn + Zod schemas
│       ├── errors.ts         # Custom error classes
│       └── logger.ts         # Pino logger
├── build/                    # Compiled JS output
├── backups/
│   ├── session-start/
│   ├── session-end/
│   └── changes/
├── render.yaml               # Render deployment
├── server.json               # MCP Registry metadata
├── tsconfig.json
└── package.json
```

## MCP Capabilities

### Tools (3)
| Tool | Beskrivning |
|------|-------------|
| `get_company` | Hämta företagsinfo via organisationsnummer |
| `get_documents` | Lista tillgängliga årsredovisningar |
| `get_annual_report` | Hämta och analysera årsredovisning |

### Resources (4)
| URI | Beskrivning |
|-----|-------------|
| `company://{org_number}` | Företagsinformation |
| `company://{org_number}/documents` | Dokumentlista |
| `company://{org_number}/report/{year}` | Årsredovisning |
| `api://status` | API-status |

### Prompts (3)
| Prompt | Beskrivning |
|--------|-------------|
| `analyze_company` | Analysera företags finansiella hälsa |
| `compare_companies` | Jämför flera företag |
| `industry_analysis` | Branschanalys baserat på SNI-koder |

## Instructions
- **Endast orgnummer** - Namnsökning stöds inte av API:et
- **Luhn-validering** - Alla orgnummer valideras med checksumma
- **iXBRL-parsing** - Extraherar resultat, balans, nyckeltal från ZIP
- **OAuth2** - Token cachas automatiskt (1 min buffer före expiry)
- **Retry logic** - 3 försök med exponentiell backoff (1s → 2s → 4s)
- **GDPR** - EU region (Frankfurt), endast offentliga uppgifter

## Settings

**Build Commands:**
- `npm run build` - Kompilera TypeScript → build/
- `npm run typecheck` - Typkontroll utan kompilering

**Development:**
- `npm run dev` - stdio mode (Claude Desktop lokal)
- `npm run dev:http` - HTTP mode (localhost:3000)

**Production:**
- `npm start` - stdio mode
- `npm run start:http` - HTTP mode (Render)

**Environment:**
- `BOLAGSVERKET_CLIENT_ID` - OAuth2 client ID (krävs)
- `BOLAGSVERKET_CLIENT_SECRET` - OAuth2 client secret (krävs)
- `PORT` - HTTP-server port (default: 3000)
- `LOG_LEVEL` - trace/debug/info/warn/error (default: info)

## Agents
**Primary:** `mcp-expert`, `typescript-pro`, `backend-architect`
**Testing:** `mcp-testing-engineer`
**Deployment:** `mcp-deployment-orchestrator`

## API Endpoints

**Bolagsverket API:**
- Token URL: `https://portal.api.bolagsverket.se/oauth2/token`
- Base URL: `https://gw.api.bolagsverket.se/vardefulla-datamangder/v1`
- Scopes: `vardefulla-datamangder:ping vardefulla-datamangder:read`

**Endpoints som används:**
- `GET /isalive` - Health check
- `POST /organisationer` - Hämta företagsinfo
- `POST /dokumentlista` - Lista dokument
- `GET /dokument/{id}` - Ladda ner dokument (ZIP)

## Testade företag
- **Volvo Cars:** 5560743089 ✅
- **H&M:** 5560427220 ✅

## Deployment

**Render.com:**
1. Koppla GitHub repo till Render
2. `render.yaml` Blueprint används automatiskt
3. Konfigurera miljövariabler i Dashboard
4. Deploy triggas automatiskt vid push

**HTTP Endpoints:**
- `/` - README som HTML
- `/health` - Hälsokontroll (JSON)
- `/mcp` - MCP SSE/JSON-RPC endpoint

## Session Info
- **Refaktorerad:** 2025-12-02
- **Status:** Klar för testning
- **Nästa steg:** Deploy till Render, testa med Claude Desktop

---

**Created:** 2025-12-02
**Last Updated:** 2025-12-02
**Version:** 1.0.0
