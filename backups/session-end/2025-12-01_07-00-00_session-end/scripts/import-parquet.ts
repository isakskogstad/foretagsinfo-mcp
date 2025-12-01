#!/usr/bin/env tsx
/**
 * Import Bolagsverket Parquet data to Supabase
 *
 * Imports 1.88M companies from 2 parquet files in batches of 1000
 * Estimated time: 20-30 minutes
 */

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Process both parquet files
const PARQUET_FILES = [
  join(process.cwd(), 'data/train-00000-of-00002.parquet'),
  join(process.cwd(), 'data/train-00001-of-00002.parquet')
];

const BATCH_SIZE = 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry logic for batch import
async function importBatchWithRetry(batch: any[], batchNum: number, totalBatches: number, retries = 0): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('companies')
      .upsert(batch, {
        onConflict: 'organisationsidentitet',
        ignoreDuplicates: false
      });

    if (error) throw error;
    return { success: true };

  } catch (error: any) {
    if (retries < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * (retries + 1);
      console.log(`  ⚠️  Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms...`);
      await sleep(delay);
      return importBatchWithRetry(batch, batchNum, totalBatches, retries + 1);
    }

    console.error(`  ❌ Batch ${batchNum}/${totalBatches} failed after ${MAX_RETRIES} retries:`, error.message);
    return { success: false, error };
  }
}

async function importData() {
  console.log('🚀 Starting Bolagsverket → Supabase import...\n');
  console.log('📦 Batch size:', BATCH_SIZE);
  console.log('📄 Processing', PARQUET_FILES.length, 'parquet files\n');

  let totalImported = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  // Process each parquet file
  for (let fileIdx = 0; fileIdx < PARQUET_FILES.length; fileIdx++) {
    const parquetPath = PARQUET_FILES[fileIdx];
    const fileNum = fileIdx + 1;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Processing file ${fileNum}/${PARQUET_FILES.length}`);
    console.log(`   ${parquetPath}`);
    console.log('='.repeat(60) + '\n');

    // Python script to read parquet and output JSON batches
    const pythonScript = `
import pyarrow.parquet as pq
import json
import sys

parquet_file = '${parquetPath}'
batch_size = ${BATCH_SIZE}

try:
    # Read parquet file
    table = pq.read_table(parquet_file)
    df = table.to_pandas()

    # Replace NaN with None
    df = df.where(df.notna(), None)

    # Get total rows
    total_rows = len(df)
    print(f"Total rows in file: {total_rows:,}", file=sys.stderr)

    # Process in batches
    for i in range(0, total_rows, batch_size):
        batch = df.iloc[i:i+batch_size]

        # Convert to records
        records = batch.to_dict('records')

        # Clean up data
        cleaned_records = []
        for record in records:
            cleaned = {}
            for k, v in record.items():
                # Skip null values and deprecated field
                if v is None or v == 'None':
                    continue

                # Skip namnskyddslopnummer (100% null)
                if k == 'namnskyddslopnummer':
                    continue

                # Skip __index_level_0__ (internal pandas index)
                if k == '__index_level_0__':
                    continue

                # Transform organisationsnamn: remove $FORETAGSNAMN-ORGNAM$ suffix
                if k == 'organisationsnamn' and isinstance(v, str):
                    v = v.split('$')[0].strip()

                # Transform postadress: multiline to comma-separated
                if k == 'postadress' and isinstance(v, str):
                    v = v.replace('\\n', ', ').strip()
                    # Remove leading comma if address starts with newline
                    if v.startswith(','):
                        v = v[1:].strip()

                cleaned[k] = v

            # Only add if we have required fields
            if 'organisationsidentitet' in cleaned and 'organisationsnamn' in cleaned:
                cleaned_records.append(cleaned)

        # Output batch info
        batch_num = (i // batch_size) + 1
        total_batches = (total_rows + batch_size - 1) // batch_size

        print(json.dumps({
            'batch': batch_num,
            'total_batches': total_batches,
            'start': i,
            'end': min(i + batch_size, total_rows),
            'records': cleaned_records,
            'file_num': ${fileNum},
            'total_files': ${PARQUET_FILES.length}
        }))

except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
`;

    writeFileSync('/tmp/import_parquet.py', pythonScript);

    // Run Python script using venv
    const pythonPath = join(process.cwd(), 'venv/bin/python3');
    const python = spawn(pythonPath, ['/tmp/import_parquet.py'], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'
      }
    });

    let buffer = '';

    python.stdout.on('data', async (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const batch = JSON.parse(line);
          const { batch: batchNum, total_batches, records, file_num } = batch;

          // Import to Supabase with retry
          const progress = ((totalImported + records.length) / 1883264) * 100;
          console.log(`📥 [File ${file_num}/${PARQUET_FILES.length}] Batch ${batchNum}/${total_batches} (${records.length} rows) - ${progress.toFixed(1)}% total`);

          const result = await importBatchWithRetry(records, batchNum, total_batches);

          if (result.success) {
            totalImported += records.length;
            console.log(`   ✓ Imported (${totalImported.toLocaleString()} total)\n`);
          } else {
            totalErrors++;
          }

        } catch (err) {
          console.error('Error parsing batch:', err);
          totalErrors++;
        }
      }
    });

    python.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Total rows in file:')) {
        console.log('📊', msg.trim());
      } else if (msg.includes('Error:')) {
        console.error('❌ Python error:', msg);
      }
    });

    await new Promise((resolve, reject) => {
      python.on('close', (code) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Python process exited with code ${code}`));
        }
      });
    });
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('✅ IMPORT COMPLETE!\n');
  console.log(`📊 Imported: ${totalImported.toLocaleString()} companies`);
  console.log(`❌ Errors: ${totalErrors}`);
  console.log(`⏱️  Time: ${duration} minutes`);
  console.log('='.repeat(60));

  // Verify import
  console.log('\n🔍 Verifying import...');
  const { count, error } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Verification failed:', error);
  } else {
    console.log(`✓ Database contains ${count?.toLocaleString()} companies`);

    // Check success rate
    const successRate = ((count! / 1883264) * 100).toFixed(1);
    console.log(`✓ Success rate: ${successRate}%`);

    if (count! < 1880000) {
      console.warn(`\n⚠️  Warning: Expected ~1,883,264 companies, got ${count?.toLocaleString()}`);
      console.warn(`   Check logs for errors`);
    }
  }

  console.log('\n📈 Next steps:');
  console.log('  1. Run ANALYZE: npx tsx scripts/analyze-tables.ts');
  console.log('  2. Import postcodes: npx tsx scripts/import-postcodes.ts');
  console.log('  3. Test search: npx tsx scripts/test-search.ts\n');
}

importData().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
