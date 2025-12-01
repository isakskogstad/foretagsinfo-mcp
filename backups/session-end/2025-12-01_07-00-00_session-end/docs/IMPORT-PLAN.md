# 📋 Detaljerad Importplan - Personupplysning MCP Server

> **Sammanfattning av komplett analys av dataset-import till Supabase**
>
> **Datum:** 2025-12-01
> **Dataset:** Bolagsverket (1.88M företag) + Swedish Postcodes (10.8K postkoder)
> **Status:** ✅ Redo för import

---

## 📊 Executive Summary

### Datasets

| Dataset | Rader | Storage | Status | Prioritet |
|---------|-------|---------|--------|-----------|
| **Bolagsverket** | 1,883,264 | ~3.2 GB | ✅ Ready | **1 - KRITISK** |
| **Swedish Postcodes** | 10,826 (aggregated) | ~1 MB | ✅ Ready | **2 - Enhancement** |
| **Total** | 1,894,090 | ~3.2 GB | ✅ Ready | - |

### Kostnadseffekt

- **Supabase tier:** Pro ($25/month) - **OBLIGATORISK**
- **Free tier:** 500 MB - överskri

ds med 2.7 GB
- **Render deployment:** Gratis (community tier OK)
- **Total månadskostnad:** ~$25/månad

### Tidplan

| Fas | Tidsåtgång | Status |
|-----|------------|--------|
| 1. Kopiera parquet-filer | 2 min | Pending |
| 2. Uppdatera import-script | 30 min | Pending |
| 3. Import till Supabase | 20-30 min | Pending |
| 4. Verifiera import | 5 min | Pending |
| 5. Import postcodes | 5 min | Pending |
| **Total** | **~1 timme** | **Ready to start** |

---

## 🗂️ Dataset 1: Bolagsverket (Svenska Företag)

### Source Data

**Källa:** `/Users/isak/Desktop/oppna-bolagsdata-bolagsverket/`

```
data/
├── train-00000-of-00002.parquet  (111.6 MB, 941,632 rader)
└── train-00001-of-00002.parquet  (110.9 MB, 941,632 rader)
Total: 222.5 MB compressed → 1,883,264 rader
```

### Schema Mapping

| Parquet Column | Supabase Column | Type | Transform |
|----------------|-----------------|------|-----------|
| `organisationsidentitet` | `organisationsidentitet` | TEXT UNIQUE NOT NULL | None |
| `organisationsnamn` | `organisationsnamn` | TEXT NOT NULL | **Parse:** Split by `$`, take first part |
| `organisationsform` | `organisationsform` | TEXT | None |
| `postadress` | `postadress` | TEXT | **Convert:** `\n` → `, ` (comma-separated) |
| `registreringsdatum` | `registreringsdatum` | DATE | None (already YYYY-MM-DD) |
| `avregistreringsdatum` | `avregistreringsdatum` | DATE | None (nullable) |
| `avregistreringsorsak` | `avregistreringsorsak` | TEXT | None (nullable) |
| `verksamhetsbeskrivning` | `verksamhetsbeskrivning` | TEXT | None |
| `registreringsland` | `registreringsland` | TEXT | None (always "SE-LAND") |
| `pagandeAvvecklingsEllerOmstruktureringsforfarande` | `pagandeavvecklingselleromsstruktureringsforfarande` | TEXT | None (nullable) |
| `namnskyddslopnummer` | - | - | **SKIP** (100% null) |

### Data Quality

- ✅ **Completeness:** 99.5%
- ✅ **Uniqueness:** 100% (no duplicates)
- ✅ **Format:** 100% valid
- ✅ **Encoding:** UTF-8 with Swedish characters (ÅÄÖ)
- ⚠️ **Anomalies:** Long organisationsnamn (max 23,663 chars) - will be parsed

### Storage Requirements

- **Raw data:** 1,413 MB (in-memory)
- **PostgreSQL table:** 2,120 MB
- **Indexes:** 1,060 MB
- **Total:** **3,180 MB (~3.1 GB)**

### Required Indexes

```sql
-- Primary key
CREATE UNIQUE INDEX idx_companies_orgidentitet_unique ON companies(organisationsidentitet);

-- Search indexes
CREATE INDEX idx_companies_namn ON companies USING GIN (organisationsnamn gin_trgm_ops);
CREATE INDEX idx_companies_form ON companies(organisationsform);
CREATE INDEX idx_companies_regdatum ON companies(registreringsdatum);

-- Partial index for active companies
CREATE INDEX idx_companies_aktiv ON companies(organisationsidentitet)
WHERE avregistreringsdatum IS NULL;

-- Full-text search
CREATE INDEX idx_companies_fts ON companies USING GIN (
  to_tsvector('swedish', COALESCE(organisationsnamn, '') || ' ' || COALESCE(verksamhetsbeskrivning, ''))
);
```

