/**
 * Find companies that have digital documents available
 * These are typically smaller companies that submit digitally
 */
import 'dotenv/config';
import { getBolagsverketClient } from './src/api-client/bolagsverket.js';
import { validateOrgNumber } from './src/utils/validators.js';

// Sample company numbers to test (various sizes/types)
// These are random valid-checksum org numbers from different series
const SAMPLE_ORG_NUMBERS = [
  // Series starting with 556 (AB)
  '5566172266', // Random AB
  '5566789012', // Random AB
  '5569876543', // Random AB
  '5565432109', // Random AB
  '5564321098', // Random AB
  '5563210987', // Random AB
  '5562109876', // Random AB
  '5568765432', // Random AB
  '5567654321', // Random AB
  '5566543210', // Random AB
  // Recent registrations (higher numbers)
  '5593456789', // Newer AB
  '5592345678', // Newer AB
  '5591234567', // Newer AB
  // Try some specific ones found online
  '5590822656', // Small company
  '5590712635', // Small company
  '5590612345', // Small company
];

// Calculate Luhn checksum
function calculateLuhn(num: string): number {
  const digits = num.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

// Generate valid org numbers
function generateValidOrgNumbers(prefix: string, count: number): string[] {
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    const base = prefix + String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    if (base.length === 9) {
      const checksum = calculateLuhn(base);
      results.push(base + checksum);
    }
  }
  return results;
}

async function findCompaniesWithDocs() {
  console.log('🔍 Searching for companies with digital documents...\n');

  const client = getBolagsverketClient();
  const foundWithDocs: Array<{ orgNumber: string; name: string; docCount: number }> = [];

  // Generate some random valid org numbers
  const randomOrgs = generateValidOrgNumbers('55901', 20);
  const allOrgs = [...SAMPLE_ORG_NUMBERS, ...randomOrgs];

  console.log(`Testing ${allOrgs.length} org numbers...\n`);

  for (const orgNumber of allOrgs) {
    try {
      // Validate checksum
      try {
        validateOrgNumber(orgNumber);
      } catch {
        continue; // Skip invalid checksums
      }

      // Get documents
      const docs = await client.getDocumentList(orgNumber);

      if (docs.length > 0) {
        // Get company name
        const company = await client.getCompany(orgNumber);
        const name = company?.organisationsnamn?.organisationsnamnLista?.[0]?.namn || 'Unknown';

        console.log(`✅ Found! ${orgNumber} - ${name} (${docs.length} docs)`);
        foundWithDocs.push({ orgNumber, name, docCount: docs.length });

        if (foundWithDocs.length >= 3) {
          break; // Stop after finding 3
        }
      } else {
        process.stdout.write('.');
      }

      // Rate limit - be nice to the API
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      process.stdout.write('x');
    }
  }

  console.log('\n\n📋 Summary:');
  console.log(`Found ${foundWithDocs.length} companies with documents:\n`);

  for (const company of foundWithDocs) {
    console.log(`  ${company.orgNumber} - ${company.name} (${company.docCount} docs)`);
  }

  // Export for test script
  if (foundWithDocs.length > 0) {
    console.log('\n\n📝 Add to test-tools.ts:');
    console.log('const TEST_COMPANIES_WITH_DOCS = [');
    for (const c of foundWithDocs) {
      console.log(`  { name: '${c.name}', orgNumber: '${c.orgNumber}' },`);
    }
    console.log('];');
  }
}

findCompaniesWithDocs().catch(console.error);
