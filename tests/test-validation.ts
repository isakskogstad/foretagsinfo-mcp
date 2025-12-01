/**
 * Test validation utilities
 * Run with: tsx tests/test-validation.ts
 */

import { validateEnvironment, validateOrgNumber, validateYear, validateLimit, validateSearchQuery } from '../src/utils/validation.js';
import { validateInput, SearchCompaniesInputSchema, GetCompanyDetailsInputSchema } from '../src/utils/validators.js';

console.log('🧪 Testing Validation Utilities\n');

// Test 1: Environment Validation
console.log('1. Environment Validation:');
const envResult = validateEnvironment();
console.log(`   Valid: ${envResult.valid ? '✅' : '❌'}`);
console.log(`   Missing: ${envResult.missing.length > 0 ? envResult.missing.join(', ') : 'None'}`);
console.log(`   Configured: ${envResult.configured.join(', ')}\n`);

// Test 2: Organization Number Validation
console.log('2. Organization Number Validation:');
const validOrgNumbers = ['5560001712', '556000-1712'];
const invalidOrgNumbers = ['123', 'invalid', '12345678901'];

validOrgNumbers.forEach(orgNum => {
  try {
    validateOrgNumber(orgNum);
    console.log(`   ✅ "${orgNum}" is valid`);
  } catch (error: any) {
    console.log(`   ❌ "${orgNum}" failed: ${error.message}`);
  }
});

invalidOrgNumbers.forEach(orgNum => {
  try {
    validateOrgNumber(orgNum);
    console.log(`   ❌ "${orgNum}" should have failed but passed!`);
  } catch (error: any) {
    console.log(`   ✅ "${orgNum}" correctly rejected: ${error.message}`);
  }
});

console.log();

// Test 3: Year Validation
console.log('3. Year Validation:');
const validYears = [2020, 2023, 2024];
const invalidYears = [1899, 2050, 2100];

validYears.forEach(year => {
  try {
    validateYear(year);
    console.log(`   ✅ Year ${year} is valid`);
  } catch (error: any) {
    console.log(`   ❌ Year ${year} failed: ${error.message}`);
  }
});

invalidYears.forEach(year => {
  try {
    validateYear(year);
    console.log(`   ❌ Year ${year} should have failed but passed!`);
  } catch (error: any) {
    console.log(`   ✅ Year ${year} correctly rejected: ${error.message}`);
  }
});

console.log();

// Test 4: Limit Validation
console.log('4. Limit Validation:');
const validLimits = [1, 10, 100];
const invalidLimits = [0, -1, 101];

validLimits.forEach(limit => {
  try {
    validateLimit(limit);
    console.log(`   ✅ Limit ${limit} is valid`);
  } catch (error: any) {
    console.log(`   ❌ Limit ${limit} failed: ${error.message}`);
  }
});

invalidLimits.forEach(limit => {
  try {
    validateLimit(limit);
    console.log(`   ❌ Limit ${limit} should have failed but passed!`);
  } catch (error: any) {
    console.log(`   ✅ Limit ${limit} correctly rejected: ${error.message}`);
  }
});

console.log();

// Test 5: Search Query Validation
console.log('5. Search Query Validation:');
const validQueries = ['Nordea', 'IKEA AB', '5560001712'];
const invalidQueries = ['', 'a', '<script>alert("xss")</script>', 'SELECT * FROM companies'];

validQueries.forEach(query => {
  try {
    validateSearchQuery(query);
    console.log(`   ✅ Query "${query}" is valid`);
  } catch (error: any) {
    console.log(`   ❌ Query "${query}" failed: ${error.message}`);
  }
});

invalidQueries.forEach(query => {
  try {
    validateSearchQuery(query);
    console.log(`   ❌ Query "${query}" should have failed but passed!`);
  } catch (error: any) {
    console.log(`   ✅ Query "${query}" correctly rejected`);
  }
});

console.log();

// Test 6: Zod Schema Validation
console.log('6. Zod Schema Validation:');

console.log('   Testing SearchCompaniesInputSchema:');
try {
  const result = validateInput(SearchCompaniesInputSchema, {
    query: 'Nordea',
    limit: 10
  });
  console.log(`   ✅ Valid input accepted: query="${result.query}", limit=${result.limit}`);
} catch (error: any) {
  console.log(`   ❌ Valid input rejected: ${error.message}`);
}

try {
  validateInput(SearchCompaniesInputSchema, {
    query: '',
    limit: 10
  });
  console.log(`   ❌ Empty query should have been rejected!`);
} catch (error: any) {
  console.log(`   ✅ Empty query correctly rejected`);
}

console.log();

console.log('   Testing GetCompanyDetailsInputSchema:');
try {
  const result = validateInput(GetCompanyDetailsInputSchema, {
    organisationsidentitet: '5560001712'
  });
  console.log(`   ✅ Valid org number accepted: ${result.organisationsidentitet}`);
} catch (error: any) {
  console.log(`   ❌ Valid org number rejected: ${error.message}`);
}

try {
  validateInput(GetCompanyDetailsInputSchema, {
    organisationsidentitet: '123'
  });
  console.log(`   ❌ Invalid org number should have been rejected!`);
} catch (error: any) {
  console.log(`   ✅ Invalid org number correctly rejected`);
}

console.log();

// Test 7: Request ID Generation
console.log('7. Request ID Generation:');
import crypto from 'crypto';
const requestIds = Array.from({ length: 5 }, () => crypto.randomUUID());
console.log(`   Generated ${requestIds.length} unique request IDs:`);
requestIds.forEach((id, i) => {
  console.log(`   ${i + 1}. ${id}`);
});

console.log();
console.log('✅ All validation tests completed!\n');
