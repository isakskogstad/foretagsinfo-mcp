/**
 * Test iXBRL parsing with real documents
 */
import 'dotenv/config';
import { executeGetDocuments } from './src/tools/get-documents.js';
import { executeGetAnnualReport } from './src/tools/get-annual-report.js';
import { getBolagsverketClient } from './src/api-client/bolagsverket.js';
import { parseIXBRL } from './src/utils/ixbrl-parser.js';
import JSZip from 'jszip';

const TEST_COMPANIES = [
  { name: 'Virus Östergötland AB', orgNumber: '5567654321' },
  { name: 'Senior Candy AB', orgNumber: '5566543210' },
];

async function testParsing() {
  console.log('🔬 Testing iXBRL Parsing\n');
  console.log('='.repeat(70));

  const client = getBolagsverketClient();

  for (const company of TEST_COMPANIES) {
    console.log(`\n📋 ${company.name} (${company.orgNumber})`);
    console.log('-'.repeat(70));

    try {
      // Get document list
      const docs = await client.getDocumentList(company.orgNumber);
      console.log(`Found ${docs.length} documents`);

      if (docs.length === 0) {
        console.log('No documents available');
        continue;
      }

      // Show available documents
      for (const doc of docs) {
        console.log(`  - ${doc.rapporteringsperiodTom} (${doc.filformat})`);
      }

      // Get the most recent document
      const latestDoc = docs[0];
      console.log(`\nDownloading: ${latestDoc.dokumentId}`);

      // Download
      const zipBuffer = await client.downloadDocument(latestDoc.dokumentId);
      console.log(`Downloaded: ${zipBuffer.length} bytes`);

      // Examine ZIP contents
      const zip = await JSZip.loadAsync(zipBuffer);
      console.log('\nZIP contents:');
      for (const [filename, file] of Object.entries(zip.files)) {
        if (!file.dir) {
          const content = await file.async('string');
          console.log(`  - ${filename} (${content.length} chars)`);

          // If XHTML/XML, show first 500 chars
          if (filename.endsWith('.xhtml') || filename.endsWith('.xml')) {
            console.log('\n  Preview:');
            console.log('  ' + content.substring(0, 500).replace(/\n/g, '\n  '));
            console.log('  ...\n');
          }
        }
      }

      // Parse using our parser
      console.log('\n📊 Parsing with our iXBRL parser:');
      const parsed = await parseIXBRL(zipBuffer, 'test');

      console.log('\nParsed Result:');
      console.log(JSON.stringify(parsed, null, 2));

      // Evaluate quality
      console.log('\n📈 Parsing Quality Assessment:');
      const fields = [
        { name: 'Period', value: parsed.period.from && parsed.period.to },
        { name: 'Revenue', value: parsed.incomeStatement.revenue !== undefined },
        { name: 'Operating Result', value: parsed.incomeStatement.operatingResult !== undefined },
        { name: 'Net Income', value: parsed.incomeStatement.netIncome !== undefined },
        { name: 'Total Assets', value: parsed.balanceSheet.totalAssets !== undefined },
        { name: 'Equity', value: parsed.balanceSheet.equity !== undefined },
        { name: 'Solidity', value: parsed.keyMetrics.solidityPercent !== undefined },
        { name: 'Employees', value: parsed.keyMetrics.employees !== undefined },
        { name: 'Board Members', value: parsed.management.boardMembers.length > 0 },
        { name: 'CEO', value: parsed.management.ceo !== undefined },
      ];

      const found = fields.filter(f => f.value).length;
      console.log(`\nExtracted ${found}/${fields.length} fields:`);
      for (const field of fields) {
        console.log(`  ${field.value ? '✅' : '❌'} ${field.name}`);
      }

      // Now test through the tool
      console.log('\n\n🔧 Testing via get_annual_report tool:');
      const toolResult = await executeGetAnnualReport({ org_number: company.orgNumber }, 'test');

      if (toolResult.isError) {
        console.log('❌ Tool error:', toolResult.content[0].text);
      } else {
        console.log('✅ Tool output:');
        console.log(toolResult.content[0].text);
      }

    } catch (error) {
      console.log('❌ Error:', error);
    }

    console.log('\n' + '='.repeat(70));
  }
}

testParsing().catch(console.error);
