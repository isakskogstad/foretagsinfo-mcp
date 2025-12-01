# Caching Architecture

## Overview

Personupplysning MCP använder en **cache-first strategi** för att minimera API-anrop till Bolagsverket och maximera prestanda.

## Arkitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server Request                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              CompanyDataService (Cache Layer)                │
│                                                              │
│  1. Check Supabase cache first                              │
│  2. If cache miss/expired → fetch from Bolagsverket API     │
│  3. Store result in cache                                   │
│  4. Return data                                             │
└─────────────────────────────────────────────────────────────┘
              │                                   │
              ▼                                   ▼
┌──────────────────────────┐    ┌────────────────────────────┐
│   Supabase Database      │    │   Bolagsverket API         │
│                          │    │   (External, rate-limited) │
│  - company_details_cache │    │                            │
│  - company_documents_cache│   │  - OAuth2 authentication   │
│  - financial_reports     │    │  - REST endpoints          │
│  - board_members         │    │  - iXBRL documents         │
│  - api_request_log       │    └────────────────────────────┘
└──────────────────────────┘
              │
              ▼
┌──────────────────────────┐
│  Supabase Storage        │
│                          │
│  company-documents/      │
│    {orgId}/              │
│      annual-reports/     │
│        {year}/           │
│          report.xbrl     │
│          report.pdf      │
└──────────────────────────┘
```

## Cache Tables

### 1. `company_details_cache`
Cachar detaljerad företagsinformation från Bolagsverket API.

**Columns:**
- `organisationsidentitet` (PK)
- `api_response` (JSONB) - Full API-respons
- `fetched_at` - När data hämtades
- `cache_expires_at` - När cache upphör (default: 30 dagar)
- `fetch_count` - Antal gånger data hämtats från cache

### 2. `company_documents_cache`
Cachar dokumentlistor för företag.

**Columns:**
- `organisationsidentitet` (FK)
- `documents` (JSONB) - Lista av dokument-metadata
- `cache_expires_at` (default: 7 dagar)

### 3. `financial_reports`
Lagrar **parsad** finansiell data från årsredovisningar.

**Columns:**
- `organisationsidentitet` (FK)
- `report_year`
- `report_type` - 'ÅRSREDOVISNING', 'KONCERNREDOVISNING', etc.
- `balance_sheet` (JSONB) - Balansräkning (78+ metrics)
- `income_statement` (JSONB) - Resultaträkning
- `cash_flow` (JSONB) - Kassaflödesanalys
- `key_metrics` (JSONB) - Nyckeltal
- `storage_path` - Path till råfilen i Storage

### 4. `board_members`
Styrelseledamöter och befattningshavare.

**Columns:**
- `organisationsidentitet` (FK)
- `namn`, `personnummer`, `roll`
- `from_date`, `to_date`

### 5. `api_request_log`
Loggar alla API-anrop för analytics och rate limiting.

**Columns:**
- `endpoint`, `method`, `organisationsidentitet`
- `status_code`, `response_time_ms`
- `cache_hit` (boolean) - Om data hämtades från cache

## Supabase Storage

### Bucket: `company-documents`

**Structure:**
```
company-documents/
  {organisationsidentitet}/
    annual-reports/
      2024/
        report.xbrl
        report.pdf
      2023/
        report.xbrl
    board/
      board-composition-2024-01-15.pdf
    articles/
      articles-of-association.pdf
```

**Settings:**
- Private bucket (authenticated access only)
- Max file size: 50MB
- Allowed MIME types: `application/pdf`, `application/xml`, `text/xml`, `application/xhtml+xml`

## Cache Strategy

### TTL (Time To Live)

| Data Type | Default TTL | Reasoning |
|-----------|-------------|-----------|
| Company details | 30 days | Grunddata ändras sällan |
| Document lists | 7 days | Nya dokument kan läggas till |
| Financial reports | ∞ (permanent) | Historisk data ändras ej |
| Board members | 30 days | Kan ändras vid bolagsstämma |

### Cache Invalidation

**Automatic expiration:**
- `cache_expires_at` kolumn i varje cache-tabell
- Service kontrollerar automatiskt vid varje request

**Manual invalidation:**
```typescript
// Ta bort all cache för specifikt företag
await supabase
  .from('company_details_cache')
  .delete()
  .eq('organisationsidentitet', '5560661778');
```

## Usage Examples

### Get Company Details (with cache)

```typescript
import { companyDataService } from './services/company-data-service';

// 1st call: Cache MISS → API call → Store in cache
const company = await companyDataService.getCompanyDetails('5560661778');

// 2nd call: Cache HIT → Return from Supabase
const companyCached = await companyDataService.getCompanyDetails('5560661778');
```

### Get Annual Report (with file storage)

```typescript
// Fetch, parse, and store annual report
const report = await companyDataService.getAnnualReport('5560661778', 2024);

// Returns:
// - Parsed financial data from iXBRL
// - Storage path to raw file
console.log(report.data.balance_sheet); // Parsed balansräkning
console.log(report.storagePath); // 5560661778/annual-reports/2024/report.xbrl
```

### Search Companies (local first)

```typescript
// Search in local Supabase database first
const results = await companyDataService.searchCompanies('Spotify');

// If no local results → Fallback to API
```

## Benefits

### 1. Performance
- **Local queries:** ~10-50ms (Supabase)
- **API calls:** ~500-2000ms (Bolagsverket)
- **10-100x faster** för cachad data

### 2. Cost Reduction
- Färre externa API-anrop
- Bolagsverket kan ha rate limits eller kostnader

### 3. Reliability
- Fungerar även om Bolagsverket API har driftstörningar
- Cached data alltid tillgänglig

### 4. Analytics
- `api_request_log` ger insikt i användningsmönster
- Mäter cache hit rate
- Identifierar populära företag/requests

## Migration

Run SQL migrations in order:

1. `sql/recreate-companies-table.sql` - Grundtabell (redan kört)
2. `sql/002-create-cache-tables.sql` - Cache-tabeller
3. `sql/003-create-storage-bucket.sql` - Storage bucket

```bash
# Apply migrations via Supabase dashboard:
# https://supabase.com/dashboard/project/thjwryuhtwlfxwduyqqd/sql
```

## Monitoring

### Cache Hit Rate (last 24h)

```typescript
const stats = await companyDataService.getCacheStats();

console.log(stats);
// {
//   cached_company_details: 1245,
//   cached_document_lists: 523,
//   stored_financial_reports: 89,
//   total_api_requests: 3421,
//   cache_hit_rate_24h: 87.3
// }
```

### Top Requested Companies

```sql
SELECT organisationsidentitet, COUNT(*) as request_count
FROM api_request_log
WHERE requested_at > NOW() - INTERVAL '7 days'
GROUP BY organisationsidentitet
ORDER BY request_count DESC
LIMIT 10;
```

## Future Improvements

1. **Proactive caching:** Pre-fetch data för populära företag
2. **Cache warming:** Background job som uppdaterar gamla cache-poster
3. **Compression:** Komprimera JSONB-data för stora API-responses
4. **CDN caching:** Publika dokument via CDN
5. **Real-time updates:** Webhook från Bolagsverket när data ändras
