#!/usr/bin/env tsx
/**
 * Force PostgREST to reload schema cache
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function reloadSchema() {
  console.log('🔄 Forcing PostgREST schema reload...\n');

  const { error } = await supabase.rpc('pgrst_reload_schema');

  if (error) {
    console.log('Note: RPC reload may not be available, trying NOTIFY...');

    // Alternative: use raw SQL
    const { error: sqlError } = await supabase
      .from('_pgrst')
      .select('*');

    if (sqlError) {
      console.error('Could not reload schema automatically.');
      console.log('\n📋 Manual fix needed:');
      console.log('1. Go to: https://supabase.com/dashboard/project/thjwryuhtwlfxwduyqqd');
      console.log('2. SQL Editor → New query');
      console.log('3. Run: NOTIFY pgrst, \'reload schema\';');
      console.log('\nOr restart your Supabase project from the dashboard.');
    }
  } else {
    console.log('✅ Schema reloaded!\n');
  }
}

reloadSchema();
