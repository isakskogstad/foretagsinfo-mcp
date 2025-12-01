#!/usr/bin/env tsx
/**
 * Fast parallel REST API import
 * Works around PostgREST cache issue by using raw HTTP
 */

import axios from 'axios';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = 2000; // Larger batches
const PARALLEL_REQUESTS = 5; // Run 5 batches in parallel
const CSV_PATH = 'data/bolagsverket_data.csv';

interface Company {
  organisationsidentitet: string;
  organisationsnamn: string;
  [key: string]: any;
}

async function importBatch(batch: Company[], batchNum: number) {
  try {
    const response = await axios.post(
      `${SUPABASE_URL}/rest/v1/companies`,
      batch,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        }
      }
    );
    return { success: true, batchNum, count: batch.length };
  } catch (error: any) {
    return { success: false, batchNum, error: error.response?.data || error.message };
  }
}

async function importCSV() {
  console.log('🚀 Fast parallel REST API import\n');
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log(`⚡ Parallel requests: ${PARALLEL_REQUESTS}\n`);

  let batch: Company[] = [];
  let batches: Company[][] = [];
  let totalRows = 0;

  const parser = createReadStream(CSV_PATH).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: (value) => value === '' || value === '\\N' ? null : value
    })
  );

  // Define ALL columns (ensures every record has same keys)
  const allColumns = [
    'organisationsidentitet',
    'namnskyddslopnummer',
    'registreringsland',
    'organisationsnamn',
    'organisationsform',
    'avregistreringsdatum',
    'avregistreringsorsak',
    'pagandeavvecklingselleromsstruktureringsforfarande',
    'registreringsdatum',
    'verksamhetsbeskrivning',
    'postadress'
  ];

  // Read all data into batches first
  console.log('📂 Reading CSV...');
  for await (const record of parser) {
    // Fix column name
    if (record.pagandeavvecklingselleromstruktureringsforfarande) {
      record.pagandeavvecklingselleromsstruktureringsforfarande =
        record.pagandeavvecklingselleromstruktureringsforfarande;
      delete record.pagandeavvecklingselleromstruktureringsforfarande;
    }

    // Ensure ALL columns exist (even if null)
    const normalized: any = {};
    for (const col of allColumns) {
      normalized[col] = record[col] || null;
    }

    batch.push(normalized);
    totalRows++;

    if (batch.length >= BATCH_SIZE) {
      batches.push([...batch]);
      batch = [];
    }
  }

  if (batch.length > 0) {
    batches.push(batch);
  }

  console.log(`✓ Loaded ${totalRows.toLocaleString()} rows into ${batches.length} batches\n`);
  console.log('📥 Starting parallel import...\n');

  let imported = 0;
  let errors = 0;

  // Process batches in parallel chunks
  for (let i = 0; i < batches.length; i += PARALLEL_REQUESTS) {
    const chunk = batches.slice(i, i + PARALLEL_REQUESTS);
    const promises = chunk.map((b, idx) => importBatch(b, i + idx + 1));

    const results = await Promise.all(promises);

    for (const result of results) {
      if (result.success) {
        imported += result.count;
        const progress = ((imported / totalRows) * 100).toFixed(1);
        console.log(`✓ Batch ${result.batchNum}/${batches.length} (${imported.toLocaleString()}/${totalRows.toLocaleString()} = ${progress}%)`);
      } else {
        console.log(`❌ Batch ${result.batchNum} failed:`, result.error);
        errors++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ IMPORT COMPLETE!`);
  console.log(`📊 Imported: ${imported.toLocaleString()} companies`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(60));
}

importCSV().catch(err => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