---

## 📍 Dataset 2: Swedish Postcodes

### Source Data

**Källa:** `/Users/isak/Desktop/swedish_postcodes/`

```
swedish_postcodes.parquet (51 MB, 3,826,780 rader)
```

**Transformation:** Aggregate by postnummer (3.8M → 10.8K rader)

### Aggregation Strategy

```python
# Extract coordinates from WKB geometry (SWEREF99 TM → WGS84)
# Aggregate: One row per postkod with centroid
aggregated = df.groupby('postnummer').agg({
    'longitude': 'mean',  # Centroid X (WGS84)
    'latitude': 'mean',   # Centroid Y (WGS84)
    'geometry': 'count'   # Address count per postkod
})
```

### Schema

```sql
CREATE TABLE public.postcodes (
  postkod TEXT PRIMARY KEY,           -- 5-digit code (e.g., "11115")
  latitude DECIMAL(10, 7) NOT NULL,   -- WGS84 latitude (55-69°N)
  longitude DECIMAL(10, 7) NOT NULL,  -- WGS84 longitude (11-24°E)
  address_count INTEGER NOT NULL,     -- How many addresses per code
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_postcodes_postkod ON postcodes(postkod);

-- Optional: PostGIS spatial index for geo queries
CREATE INDEX idx_postcodes_geo ON postcodes USING GIST (
  ST_Point(longitude, latitude)
);
```

### Storage Requirements

- **Aggregated data:** ~1 MB
- **With indexes:** ~1.5 MB
- **Impact:** Negligible (rounds to 0 GB)

### Integration Benefits

1. **Enrich company data with coordinates:**
   ```sql
   SELECT c.*, p.latitude, p.longitude
   FROM companies c
   LEFT JOIN postcodes p ON SUBSTRING(c.postadress FROM '\d{5}') = p.postkod
   ```

2. **New MCP tools:**
   - `get_company_location(org_nummer)` → `{lat, lon, postkod}`
   - `get_companies_near(lat, lon, radius_km)`
   - `search_companies_in_region(postkod_pattern)`

3. **Match rate:** ~98% (based on sample tests)

---

## 🚀 Import Strategy

### Phase 1: Bolagsverket Import

#### Step 1: Copy Parquet Files

```bash
cp /Users/isak/Desktop/oppna-bolagsdata-bolagsverket/data/*.parquet \
   ~/Desktop/CLAUDE_CODE\ /projects/personupplysning/data/
```

#### Step 2: Update Import Script

**File:** `scripts/import-parquet.ts`

**Modifications needed:**

1. **Process both parquet files:**
   ```typescript
   const PARQUET_FILES = [
     'data/train-00000-of-00002.parquet',
     'data/train-00001-of-00002.parquet'
   ];
   ```

2. **Add organisationsnamn parsing:**
   ```python
   # In Python script
   if k == 'organisationsnamn' and isinstance(v, str):
       v = v.split('$')[0]  # Extract primary name
   ```

3. **Add postadress formatting:**
   ```python
   if k == 'postadress' and isinstance(v, str):
       v = v.replace('\n', ', ')  # Convert multiline to single line
   ```

4. **Skip namnskyddslopnummer:**
   ```python
   if k == 'namnskyddslopnummer':
       continue  # Skip entirely (100% null)
   ```

5. **Add retry logic:**
   ```typescript
   async function importBatchWithRetry(batch, retries = 0) {
     const MAX_RETRIES = 3;
     try {
       const { error } = await supabase
         .from('companies')
         .upsert(batch, { onConflict: 'organisationsidentitet' });

       if (error) throw error;
       return { success: true };
     } catch (error) {
       if (retries < MAX_RETRIES) {
         await sleep(2000 * (retries + 1));
         return importBatchWithRetry(batch, retries + 1);
       }
       return { success: false, error };
     }
   }
   ```

#### Step 3: Run Import

```bash
cd ~/Desktop/CLAUDE_CODE\ /projects/personupplysning
npm run db:import
```

**Expected output:**
```
🚀 Starting Parquet → Supabase import...
📄 Processing file 1/2: train-00000-of-00002.parquet
📊 Total rows: 941,632

📥 Importing batch 1/942 (1000 rows)...
✓ Batch 1 imported (1,000 / 1,883,264 = 0.1%)
...
📄 Processing file 2/2: train-00001-of-00002.parquet
...
✅ IMPORT COMPLETE!
📊 Imported: 1,883,264 companies
❌ Errors: 0
⏱️  Time: 23 minutes
```

