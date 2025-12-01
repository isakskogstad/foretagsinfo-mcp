/**
 * Performance Test Suite for Personupplysning MCP Server
 * Tests load handling, cache efficiency, and response times
 */

import { companyDataService } from '../src/services/company-data-service.js';
import { performance } from 'perf_hooks';

interface PerformanceMetric {
  operation: string;
  samples: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
  successRate: number;
  throughput: number;
}

interface TestResult {
  testName: string;
  category: string;
  passed: boolean;
  metric?: PerformanceMetric;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Calculate percentiles from sorted array
 */
function percentile(arr: number[], p: number): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((sorted.length * p) / 100) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate statistics from timing array
 */
function calculateStats(timings: number[], totalTime: number): PerformanceMetric {
  const successful = timings.filter(t => t > 0);
  const samples = timings.length;

  return {
    operation: '',
    samples,
    avgTime: successful.reduce((a, b) => a + b, 0) / successful.length || 0,
    minTime: Math.min(...successful) || 0,
    maxTime: Math.max(...successful) || 0,
    p50: percentile(successful, 50),
    p95: percentile(successful, 95),
    p99: percentile(successful, 99),
    successRate: (successful.length / samples) * 100,
    throughput: (successful.length / totalTime) * 1000 // ops/second
  };
}

/**
 * Test 1: Local Search Performance (Database Query)
 */
async function testLocalSearchPerformance(): Promise<void> {
  console.log('⚡ Test 1: Local Search Performance\n');

  const queries = [
    'spotify',
    'ikea',
    'volvo',
    'scania',
    'ericsson',
    'h&m',
    'astra',
    'saab',
    'electrolux',
    'skf'
  ];

  const iterations = 10;
  const timings: number[] = [];
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    for (const query of queries) {
      try {
        const queryStart = performance.now();
        await companyDataService.searchCompanies(query, 10);
        const queryTime = performance.now() - queryStart;
        timings.push(queryTime);
      } catch (error) {
        timings.push(-1); // Mark as failure
        console.error(`  Query failed: ${query}`);
      }
    }
  }

  const totalTime = performance.now() - startTime;
  const stats = calculateStats(timings, totalTime);
  stats.operation = 'Local Search';

  console.log(`  Samples: ${stats.samples}`);
  console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
  console.log(`  Avg Time: ${stats.avgTime.toFixed(2)}ms`);
  console.log(`  P50 (Median): ${stats.p50.toFixed(2)}ms`);
  console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
  console.log(`  P99: ${stats.p99.toFixed(2)}ms`);
  console.log(`  Min/Max: ${stats.minTime.toFixed(2)}ms / ${stats.maxTime.toFixed(2)}ms`);
  console.log(`  Throughput: ${stats.throughput.toFixed(2)} queries/sec\n`);

  // Target: < 100ms for local searches
  const passed = stats.p95 < 100;

  results.push({
    testName: 'Local Search Performance',
    category: 'Performance',
    passed,
    metric: stats
  });

  if (!passed) {
    console.log(`  ⚠️  WARNING: P95 latency ${stats.p95.toFixed(2)}ms exceeds target of 100ms\n`);
  } else {
    console.log(`  ✅ PASS: P95 latency within target (< 100ms)\n`);
  }
}

/**
 * Test 2: Cache Hit Performance
 */
async function testCacheHitPerformance(): Promise<void> {
  console.log('⚡ Test 2: Cache Hit Performance\n');

  const orgNumber = '5560001712'; // Spotify
  const iterations = 50;
  const timings: number[] = [];
  const startTime = performance.now();

  // First request to populate cache
  try {
    await companyDataService.getCompanyDetails(orgNumber);
    console.log('  Cache warmed up...\n');
  } catch (error) {
    console.log('  ⚠️  Failed to warm up cache\n');
  }

  // Subsequent requests should hit cache
  for (let i = 0; i < iterations; i++) {
    try {
      const queryStart = performance.now();
      await companyDataService.getCompanyDetails(orgNumber);
      const queryTime = performance.now() - queryStart;
      timings.push(queryTime);
    } catch (error) {
      timings.push(-1);
    }
  }

  const totalTime = performance.now() - startTime;
  const stats = calculateStats(timings, totalTime);
  stats.operation = 'Cache Hit';

  console.log(`  Samples: ${stats.samples}`);
  console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
  console.log(`  Avg Time: ${stats.avgTime.toFixed(2)}ms`);
  console.log(`  P50 (Median): ${stats.p50.toFixed(2)}ms`);
  console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
  console.log(`  P99: ${stats.p99.toFixed(2)}ms`);
  console.log(`  Min/Max: ${stats.minTime.toFixed(2)}ms / ${stats.maxTime.toFixed(2)}ms`);
  console.log(`  Throughput: ${stats.throughput.toFixed(2)} requests/sec\n`);

  // Target: < 50ms for cached responses
  const passed = stats.p95 < 50;

  results.push({
    testName: 'Cache Hit Performance',
    category: 'Performance',
    passed,
    metric: stats
  });

  if (!passed) {
    console.log(`  ⚠️  WARNING: P95 latency ${stats.p95.toFixed(2)}ms exceeds target of 50ms\n`);
  } else {
    console.log(`  ✅ PASS: P95 latency within target (< 50ms)\n`);
  }
}

