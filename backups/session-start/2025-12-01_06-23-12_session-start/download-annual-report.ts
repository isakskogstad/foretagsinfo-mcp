#!/usr/bin/env tsx
/**
 * Download a sample annual report to understand iXBRL structure
 */

import { BolagsverketClient } from '../src/clients/bolagsverket-api';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

async function downloadSample() {
  console.log('📥 Downloading sample annual report from Bolagsverket\n');

  const client = new BolagsverketClient({
    enableLogging: true,
  });

  const testOrgId = '5569467466'; // Hundelska AB

  try {
    // 1. Get document list
    console.log('1️⃣ Getting document list...');
    const documents = await client.getDocumentList(testOrgId);

    if (documents.length === 0) {
      console.error('❌ No documents found');
      process.exit(1);
    }

    console.log(`✓ Found ${documents.length} documents\n`);

    // 2. Get the most recent document
    const latest = documents[documents.length - 1]; // Last in array should be most recent
    console.log('2️⃣ Downloading latest document:');
    console.log(`   Year: ${new Date(latest.rapporteringsperiodTom).getFullYear()}`);
    console.log(`   Format: ${latest.filformat}`);
    console.log(`   ID: ${latest.dokumentId}\n`);

    // 3. Download document
    const documentData = await client.getDocument(latest.dokumentId);

    // 4. Save to disk
    const sampleDir = join(process.cwd(), 'data', 'sample-reports');
    mkdirSync(sampleDir, { recursive: true });

    const filename = `${testOrgId}_${new Date(latest.rapporteringsperiodTom).getFullYear()}.zip`;
    const filepath = join(sampleDir, filename);

    // documentData is now always a Buffer
    writeFileSync(filepath, documentData);

    console.log(`✅ Downloaded to: ${filepath}`);
    console.log(`📦 File size: ${(documentData.length / 1024).toFixed(2)} KB`);

  } catch (error: any) {
    console.error('❌ Download failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

downloadSample();
