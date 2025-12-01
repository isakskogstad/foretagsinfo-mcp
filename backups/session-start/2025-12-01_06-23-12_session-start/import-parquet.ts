#!/usr/bin/env tsx
/**
 * Import Bolagsverket Parquet data to Supabase
 *
 * Imports 1.88M companies in batches of 1000
 * Estimated time: 15-30 minutes
 */

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
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

const PARQUET_PATH = join(process.cwd(), 'data/bolagsverket_data.parquet');
const BATCH_SIZE = 1000;
const TEMP_JSON_PATH = join(process.cwd(), 'data/temp_batch.json');

async function importData() {
  console.log('🚀 Starting Parquet → Supabase import...\n');
  console.log('📄 Source:', PARQUET_PATH);
  console.log('🎯 Target: Supabase companies table');
  console.log('📦 Batch size:', BATCH_SIZE, '\n');

  // Step 1: Convert Parquet to JSON using Python
  console.log('🐍 Converting Parquet to JSON batches using Python...\n');

  const pythonScript = `
import pyarrow.parquet as pq
import json
import sys

parquet_file = '${PARQUET_PATH}'
batch_size = ${BATCH_SIZE}

try:
    # Read parquet file
    table = pq.read_table(parquet_file)
    df = table.to_pandas()

    # Clean column names
    df.columns = df.columns.str.lower().str.replace('__index_level_0__', 'original_index')

    # Convert to records
    total_rows = len(df)
    print(f"Total rows: {total_rows:,}", file=sys.stderr)

    # Replace NaN with None before converting to dict
    df = df.where(df.notna(), None)

    # Process in batches
    for i in range(0, total_rows, batch_size):
        batch = df.iloc[i:i+batch_size]

        # Convert to JSON
        records = batch.to_dict('records')

        # Clean up data
        cleaned_records = []
        for record in records:
            # Remove None values and clean data
            cleaned = {}
            for k, v in record.items():
                if v is not None and v != 'None':
                    # Clean organisationsnamn (remove $FORETAGSNAMN-ORGNAM$ suffix)
                    if k == 'organisationsnamn' and isinstance(v, str):
                        v = v.split('$')[0]
                    cleaned[k] = v
            cleaned_records.append(cleaned)

        # Output batch info
        batch_num = (i // batch_size) + 1
        total_batches = (total_rows + batch_size - 1) // batch_size
        print(json.dumps({
            'batch': batch_num,
            'total_batches': total_batches,
            'start': i,
            'end': min(i + batch_size, total_rows),
            'records': cleaned_records
        }))

except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

  writeFileSync('/tmp/import_parquet.py', pythonScript);

  // Step 2: Run Python script and import batches
  const python = spawn('python3', ['/tmp/import_parquet.py'], {
    cwd: join(process.cwd(), 'venv/bin'),
    env: {
      ...process.env,
      VIRTUAL_ENV: join(process.cwd(), 'venv')
    }
  });

  let buffer = '';
  let totalImported = 0;
  let errors = 0;

  python.stdout.on('data', async (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const batch = JSON.parse(line);
        const { batch: batchNum, total_batches, records } = batch;

        // Import to Supabase
        console.log(`📥 Importing batch ${batchNum}/${total_batches} (${records.length} rows)...`);

        const { error } = await supabase
          .from('companies')
          .upsert(records, {
            onConflict: 'organisationsidentitet',
            ignoreDuplicates: false
          });

        if (error) {
          console.error(`❌ Batch ${batchNum} failed:`, error.message);
          errors++;
        } else {
          totalImported += records.length;
          const progress = ((totalImported / 1883264) * 100).toFixed(1);
          console.log(`✓ Batch ${batchNum} imported (${totalImported.toLocaleString()} / 1,883,264 = ${progress}%)\n`);
        }

      } catch (err) {
        console.error('Error parsing batch:', err);
      }
    }
  });

  python.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('Total rows:')) {
      console.log('📊', msg.trim(), '\n');
    } else {
      console.error('Python stderr:', msg);
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

  console.log('\n' + '='.repeat(60));
  console.log('✅ IMPORT COMPLETE!\n');
  console.log(`📊 Imported: ${totalImported.toLocaleString()} companies`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(60));

  // Verify import
  console.log('\n🔍 Verifying import...');
  const { count, error } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Verification failed:', error);
  } else {
    console.log(`✓ Database contains ${count?.toLocaleString()} companies\n`);
  }
}

importData().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
