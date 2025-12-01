#!/usr/bin/env tsx
/**
 * Run SQL file against Supabase database
 * Usage: tsx scripts/run-sql.ts scripts/schema.sql
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: tsx scripts/run-sql.ts <sql-file>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSql() {
  console.log(`📄 Reading SQL from: ${sqlFile}\n`);
  const sql = readFileSync(sqlFile, 'utf-8');

  console.log('🚀 Executing SQL...\n');

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const [index, statement] of statements.entries()) {
    if (statement.length < 10) continue; // Skip empty/comment-only

    console.log(`Executing statement ${index + 1}/${statements.length}...`);

    const { data, error } = await supabase.rpc('exec', { sql: statement });

    if (error) {
      console.error(`❌ Error in statement ${index + 1}:`, error.message);
      console.error('Statement:', statement.substring(0, 100) + '...');
      // Continue to next statement
    } else {
      console.log(`✓ Statement ${index + 1} executed`);
    }
  }

  console.log('\n✅ SQL execution complete!');
}

runSql().catch(console.error);
