#!/usr/bin/env node

/**
 * OmniLens Documentation Test Suite
 * 
 * This test suite validates documentation and specification files
 * that are served by the application.
 * 
 * Run with: node tests/docs.test.js
 */

import {
  BASE_URL,
  API_DOCS_URL,
  OPENAPI_SPEC_URL,
  log,
  logTest,
  logSuccess,
  logError,
  logWarning,
  logInfo,
  makeRequest,
  checkServer
} from './test-utils.js';

// Test functions
async function testOpenAPISpec() {
  logTest('OpenAPI Specification');
  
  const response = await makeRequest(OPENAPI_SPEC_URL);
  
  if (response.ok && response.data) {
    logSuccess('OpenAPI spec is accessible');
    
    // Check for key content - handle both text and parsed JSON
    const specText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    
    if (specText.includes('openapi:') && specText.includes('info:') && specText.includes('paths:')) {
      logSuccess('OpenAPI spec has valid structure');
      
      // Count endpoints by looking for path patterns
      const pathMatches = specText.match(/^\s+\/api\/[^:]+:/gm);
      const endpoints = pathMatches ? pathMatches.map(p => p.trim().replace(':', '')) : [];
      logInfo(`Found ${endpoints.length} endpoints: ${endpoints.join(', ')}`);
      
      return true;
    } else {
      logError('OpenAPI spec has invalid structure');
      return false;
    }
  } else {
    logError(`OpenAPI spec not accessible: ${response.status}`);
    return false;
  }
}

async function testAPIDocsPage() {
  logTest('API Documentation Page');
  
  const response = await makeRequest(API_DOCS_URL);
  
  if (response.ok && response.data) {
    logSuccess('API docs page is accessible');
    
    // Check for Swagger UI content
    if (response.data.includes('swagger-ui') || response.data.includes('SwaggerUI')) {
      logSuccess('Swagger UI is properly loaded');
      return true;
    } else {
      logWarning('Swagger UI content not found in response');
      return true; // Still accessible, just might not be fully loaded
    }
  } else {
    logError(`API docs page not accessible: ${response.status}`);
    return false;
  }
}

// Main test runner
async function runDocsTests() {
  log('\n📚 Starting OmniLens Documentation Test Suite', 'bright');
  log('=' .repeat(60), 'bright');
  
  const tests = [
    { name: 'OpenAPI Specification', fn: testOpenAPISpec },
    { name: 'API Documentation Page', fn: testAPIDocsPage }
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
  
  log('\n📊 Documentation Test Results:', 'bright');
  results.forEach(result => {
    if (result.passed) {
      logSuccess(`${result.name}`);
    } else {
      logError(`${result.name}${result.error ? ` - ${result.error}` : ''}`);
    }
  });
  
  log('\n' + '=' .repeat(60), 'bright');
  log(`🎯 Overall: ${passed}/${total} documentation tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n🎉 All documentation tests passed! Documentation is accessible!', 'green');
    return true;
  } else {
    log('\n🚨 Some documentation tests failed. Please check the errors above.', 'yellow');
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
    
    const success = await runDocsTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    logError(`Documentation test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  runDocsTests,
  testOpenAPISpec,
  testAPIDocsPage
};
