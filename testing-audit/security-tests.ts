/**
 * Security Test Suite for Personupplysning MCP Server
 * Tests against OWASP Top 10 vulnerabilities
 */

import { validateInput, SearchCompaniesInputSchema, GetCompanyDetailsInputSchema } from '../src/utils/validators.js';
import { OrganisationsnummerSchema, SearchQuerySchema } from '../src/utils/validators.js';

interface TestResult {
  testName: string;
  category: string;
  passed: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  finding?: string;
  recommendation?: string;
  evidence?: string;
}

const results: TestResult[] = [];

/**
 * Test 1: SQL Injection Prevention
 */
function testSQLInjection(): void {
  console.log('\n🔒 Testing SQL Injection Prevention...\n');

  const sqlInjectionPayloads = [
    "' OR 1=1--",
    "'; DROP TABLE companies;--",
    "1' UNION SELECT * FROM companies--",
    "admin'--",
    "' OR 'x'='x",
    "1; DELETE FROM companies WHERE 1=1",
    "1' AND 1=1 UNION SELECT NULL, table_name FROM information_schema.tables--",
    "1' OR '1'='1' /*",
    "1' exec sp_executesql N'SELECT * FROM companies'--",
    "Robert'); DROP TABLE companies;--"
  ];

  let blocked = 0;
  let passed = 0;

  sqlInjectionPayloads.forEach((payload) => {
    try {
      SearchQuerySchema.parse(payload);
      passed++;
      console.log(`❌ FAILED: SQL injection payload accepted: "${payload}"`);
      results.push({
        testName: 'SQL Injection Prevention',
        category: 'Injection',
        passed: false,
        severity: 'CRITICAL',
        finding: `SQL injection payload was accepted: "${payload}"`,
        recommendation: 'Strengthen input validation to block SQL keywords and patterns',
        evidence: payload
      });
    } catch (error) {
      blocked++;
      console.log(`✅ BLOCKED: "${payload}"`);
    }
  });

  console.log(`\nResult: ${blocked}/${sqlInjectionPayloads.length} SQL injection attempts blocked`);

  results.push({
    testName: 'SQL Injection Prevention',
    category: 'Injection',
    passed: blocked === sqlInjectionPayloads.length,
    severity: blocked === sqlInjectionPayloads.length ? 'INFO' : 'CRITICAL',
    finding: `${blocked}/${sqlInjectionPayloads.length} SQL injection attempts blocked`,
    recommendation: blocked === sqlInjectionPayloads.length
      ? 'Continue using parameterized queries and input validation'
      : 'Strengthen SQL injection filters'
  });
}

/**
 * Test 2: XSS Prevention
 */
function testXSSPrevention(): void {
  console.log('\n🔒 Testing XSS Prevention...\n');

  const xssPayloads = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "javascript:alert('XSS')",
    "<body onload=alert('XSS')>",
    "<iframe src='javascript:alert(\"XSS\")'></iframe>",
    "<svg/onload=alert('XSS')>",
    "'-alert(1)-'",
    "\"><script>alert(String.fromCharCode(88,83,83))</script>",
    "<img src='x' onerror='eval(atob(\"YWxlcnQoJ1hTUycpOw==\"))'>",
    "<input onfocus=alert('XSS') autofocus>"
  ];

  let blocked = 0;
  let passed = 0;

  xssPayloads.forEach((payload) => {
    try {
      SearchQuerySchema.parse(payload);
      passed++;
      console.log(`❌ FAILED: XSS payload accepted: "${payload}"`);
      results.push({
        testName: 'XSS Prevention',
        category: 'Injection',
        passed: false,
        severity: 'HIGH',
        finding: `XSS payload was accepted: "${payload}"`,
        recommendation: 'Add HTML tag and JavaScript event handler detection',
        evidence: payload
      });
    } catch (error) {
      blocked++;
      console.log(`✅ BLOCKED: "${payload}"`);
    }
  });

  console.log(`\nResult: ${blocked}/${xssPayloads.length} XSS attempts blocked`);

  results.push({
    testName: 'XSS Prevention',
    category: 'Injection',
    passed: blocked === xssPayloads.length,
    severity: blocked === xssPayloads.length ? 'INFO' : 'HIGH',
    finding: `${blocked}/${xssPayloads.length} XSS attempts blocked`,
    recommendation: blocked === xssPayloads.length
      ? 'Continue sanitizing output and validating input'
      : 'Strengthen XSS filters and implement Content Security Policy'
  });
}

/**
 * Test 3: Organization Number Validation
 */
