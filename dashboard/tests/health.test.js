#!/usr/bin/env node

/**
 * OmniLens Health & Infrastructure Test Suite
 * 
 * This test suite validates system health and core functionality
 * that doesn't require database operations or complex API testing.
 * 
 * Run with: node tests/health.test.js
 */

import {
  BASE_URL,
  log,
  logTest,
  logSuccess,
  logError,
  logWarning,
  logInfo,
  makeRequest,
  checkServer,
  ZOD_VALIDATION_TEST_CASES,
  SLUG_TEST_CASES
} from './test-utils.js';

// Test functions
async function testServerHealth() {
  logTest('Server Health Check');
  
  const response = await makeRequest(BASE_URL);
  
  if (response.ok) {
    logSuccess('Server is running and responding');
    return true;
  } else {
    logError(`Server health check failed: ${response.status}`);
    return false;
  }
}



async function testSlugGeneration() {
  logTest('Slug Generation (Clean URLs)');
  
  // Test the slug generation logic
  const testCases = SLUG_TEST_CASES;
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    const actualSlug = testCase.repoPath.split('/').pop() || testCase.repoPath;
    
    if (actualSlug === testCase.expectedSlug) {
      logSuccess(`✅ ${testCase.description}: "${actualSlug}"`);
    } else {
      logError(`❌ ${testCase.description}: Expected "${testCase.expectedSlug}", got "${actualSlug}"`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

async function testZodValidation() {
  logTest('Zod Validation Integration');
  
  const testCases = ZOD_VALIDATION_TEST_CASES;
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    logInfo(`  Testing: ${testCase.name}`);
    
    const response = await makeRequest(`${BASE_URL}/api/repo/validate`, {
      method: 'POST',
      body: JSON.stringify(testCase.data)
    });
    
    if (testCase.shouldPass) {
      if (response.ok) {
        logSuccess(`    ✅ ${testCase.name} - Zod validation passed`);
      } else {
        logError(`    ❌ ${testCase.name} - Zod validation failed: ${response.status}`);
        allPassed = false;
      }
    } else {
      if (!response.ok && response.status === 400) {
        logSuccess(`    ✅ ${testCase.name} - Zod validation correctly rejected`);
      } else {
        logError(`    ❌ ${testCase.name} - Expected 400 but got: ${response.status}`);
        allPassed = false;
      }
    }
  }
  
  return allPassed;
}

// Main test runner
async function runHealthTests() {
  log('\n🏥 Starting OmniLens Health & Infrastructure Test Suite', 'bright');
  log('=' .repeat(60), 'bright');
  
  const tests = [
    { name: 'Server Health', fn: testServerHealth },
    { name: 'Slug Generation', fn: testSlugGeneration },
    { name: 'Zod Validation', fn: testZodValidation }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      logError(`Test ${test.name} threw an error: ${error.message}`);
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  log('\n📊 Health Test Results:', 'bright');
  results.forEach(result => {
    if (result.passed) {
      logSuccess(`${result.name}`);
    } else {
      logError(`${result.name}${result.error ? ` - ${result.error}` : ''}`);
    }
  });
  
  log('\n' + '=' .repeat(60), 'bright');
  log(`🎯 Overall: ${passed}/${total} health tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n🎉 All health tests passed! System is healthy!', 'green');
    return true;
  } else {
    log('\n🚨 Some health tests failed. Please check the errors above.', 'yellow');
    log('Note: OpenAPI and API docs tests are optional in CI environment', 'blue');
    return false;
  }
}

// Main execution
async function main() {
  try {
    const serverRunning = await checkServer();
    if (!serverRunning) {
      process.exit(1);
    }
    
    const success = await runHealthTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    logError(`Health test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  runHealthTests,
  testServerHealth,
  testSlugGeneration,
  testZodValidation
};
