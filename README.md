# Företagsinfo MCP

MCP server för svensk företagsinformation via Bolagsverkets API.

## Funktioner

Hämta företagsinformation direkt i Claude och andra AI-assistenter:

- **Företagsuppgifter** - Namn, organisationsform, SNI-koder, adress, registreringsdatum
- **Årsredovisningar** - Lista och analysera digitala årsredovisningar
- **Finansiella nyckeltal** - Omsättning, resultat, soliditet, antal anställda
- **Styrelse och ledning** - Hämta styrelsemedlemmar, VD och befattningshavare
- **Analysmallar** - Färdiga prompts för företagsanalys och jämförelser

## Tillgängliga verktyg

| Verktyg | Beskrivning |
|---------|-------------|
| `get_company` | Hämta företagsuppgifter via organisationsnummer |
| `get_documents` | Lista tillgängliga årsredovisningar |
| `get_annual_report` | Hämta och analysera årsredovisning |
| `get_board_members` | Hämta styrelse och befattningshavare (via merinfo.se) |

## Snabbstart

### Remote (rekommenderat)

Lägg till i din Claude Desktop-konfiguration (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "foretagsinfo": {
      "type": "sse",
      "url": "https://foretagsinfo-mcp.onrender.com/mcp"
    }
  }
}
```

### Lokal installation

```bash
# Klona repo
git clone https://github.com/isakskogstad/foretagsinfo-mcp
cd foretagsinfo-mcp

# Installera dependencies
npm install

# Konfigurera credentials (se nedan)
cp .env.example .env

# Kör i utvecklingsläge
npm run dev
```

## Konfiguration

### Bolagsverket API-credentials

Servern kräver API-credentials från Bolagsverket för att fungera.

1. Ansök om tillgång till "Värdefulla datamängder" API:et via [portal.api.bolagsverket.se](https://portal.api.bolagsverket.se)
2. Skapa en `.env`-fil med dina credentials:

```bash
BOLAGSVERKET_CLIENT_ID=ditt_client_id
BOLAGSVERKET_CLIENT_SECRET=ditt_client_secret
```

### Miljövariabler

| Variabel | Beskrivning | Standard |
|----------|-------------|----------|
| `BOLAGSVERKET_CLIENT_ID` | OAuth2 Client ID | *krävs* |
| `BOLAGSVERKET_CLIENT_SECRET` | OAuth2 Client Secret | *krävs* |
| `PORT` | HTTP-server port | `3000` |
| `LOG_LEVEL` | Loggnivå (trace/debug/info/warn/error) | `info` |

## Användningsexempel

### Hämta företagsinfo

```
Hämta information om Volvo Cars med organisationsnummer 5560743089
```

### Analysera årsredovisning

```
Analysera senaste årsredovisningen för H&M (org.nr 5560427220)
```

### Jämför företag

```
Jämför de finansiella nyckeltalen för Volvo (5560743089) och Scania (5560000035)
```

### Hämta styrelse

```
Vilka sitter i styrelsen för H&M (org.nr 5560427220)?
```

## API-begränsningar

- **Endast organisationsnummer** - Namnsökning stöds inte
- **Digitala dokument** - Endast årsredovisningar inlämnade digitalt finns tillgängliga
- **Luhn-validering** - Organisationsnummer måste ha giltig checksumma

## Projektstruktur

```
foretagsinfo-mcp/
├── src/
│   ├── index.ts              # stdio entry point
│   ├── http-server.ts        # HTTP entry point (Render)
│   ├── api-client/
│   │   ├── bolagsverket.ts   # OAuth2 + API-klient
│   │   └── types.ts          # TypeScript-typer
│   ├── scrapers/
│   │   ├── merinfo-client.ts # HTTP-klient för merinfo.se
│   │   ├── merinfo-parser.ts # HTML-parser
│   │   ├── selectors.ts      # CSS-selektorer
│   │   └── rate-limiter.ts   # Rate limiting
│   ├── tools/
│   │   ├── get-company.ts
│   │   ├── get-documents.ts
│   │   ├── get-annual-report.ts
│   │   └── get-board-members.ts
│   ├── resources/            # URI-baserade resurser
│   ├── prompts/              # Analysmallar
│   └── utils/
│       ├── ixbrl-parser.ts   # iXBRL-parsing
│       ├── validators.ts     # Luhn-validering
│       ├── errors.ts         # Felhantering
│       └── logger.ts         # Pino-logger
├── render.yaml               # Render deployment
├── server.json               # MCP Registry metadata
└── package.json
```

## Utveckling

```bash
# Utvecklingsläge (stdio)
npm run dev

# Utvecklingsläge (HTTP)
npm run dev:http

# Bygg för produktion
npm run build

# Typkontroll
npm run typecheck
```

## Deployment

Projektet är konfigurerat för [Render.com](https://render.com):

1. Koppla GitHub-repot till Render
2. Använd `render.yaml` Blueprint
3. Konfigurera environment variables i Render Dashboard

## Licens

MIT

## Författare

Isak Skogstad