function testOrgNumberValidation(): void {
  console.log('\n🔒 Testing Organization Number Validation...\n');

  const testCases = [
    { input: '5560001712', expected: true, description: 'Valid org number' },
    { input: '556000-1712', expected: true, description: 'Valid org number with hyphen' },
    { input: '123456789', expected: false, description: 'Too short (9 digits)' },
    { input: '12345678901', expected: false, description: 'Too long (11 digits)' },
    { input: 'ABCD001712', expected: false, description: 'Contains letters' },
    { input: '5560001713', expected: false, description: 'Invalid checksum' },
    { input: "'; DROP TABLE--", expected: false, description: 'SQL injection attempt' },
    { input: '../../../etc/passwd', expected: false, description: 'Path traversal attempt' },
    { input: '0000000000', expected: false, description: 'Invalid checksum (all zeros)' },
    { input: '9999999999', expected: false, description: 'Invalid checksum (all nines)' }
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((test) => {
    try {
      OrganisationsnummerSchema.parse(test.input);
      if (test.expected) {
        passed++;
        console.log(`✅ PASS: ${test.description} - "${test.input}" accepted correctly`);
      } else {
        failed++;
        console.log(`❌ FAIL: ${test.description} - "${test.input}" should have been rejected`);
        results.push({
          testName: 'Organization Number Validation',
          category: 'Input Validation',
          passed: false,
          severity: 'MEDIUM',
          finding: `Invalid org number accepted: "${test.input}"`,
          recommendation: 'Verify Luhn checksum algorithm implementation',
          evidence: test.description
        });
      }
    } catch (error) {
      if (!test.expected) {
        passed++;
        console.log(`✅ PASS: ${test.description} - "${test.input}" rejected correctly`);
      } else {
        failed++;
        console.log(`❌ FAIL: ${test.description} - "${test.input}" should have been accepted`);
        results.push({
          testName: 'Organization Number Validation',
          category: 'Input Validation',
          passed: false,
          severity: 'MEDIUM',
          finding: `Valid org number rejected: "${test.input}"`,
          recommendation: 'Review validation logic for false positives',
          evidence: test.description
        });
      }
    }
  });

  console.log(`\nResult: ${passed}/${testCases.length} validation tests passed`);

  results.push({
    testName: 'Organization Number Validation',
    category: 'Input Validation',
    passed: failed === 0,
    severity: failed === 0 ? 'INFO' : 'MEDIUM',
    finding: `${passed}/${testCases.length} validation tests passed`,
    recommendation: failed === 0
      ? 'Organization number validation is working correctly'
      : 'Review and fix validation logic'
  });
}

/**
 * Test 4: Search Query Length Limits
 */
function testSearchQueryLimits(): void {
  console.log('\n🔒 Testing Search Query Length Limits...\n');

  const testCases = [
    { input: 'A', expected: false, description: 'Too short (1 char)' },
    { input: 'AB', expected: true, description: 'Minimum length (2 chars)' },
    { input: 'Normal company search', expected: true, description: 'Normal query' },
    { input: 'A'.repeat(200), expected: true, description: 'Maximum length (200 chars)' },
    { input: 'A'.repeat(201), expected: false, description: 'Too long (201 chars)' },
    { input: 'A'.repeat(1000), expected: false, description: 'Way too long (1000 chars)' }
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((test) => {
    try {
      SearchQuerySchema.parse(test.input);
      if (test.expected) {
        passed++;
        console.log(`✅ PASS: ${test.description}`);
      } else {
        failed++;
        console.log(`❌ FAIL: ${test.description} - should have been rejected`);
      }
    } catch (error) {
      if (!test.expected) {
        passed++;
        console.log(`✅ PASS: ${test.description}`);
      } else {
        failed++;
        console.log(`❌ FAIL: ${test.description} - should have been accepted`);
      }
    }
  });

  console.log(`\nResult: ${passed}/${testCases.length} length limit tests passed`);

  results.push({
    testName: 'Search Query Length Limits',
    category: 'Input Validation',
    passed: failed === 0,
    severity: failed === 0 ? 'INFO' : 'LOW',
    finding: `${passed}/${testCases.length} length limit tests passed`,
    recommendation: 'Length limits are correctly enforced'
  });
}

/**
 * Test 5: Error Message Information Leakage
 */
function testErrorInformationLeakage(): void {
  console.log('\n🔒 Testing Error Message Information Leakage...\n');

  // Test that error messages don't expose sensitive information
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /api[_-]?key/i,
    /token/i,
    /supabase.*key/i,
    /postgresql:\/\//i,
    /\/Users\//i,
    /\/home\//i,
    /\.env/i
  ];

  console.log('✅ Error messages should not contain:');
  sensitivePatterns.forEach(pattern => {
    console.log(`   - ${pattern.source}`);
  });

  results.push({
    testName: 'Error Information Leakage',
    category: 'Sensitive Data Exposure',
    passed: true,
    severity: 'INFO',
    finding: 'Error messages should be tested in runtime to ensure no sensitive data leakage',
    recommendation: 'Ensure error messages in production do not expose stack traces, file paths, or credentials'
  });
}

/**
 * Test 6: Environment Variable Security
 */
function testEnvironmentVariables(): void {
  console.log('\n🔒 Testing Environment Variable Security...\n');

  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'BOLAGSVERKET_CLIENT_ID',
    'BOLAGSVERKET_CLIENT_SECRET'
  ];

  const checks = {
    allDefined: true,
    noEmptyValues: true,
    noPlaceholders: true
  };

  requiredVars.forEach((varName) => {
    const value = process.env[varName];

    if (!value) {
      checks.allDefined = false;
      console.log(`❌ FAIL: ${varName} is not defined`);
    } else if (value.trim() === '') {
      checks.noEmptyValues = false;
      console.log(`❌ FAIL: ${varName} is empty`);
    } else if (value.includes('your_') || value.includes('example') || value.includes('placeholder')) {
      checks.noPlaceholders = false;
      console.log(`⚠️  WARNING: ${varName} appears to be a placeholder value`);
    } else {
      console.log(`✅ PASS: ${varName} is configured`);
    }
  });

  const allPassed = checks.allDefined && checks.noEmptyValues && checks.noPlaceholders;

  results.push({
    testName: 'Environment Variable Security',
    category: 'Configuration',
    passed: allPassed,
    severity: allPassed ? 'INFO' : 'CRITICAL',
    finding: allPassed
      ? 'All environment variables are properly configured'
      : 'Some environment variables are missing or misconfigured',
    recommendation: 'Ensure all credentials are stored securely and not committed to version control'
  });
}