/**
 * Test 3: Concurrent Request Handling
 */
async function testConcurrentRequests(): Promise<void> {
  console.log('⚡ Test 3: Concurrent Request Handling\n');

  const queries = Array(50).fill(null).map((_, i) => `company${i}`);
  const concurrency = 20;
  const timings: number[] = [];
  const startTime = performance.now();

  // Process in batches
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const promises = batch.map(async (query) => {
      const queryStart = performance.now();
      try {
        await companyDataService.searchCompanies(query, 5);
        return performance.now() - queryStart;
      } catch (error) {
        return -1;
      }
    });

    const batchTimings = await Promise.all(promises);
    timings.push(...batchTimings);
  }

  const totalTime = performance.now() - startTime;
  const stats = calculateStats(timings, totalTime);
  stats.operation = 'Concurrent Requests';

  console.log(`  Total Requests: ${queries.length}`);
  console.log(`  Concurrency Level: ${concurrency}`);
  console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
  console.log(`  Avg Time: ${stats.avgTime.toFixed(2)}ms`);
  console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
  console.log(`  Throughput: ${stats.throughput.toFixed(2)} requests/sec\n`);

  // Target: > 90% success rate
  const passed = stats.successRate > 90;

  results.push({
    testName: 'Concurrent Request Handling',
    category: 'Performance',
    passed,
    metric: stats
  });

  if (!passed) {
    console.log(`  ⚠️  WARNING: Success rate ${stats.successRate.toFixed(2)}% below target of 90%\n`);
  } else {
    console.log(`  ✅ PASS: Success rate above target (> 90%)\n`);
  }
}

/**
 * Test 4: Cache Statistics and Hit Rate
 */
async function testCacheStatistics(): Promise<void> {
  console.log('⚡ Test 4: Cache Statistics\n');

  try {
    const stats = await companyDataService.getCacheStats();

    console.log(`  Cached Company Details: ${stats.cached_company_details || 0}`);
    console.log(`  Cached Document Lists: ${stats.cached_document_lists || 0}`);
    console.log(`  Stored Financial Reports: ${stats.stored_financial_reports || 0}`);
    console.log(`  Total API Requests: ${stats.total_api_requests || 0}`);
    console.log(`  24h Cache Hit Rate: ${stats.cache_hit_rate_24h?.toFixed(2) || 0}%\n`);

    // No strict target for cache hit rate initially, just informational
    const passed = true;

    results.push({
      testName: 'Cache Statistics',
      category: 'Performance',
      passed,
      metric: {
        operation: 'Cache Stats',
        samples: 1,
        avgTime: 0,
        minTime: 0,
        maxTime: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        successRate: 100,
        throughput: stats.cache_hit_rate_24h || 0
      }
    });

    console.log(`  ✅ PASS: Cache statistics retrieved\n`);
  } catch (error: any) {
    console.log(`  ❌ FAIL: ${error.message}\n`);
    results.push({
      testName: 'Cache Statistics',
      category: 'Performance',
      passed: false,
      error: error.message
    });
  }
}

/**
 * Test 5: Database Connection Pool Performance
 */
