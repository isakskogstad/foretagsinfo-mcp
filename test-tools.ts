/**
 * Test script for Företagsinfo MCP tools
 * Run with: npx tsx test-tools.ts
 */
import 'dotenv/config';
import { executeGetCompany } from './src/tools/get-company.js';
import { executeGetDocuments } from './src/tools/get-documents.js';
import { executeGetAnnualReport } from './src/tools/get-annual-report.js';

// Test companies - mix of large companies and small ones with digital documents
const TEST_COMPANIES = [
  { name: 'Volvo Cars', orgNumber: '5560743089' },
  { name: 'H&M', orgNumber: '5560427220' },
  // Companies with digital annual reports (found via find-companies-with-docs.ts)
  { name: 'Virus Östergötland AB', orgNumber: '5567654321' },
  { name: 'Senior Candy AB', orgNumber: '5566543210' },
];

async function testGetCompany(orgNumber: string, name: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing get_company: ${name} (${orgNumber})`);
  console.log('='.repeat(60));

  try {
    const result = await executeGetCompany({ org_number: orgNumber }, 'test-1');

    if (result.isError) {
      console.log('❌ ERROR:', result.content[0].text);
      return false;
    }

    console.log('✅ SUCCESS');
    console.log(result.content[0].text.substring(0, 1000));
    if (result.content[0].text.length > 1000) {
      console.log('... (truncated)');
    }
    return true;
  } catch (error) {
    console.log('❌ EXCEPTION:', error);
    return false;
  }
}

async function testGetDocuments(orgNumber: string, name: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing get_documents: ${name} (${orgNumber})`);
  console.log('='.repeat(60));

  try {
    const result = await executeGetDocuments({ org_number: orgNumber }, 'test-2');

    if (result.isError) {
      console.log('❌ ERROR:', result.content[0].text);
      return { success: false, hasDocuments: false };
    }

    console.log('✅ SUCCESS');
    console.log(result.content[0].text);

    // Check if documents were found
    const hasDocuments = !result.content[0].text.includes('Inga digitala dokument');
    return { success: true, hasDocuments };
  } catch (error) {
    console.log('❌ EXCEPTION:', error);
    return { success: false, hasDocuments: false };
  }
}

async function testGetAnnualReport(orgNumber: string, name: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing get_annual_report: ${name} (${orgNumber})`);
  console.log('='.repeat(60));

  try {
    const result = await executeGetAnnualReport({ org_number: orgNumber }, 'test-3');

    if (result.isError) {
      console.log('❌ ERROR:', result.content[0].text);
      return { success: false, parsedData: null };
    }

    console.log('✅ SUCCESS');
    console.log(result.content[0].text);

    // Analyze what was parsed
    const text = result.content[0].text;
    const parsedData = {
      hasRevenue: text.includes('Nettoomsättning'),
      hasOperatingResult: text.includes('Rörelseresultat'),
      hasNetIncome: text.includes('Årets resultat'),
      hasTotalAssets: text.includes('Summa tillgångar'),
      hasEquity: text.includes('Eget kapital'),
      hasSolidity: text.includes('Soliditet'),
      hasEmployees: text.includes('anställda'),
      hasBoard: text.includes('Styrelse') || text.includes('VD'),
    };

    console.log('\n📊 Parsing Analysis:');
    console.log(`  Revenue: ${parsedData.hasRevenue ? '✅' : '❌'}`);
    console.log(`  Operating Result: ${parsedData.hasOperatingResult ? '✅' : '❌'}`);
    console.log(`  Net Income: ${parsedData.hasNetIncome ? '✅' : '❌'}`);
    console.log(`  Total Assets: ${parsedData.hasTotalAssets ? '✅' : '❌'}`);
    console.log(`  Equity: ${parsedData.hasEquity ? '✅' : '❌'}`);
    console.log(`  Solidity: ${parsedData.hasSolidity ? '✅' : '❌'}`);
    console.log(`  Employees: ${parsedData.hasEmployees ? '✅' : '❌'}`);
    console.log(`  Board/CEO: ${parsedData.hasBoard ? '✅' : '❌'}`);

    return { success: true, parsedData };
  } catch (error) {
    console.log('❌ EXCEPTION:', error);
    return { success: false, parsedData: null };
  }
}

async function main() {
  console.log('🚀 Starting Företagsinfo MCP Tool Tests');
  console.log(`📅 ${new Date().toISOString()}`);

  // Check credentials
  if (!process.env.BOLAGSVERKET_CLIENT_ID || !process.env.BOLAGSVERKET_CLIENT_SECRET) {
    console.error('❌ Missing BOLAGSVERKET credentials in .env');
    process.exit(1);
  }
  console.log('✅ Credentials found');

  const results = {
    getCompany: { success: 0, failed: 0 },
    getDocuments: { success: 0, failed: 0, withDocs: 0 },
    getAnnualReport: { success: 0, failed: 0, parsedFields: [] as any[] },
  };

  // Test each company
  for (const company of TEST_COMPANIES) {
    // Test get_company
    const companyResult = await testGetCompany(company.orgNumber, company.name);
    if (companyResult) {
      results.getCompany.success++;
    } else {
      results.getCompany.failed++;
    }

    // Test get_documents
    const docsResult = await testGetDocuments(company.orgNumber, company.name);
    if (docsResult.success) {
      results.getDocuments.success++;
      if (docsResult.hasDocuments) {
        results.getDocuments.withDocs++;
      }
    } else {
      results.getDocuments.failed++;
    }

    // Test get_annual_report (only if documents exist)
    if (docsResult.hasDocuments) {
      const reportResult = await testGetAnnualReport(company.orgNumber, company.name);
      if (reportResult.success) {
        results.getAnnualReport.success++;
        results.getAnnualReport.parsedFields.push({
          company: company.name,
          ...reportResult.parsedData,
        });
      } else {
        results.getAnnualReport.failed++;
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));

  console.log(`\nget_company: ${results.getCompany.success}/${TEST_COMPANIES.length} passed`);
  console.log(`get_documents: ${results.getDocuments.success}/${TEST_COMPANIES.length} passed (${results.getDocuments.withDocs} with documents)`);
  console.log(`get_annual_report: ${results.getAnnualReport.success}/${results.getDocuments.withDocs} passed`);

  if (results.getAnnualReport.parsedFields.length > 0) {
    console.log('\n📊 iXBRL Parsing Quality:');
    for (const parsed of results.getAnnualReport.parsedFields) {
      const fields = Object.entries(parsed).filter(([k, v]) => k !== 'company' && v === true).length;
      const total = Object.entries(parsed).filter(([k]) => k !== 'company').length;
      console.log(`  ${parsed.company}: ${fields}/${total} fields extracted`);
    }
  }

  const allPassed =
    results.getCompany.failed === 0 &&
    results.getDocuments.failed === 0 &&
    results.getAnnualReport.failed === 0;

  console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