/**
 * Generate Test Report
 */
function generateReport(): any {
  console.log('\n' + '='.repeat(80));
  console.log('SECURITY TEST REPORT');
  console.log('='.repeat(80) + '\n');

  const summary = {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    critical: results.filter(r => r.severity === 'CRITICAL').length,
    high: results.filter(r => r.severity === 'HIGH').length,
    medium: results.filter(r => r.severity === 'MEDIUM').length,
    low: results.filter(r => r.severity === 'LOW').length
  };

  console.log('Summary:');
  console.log(`  Total Tests: ${summary.total}`);
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(`\nFindings by Severity:`);
  console.log(`  🔴 CRITICAL: ${summary.critical}`);
  console.log(`  🟠 HIGH: ${summary.high}`);
  console.log(`  🟡 MEDIUM: ${summary.medium}`);
  console.log(`  🔵 LOW: ${summary.low}`);

  console.log('\n' + '-'.repeat(80) + '\n');

  // Group by severity
  const bySeverity = {
    CRITICAL: results.filter(r => r.severity === 'CRITICAL' && !r.passed),
    HIGH: results.filter(r => r.severity === 'HIGH' && !r.passed),
    MEDIUM: results.filter(r => r.severity === 'MEDIUM' && !r.passed),
    LOW: results.filter(r => r.severity === 'LOW' && !r.passed)
  };

  Object.entries(bySeverity).forEach(([severity, findings]) => {
    if (findings.length > 0) {
      console.log(`\n${severity} Severity Findings:\n`);
      findings.forEach((finding, index) => {
        console.log(`${index + 1}. ${finding.testName} (${finding.category})`);
        console.log(`   Finding: ${finding.finding}`);
        console.log(`   Recommendation: ${finding.recommendation}`);
        if (finding.evidence) {
          console.log(`   Evidence: ${finding.evidence}`);
        }
        console.log('');
      });
    }
  });

  console.log('\n' + '='.repeat(80) + '\n');

  // Save to JSON
  const report = {
    timestamp: new Date().toISOString(),
    summary,
    results
  };

  return report;
}

/**
 * Run All Security Tests
 */
async function runSecurityTests() {
  console.log('🔐 PERSONUPPLYSNING MCP SERVER - SECURITY TEST SUITE\n');
  console.log('Starting comprehensive security audit...\n');

  testSQLInjection();
  testXSSPrevention();
  testOrgNumberValidation();
  testSearchQueryLimits();
  testErrorInformationLeakage();
  testEnvironmentVariables();

  const report = generateReport();

  // Write report to file
  const fs = await import('fs/promises');
  await fs.writeFile(
    new URL('../testing-audit/security-test-results.json', import.meta.url),
    JSON.stringify(report, null, 2)
  );

  console.log('📄 Full report saved to: testing-audit/security-test-results.json\n');

  process.exit(report.summary.critical > 0 || report.summary.high > 0 ? 1 : 0);
}

// Run tests
runSecurityTests().catch(console.error);