async function testDatabaseConnectionPool(): Promise<void> {
  console.log('⚡ Test 5: Database Connection Pool\n');

  const parallelRequests = 50;
  const timings: number[] = [];
  const startTime = performance.now();

  // Execute many queries simultaneously to test connection pooling
  const promises = Array(parallelRequests).fill(null).map(async (_, i) => {
    const queryStart = performance.now();
    try {
      await companyDataService.searchCompanies(`test${i}`, 5);
      return performance.now() - queryStart;
    } catch (error) {
      return -1;
    }
  });

  const results_arr = await Promise.all(promises);
  timings.push(...results_arr);

  const totalTime = performance.now() - startTime;
  const stats = calculateStats(timings, totalTime);
  stats.operation = 'DB Connection Pool';

  console.log(`  Parallel Requests: ${parallelRequests}`);
  console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
  console.log(`  Total Time: ${totalTime.toFixed(2)}ms`);
  console.log(`  Avg Time per Request: ${stats.avgTime.toFixed(2)}ms`);
  console.log(`  P95: ${stats.p95.toFixed(2)}ms\n`);

  // Target: All requests should complete successfully
  const passed = stats.successRate === 100;

  results.push({
    testName: 'Database Connection Pool',
    category: 'Performance',
    passed,
    metric: stats
  });

  if (!passed) {
    console.log(`  ⚠️  WARNING: Some requests failed (${stats.successRate.toFixed(2)}% success rate)\n`);
  } else {
    console.log(`  ✅ PASS: All parallel requests completed successfully\n`);
  }
}

/**
 * Test 6: Memory Usage Check
 */
async function testMemoryUsage(): Promise<void> {
  console.log('⚡ Test 6: Memory Usage\n');

  const memBefore = process.memoryUsage();
  console.log('  Memory Before:');
  console.log(`    Heap Used: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    Heap Total: ${(memBefore.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    RSS: ${(memBefore.rss / 1024 / 1024).toFixed(2)} MB\n`);

  // Execute many operations
  for (let i = 0; i < 100; i++) {
    await companyDataService.searchCompanies(`test${i}`, 10);
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const memAfter = process.memoryUsage();
  console.log('  Memory After 100 operations:');
  console.log(`    Heap Used: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    Heap Total: ${(memAfter.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    RSS: ${(memAfter.rss / 1024 / 1024).toFixed(2)} MB\n`);

  const heapGrowth = memAfter.heapUsed - memBefore.heapUsed;
  console.log(`  Heap Growth: ${(heapGrowth / 1024 / 1024).toFixed(2)} MB\n`);

  // Target: Heap growth < 50MB for 100 operations
  const passed = heapGrowth < 50 * 1024 * 1024;

  results.push({
    testName: 'Memory Usage',
    category: 'Performance',
    passed,
    metric: {
      operation: 'Memory Check',
      samples: 1,
      avgTime: heapGrowth / 1024 / 1024,
      minTime: 0,
      maxTime: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      successRate: 100,
      throughput: 0
    }
  });

  if (!passed) {
    console.log(`  ⚠️  WARNING: Heap growth ${(heapGrowth / 1024 / 1024).toFixed(2)}MB exceeds target of 50MB\n`);
  } else {
    console.log(`  ✅ PASS: Heap growth within acceptable limits\n`);
  }
}

/**
 * Generate Performance Report
 */
function generateReport(): any {
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE TEST REPORT');
  console.log('='.repeat(80) + '\n');

  const summary = {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length
  };

  console.log('Summary:');
  console.log(`  Total Tests: ${summary.total}`);
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}\n`);

  console.log('-'.repeat(80) + '\n');

  // Show all metrics
  console.log('Performance Metrics:\n');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.testName}`);
    if (result.metric) {
      const m = result.metric;
      console.log(`   Operation: ${m.operation}`);
      console.log(`   Success Rate: ${m.successRate.toFixed(2)}%`);
      if (m.avgTime > 0) {
        console.log(`   Avg Time: ${m.avgTime.toFixed(2)}ms`);
        console.log(`   P95: ${m.p95.toFixed(2)}ms`);
      }
      if (m.throughput > 0) {
        console.log(`   Throughput: ${m.throughput.toFixed(2)} ops/sec`);
      }
    }
    console.log(`   Result: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`);
  });

  console.log('='.repeat(80) + '\n');

  return {
    timestamp: new Date().toISOString(),
    summary,
    results
  };
}

/**
 * Run All Performance Tests
 */
async function runPerformanceTests() {
  console.log('⚡ PERSONUPPLYSNING MCP SERVER - PERFORMANCE TEST SUITE\n');
  console.log('='.repeat(80) + '\n');

  try {
    await testLocalSearchPerformance();
    await testCacheHitPerformance();
    await testConcurrentRequests();
    await testCacheStatistics();
    await testDatabaseConnectionPool();
    await testMemoryUsage();

    const report = generateReport();

    // Save report
    const fs = await import('fs/promises');
    await fs.writeFile(
      'testing-audit/performance-test-results.json',
      JSON.stringify(report, null, 2)
    );

    console.log('📄 Full report saved to: testing-audit/performance-test-results.json\n');

    process.exit(report.summary.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runPerformanceTests().catch(console.error);
