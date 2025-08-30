#!/usr/bin/env node

/**
 * OmniLens API Documentation Test Suite
 * 
 * This test suite validates the API documentation endpoints that serve
 * the OpenAPI specification and API documentation page.
 * 
 * Run with: node tests/api-docs.test.js
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
  checkServer
} from './test-utils.js';

// Test functions
async function testOpenAPISpecEndpoint() {
  logTest('GET /api/openapi');
  
  const response = await makeRequest(`${BASE_URL}/api/openapi`);
  
  if (response.ok && response.data) {
    logSuccess('GET /api/openapi endpoint is working');
    
    // Check for key content - handle both text and parsed JSON
    const specText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    
    if (specText.includes('openapi:') && specText.includes('info:') && specText.includes('paths:')) {
      logSuccess('OpenAPI spec has valid structure');
      
      // Count endpoints by looking for path patterns
      const pathMatches = specText.match(/^\s+\/api\/[^:]+:/gm);
      const endpoints = pathMatches ? pathMatches.map(p => p.trim().replace(':', '')) : [];
      logInfo(`Found ${endpoints.length} endpoints: ${endpoints.join(', ')}`);
      
      // Check for our specific endpoints
      const expectedEndpoints = ['/api/openapi', '/api/docs', '/api/repo', '/api/repo/add', '/api/repo/{slug}', '/api/repo/validate'];
      const missingEndpoints = expectedEndpoints.filter(endpoint => !endpoints.includes(endpoint));
      
      if (missingEndpoints.length === 0) {
        logSuccess('All expected endpoints are documented');
      } else {
        logWarning(`Missing endpoints in spec: ${missingEndpoints.join(', ')}`);
      }
      
      return true;
    } else {
      logError('OpenAPI spec has invalid structure');
      return false;
    }
  } else {
    logError(`GET /api/openapi failed: ${response.status}`);
    return false;
  }
}

async function testAPIDocsEndpoint() {
  logTest('GET /api/docs');
  
  const response = await makeRequest(`${BASE_URL}/api/docs`);
  
  if (response.ok && response.data) {
    logSuccess('GET /api/docs endpoint is working');
    
    // Check for Swagger UI content
    if (response.data.includes('swagger-ui') || response.data.includes('SwaggerUI')) {
      logSuccess('Swagger UI is properly loaded');
      
      // Check for OpenAPI spec reference
      if (response.data.includes('/api/openapi') || response.data.includes('openapi.yaml')) {
        logSuccess('API docs references OpenAPI spec correctly');
      } else {
        logWarning('API docs may not reference OpenAPI spec correctly');
      }
      
      return true;
    } else {
      logWarning('Swagger UI content not found in response');
      return true; // Still accessible, just might not be fully loaded
    }
  } else {
    logError(`GET /api/docs failed: ${response.status}`);
    return false;
  }
}

async function testOpenAPISpecContent() {
  logTest('OpenAPI Spec Content Validation');
  
  const response = await makeRequest(`${BASE_URL}/api/openapi`);
  
  if (!response.ok || !response.data) {
    logError('Cannot validate OpenAPI spec content - endpoint not accessible');
    return false;
  }
  
  const specText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  let allValid = true;
  
  // Check for required OpenAPI structure
  const requiredSections = [
    'openapi:',
    'info:',
    'paths:',
    'servers:'
  ];
  
  for (const section of requiredSections) {
    if (specText.includes(section)) {
      logSuccess(`✅ Contains ${section}`);
    } else {
      logError(`❌ Missing ${section}`);
      allValid = false;
    }
  }
  
  // Check for specific endpoint documentation
  const requiredEndpoints = [
    '/api/repo:',
    '/api/repo/validate:',
    '/api/repo/add:',
    '/api/repo/{slug}:'
  ];
  
  for (const endpoint of requiredEndpoints) {
    if (specText.includes(endpoint)) {
      logSuccess(`✅ Documents ${endpoint}`);
    } else {
      logError(`❌ Missing documentation for ${endpoint}`);
      allValid = false;
    }
  }
  
  return allValid;
}

async function testAPIDocsContent() {
  logTest('API Docs Content Validation');
  
  const response = await makeRequest(`${BASE_URL}/api/docs`);
  
  if (!response.ok || !response.data) {
    logError('Cannot validate API docs content - endpoint not accessible');
    return false;
  }
  
  const docsText = response.data;
  let allValid = true;
  
  // Check for required HTML structure
  const requiredElements = [
    '<html',
    '<head',
    '<body',
    'swagger-ui',
    'SwaggerUI'
  ];
  
  for (const element of requiredElements) {
    if (docsText.includes(element)) {
      logSuccess(`✅ Contains ${element}`);
    } else {
      logError(`❌ Missing ${element}`);
      allValid = false;
    }
  }
  
  return allValid;
}

// Main test runner
async function runApiDocsTests() {
  log('\n📚 Starting OmniLens API Documentation Test Suite', 'bright');
  log('=' .repeat(60), 'bright');
  
  const tests = [
    { name: 'GET /api/openapi', fn: testOpenAPISpecEndpoint },
    { name: 'GET /api/docs', fn: testAPIDocsEndpoint },
    { name: 'OpenAPI Spec Content', fn: testOpenAPISpecContent },
    { name: 'API Docs Content', fn: testAPIDocsContent }
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
  
  log('\n📊 API Documentation Test Results:', 'bright');
  results.forEach(result => {
    if (result.passed) {
      logSuccess(`${result.name}`);
    } else {
      logError(`${result.name}${result.error ? ` - ${result.error}` : ''}`);
    }
  });
  
  log('\n' + '=' .repeat(60), 'bright');
  log(`🎯 Overall: ${passed}/${total} API documentation tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n🎉 All API documentation tests passed! Documentation endpoints are working!', 'green');
    return true;
  } else {
    log('\n🚨 Some API documentation tests failed. Please check the errors above.', 'yellow');
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
    
    const success = await runApiDocsTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    logError(`API documentation test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  runApiDocsTests,
  testOpenAPISpecEndpoint,
  testAPIDocsEndpoint,
  testOpenAPISpecContent,
  testAPIDocsContent
};