#### Step 4: Verify Import

```bash
npx tsx scripts/verify-import.ts
```

**Verification checks:**
```typescript
// 1. Row count
const { count } = await supabase
  .from('companies')
  .select('*', { count: 'exact', head: true });

console.log(`✓ Total rows: ${count} (expected: 1,883,264)`);

// 2. No duplicates
const { data: dupes } = await supabase
  .rpc('check_duplicates');

console.log(`✓ Duplicates: ${dupes.length} (expected: 0)`);

// 3. Index creation
const { data: indexes } = await supabase
  .rpc('list_indexes', { table_name: 'companies' });

console.log(`✓ Indexes: ${indexes.length} (expected: 6)`);

// 4. Search test
const { data } = await supabase
  .from('companies')
  .select('*')
  .ilike('organisationsnamn', '%Nordea%')
  .limit(10);

console.log(`✓ Search works: ${data.length} results`);
```

### Phase 2: Postcodes Import

#### Step 1: Create Import Script

**File:** `scripts/import-postcodes.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import pandas as pd
from shapely import wkb
from pyproj import Transformer

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function importPostcodes() {
  console.log('🗺️  Importing Swedish postcodes...\n');

  // Run Python aggregation
  const pythonScript = `
import pandas as pd
from shapely import wkb
from pyproj import Transformer
import json

# Load parquet
df = pd.read_parquet('/Users/isak/Desktop/swedish_postcodes/swedish_postcodes.parquet')

# Convert coordinates
transformer = Transformer.from_crs("EPSG:3006", "EPSG:4326", always_xy=True)

def extract_coords(wkb_geom):
    point = wkb.loads(bytes(wkb_geom))
    return transformer.transform(point.x, point.y)

df[['longitude', 'latitude']] = df['geometry'].apply(extract_coords).apply(pd.Series)

# Aggregate
agg = df.groupby('postnummer').agg({
    'longitude': 'mean',
    'latitude': 'mean',
    'geometry': 'count'
}).reset_index()

agg.columns = ['postnummer', 'longitude', 'latitude', 'address_count']
agg['postkod'] = agg['postnummer'].astype(str).str.zfill(5)

# Output JSON
records = agg[['postkod', 'latitude', 'longitude', 'address_count']].to_dict('records')
print(json.dumps(records))
  `;

  // Execute Python and import
  const postcodes = await executePythonScript(pythonScript);

  const { error } = await supabase
    .from('postcodes')
    .upsert(postcodes);

  if (error) throw error;

  console.log(`✅ Imported ${postcodes.length} postcodes`);
}
```

#### Step 2: Run Import

```bash
npx tsx scripts/import-postcodes.ts
```

**Expected output:**
```
🗺️  Importing Swedish postcodes...
✅ Imported 10,826 postcodes
⏱️  Time: 30 seconds
```

---

## 🔒 GDPR & Security

### Data Classification

✅ **Public data (OK to store):**
- All company data from Bolagsverket (public registry)
- Postcode coordinates from Lantmäteriet (public data)

### Legal Requirements

1. **Attribution:**
   ```
   Data från:
   - Bolagsverket (Swedish Companies Registration Office)
   - SCB (Statistics Sweden)
   - Lantmäteriet (Swedish Mapping Authority)

   License: CC-BY 4.0
   ```

2. **Add to README.md:**
   ```markdown
   ## Data Sources

   - **Company data:** Bolagsverket Öppna Data (CC-BY 4.0)
   - **Postcode data:** Lantmäteriet Belägenhetsadress (CC-BY 4.0)
   ```

3. **User query logging (optional):**
   ```sql
   -- If implementing analytics
   CREATE TABLE api_request_log (
     id BIGSERIAL PRIMARY KEY,
     tool_name TEXT,
     query_type TEXT,  -- Generic, no personal data
     timestamp TIMESTAMPTZ DEFAULT NOW(),
     response_time_ms INTEGER
   );

   -- Auto-delete after 30 days
   CREATE OR REPLACE FUNCTION delete_old_logs()
   RETURNS void AS $$
   BEGIN
     DELETE FROM api_request_log
     WHERE timestamp < NOW() - INTERVAL '30 days';
   END;
   $$ LANGUAGE plpgsql;
   ```

### Security Measures

- ✅ Supabase RLS enabled (Row Level Security)
- ✅ Service role key in environment variables (never commit)
- ✅ HTTPS only (Render enforces)
- ✅ Public read access (public data)
- ✅ No write access via API

---

## 📈 Performance Optimization

### Query Patterns & Indexes

