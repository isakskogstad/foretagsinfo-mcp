#!/usr/bin/env tsx
/**
 * Import from CSV to Supabase
 * CSV doesn't have NaN issues like Parquet
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const BATCH_SIZE = 1000;
const CSV_PATH = 'data/bolagsverket_data.csv';

async function importCSV() {
  console.log('🚀 Starting CSV → Supabase import\n');

  let batch: any[] = [];
  let totalImported = 0;
  let batchNum = 0;
  let errors = 0;

  const parser = createReadStream(CSV_PATH).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        // Convert empty strings to null
        if (value === '' || value === '\\N') return null;
        return value;
      }
    })
  );

  for await (const record of parser) {
    // Fix column name typo
    if (record.pagandeavvecklingselleromstruktureringsforfarande) {
      record.pagandeavvecklingselleromsstruktureringsforfarande =
        record.pagandeavvecklingselleromstruktureringsforfarande;
      delete record.pagandeavvecklingselleromstruktureringsforfarande;
    }

    batch.push(record);

    if (batch.length >= BATCH_SIZE) {
      batchNum++;
      process.stdout.write(`📥 Batch ${batchNum}: Importing ${batch.length} rows... `);

      const { error } = await supabase
        .from('companies')
        .upsert(batch, {
          onConflict: 'organisationsidentitet',
          ignoreDuplicates: false
        });

      if (error) {
        console.log(`❌ Error: ${error.message}`);
        errors++;
      } else {
        totalImported += batch.length;
        const progress = ((totalImported / 1883264) * 100).toFixed(1);
        console.log(`✓ (${totalImported.toLocaleString()} / 1,883,264 = ${progress}%)`);
      }

      batch = [];
    }
  }

  // Import remaining records
  if (batch.length > 0) {
    batchNum++;
    console.log(`📥 Final batch ${batchNum}: Importing ${batch.length} rows...`);

    const { error } = await supabase
      .from('companies')
      .upsert(batch, {
        onConflict: 'organisationsidentitet'
      });

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      errors++;
    } else {
      totalImported += batch.length;
      console.log(`✓ Done`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ IMPORT COMPLETE!\n');
  console.log(`📊 Imported: ${totalImported.toLocaleString()} companies`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(60));

  // Verify
  const { count } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  console.log(`\n✓ Database contains ${count?.toLocaleString()} companies\n`);
}

importCSV().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