| Query Type | Index Used | Performance |
|------------|-----------|-------------|
| `organisationsidentitet = ?` | UNIQUE B-tree | < 1ms |
| `organisationsnamn ILIKE '%xyz%'` | GIN trigram | < 100ms |
| `organisationsform = 'AB'` | B-tree | < 50ms |
| `avregistreringsdatum IS NULL` | Partial B-tree | < 50ms |
| `registreringsdatum BETWEEN ... AND ...` | B-tree | < 100ms |
| Full-text search | GIN tsvector | < 200ms |

### Post-Import Optimization

```sql
-- Analyze tables for query planner
ANALYZE companies;
ANALYZE postcodes;

-- Vacuum to reclaim space
VACUUM ANALYZE companies;
VACUUM ANALYZE postcodes;

-- Check index usage
SELECT
  schemaname, tablename, indexname,
  idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('companies', 'postcodes')
ORDER BY idx_scan DESC;
```

---

## 🎯 New MCP Tools (Post-Import)

### 1. Enhanced Company Search

```typescript
{
  name: "search_companies",
  description: "Search for companies with filters",
  parameters: {
    query: "string (company name, fuzzy search)",
    organisationsform: "string (optional, e.g., 'AB')",
    active_only: "boolean (default: false)",
    kommun: "string (optional, requires postcodes)",
    limit: "number (default: 20)"
  }
}
```

### 2. Company Location

```typescript
{
  name: "get_company_location",
  description: "Get geographical location of a company",
  parameters: {
    organisationsidentitet: "string (10-digit org number)"
  },
  returns: {
    organisationsnamn: "string",
    postkod: "string",
    latitude: "number",
    longitude: "number"
  }
}
```

### 3. Nearby Companies

```typescript
{
  name: "get_companies_near",
  description: "Find companies within radius of a location",
  parameters: {
    latitude: "number",
    longitude: "number",
    radius_km: "number (default: 10)",
    limit: "number (default: 50)"
  }
}
```

### 4. Regional Statistics

```typescript
{
  name: "get_regional_stats",
  description: "Company statistics by postkod area",
  parameters: {
    postkod_prefix: "string (e.g., '111' for Stockholm)"
  },
  returns: {
    total_companies: "number",
    active_companies: "number",
    by_organisationsform: "object"
  }
}
```

---

## ✅ Checklist

### Pre-Import

- [ ] Supabase Pro tier activated ($25/month)
- [ ] Environment variables configured (`.env`)
- [ ] Parquet files copied to `data/` folder
- [ ] Python dependencies installed (`pandas`, `pyarrow`, `shapely`, `pyproj`)
- [ ] Import scripts updated with transformations

### Import Phase 1: Companies

- [ ] Run `npm run db:setup` (create tables)
- [ ] Run `npm run db:import` (import 1.88M companies)
- [ ] Verify row count (1,883,264)
- [ ] Check indexes created (6 indexes)
- [ ] Test search functionality
- [ ] Run ANALYZE and VACUUM

### Import Phase 2: Postcodes

- [ ] Create `import-postcodes.ts` script
- [ ] Run postcode import (10,826 rows)
- [ ] Verify coordinate ranges (55-69°N, 11-24°E)
- [ ] Test company-postcode join
- [ ] Verify match rate (~98%)

### Post-Import

- [ ] Add data attribution to README
- [ ] Update MCP tools with new functions
- [ ] Test all MCP tools
- [ ] Deploy to Render
- [ ] Verify production deployment
- [ ] Monitor performance
- [ ] Document query patterns

---

## 🐛 Troubleshooting

### Import fails with "out of memory"

**Solution:** Reduce batch size to 500 rows:
```typescript
const BATCH_SIZE = 500;
```

### Supabase timeout errors

**Solution:** Add retry logic (already implemented) and increase delay:
```typescript
await sleep(5000 * (retries + 1)); // 5 second delay
```

### Postcode match rate is low

**Solution:** Improve postkod extraction regex:
```python
# Extract from various formats: "11115", "111 15", etc.
match = re.search(r'(\d{3})\s*(\d{2})', clean_addr)
if match:
    return match.group(1) + match.group(2)
```

### Indexes not being used

**Solution:** Run ANALYZE and check query planner:
```sql
EXPLAIN ANALYZE
SELECT * FROM companies
WHERE organisationsnamn ILIKE '%Nordea%';
```

---

## 📞 Support

Om du stöter på problem:
1. Kolla logs: `~/Desktop/CLAUDE_CODE /projects/personupplysning/logs/`
2. Testa Supabase connection: `npm run test:supabase`
3. Verifiera data: `npx tsx scripts/verify-import.ts`

---

**Skapad:** 2025-12-01
**Senast uppdaterad:** 2025-12-01
**Status:** ✅ Ready for implementation
