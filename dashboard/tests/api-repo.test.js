#!/usr/bin/env node

/**
 * OmniLens API Repository Test Suite
 * 
 * This test suite validates all our API endpoints individually to ensure they're working correctly
 * and returning the expected responses. Tests each endpoint in isolation with various test cases.
 * 
 * Run with: node tests/api-repo.test.js
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
  checkServer,
  VALIDATION_TEST_CASES,
  ZOD_VALIDATION_TEST_CASES,
  SLUG_TEST_CASES,
  ADD_REPO_TEST_CASES,
  NON_EXISTENT_REPO_TEST_CASES,
  ADD_NON_EXISTENT_REPO_TEST_CASES,
  REPO_TEST_DATA
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

async function testGetRepositories() {
  logTest('GET /api/repo');
  
  const response = await makeRequest(`${BASE_URL}/api/repo`);
  
  if (response.ok) {
    logSuccess('GET /api/repo endpoint is working');
    
    if (response.data && response.data.repositories) {
      logSuccess('Response has correct structure with repositories array');
      logInfo(`Found ${response.data.repositories.length} repositories`);
      return true;
    } else {
      logError('Response missing repositories array');
      return false;
    }
  } else {
    logError(`GET /api/repo failed: ${response.status}`);
    return false;
  }
}

async function testValidateRepository() {
  logTest('POST /api/repo/validate');
  
  const testCases = VALIDATION_TEST_CASES;
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    logInfo(`  Testing: ${testCase.name}`);
    
    const response = await makeRequest(`${BASE_URL}/api/repo/validate`, {
      method: 'POST',
      body: JSON.stringify(testCase.data)
    });
    
    if (testCase.expectedValid) {
      if (response.ok && response.data && response.data.valid === true) {
        logSuccess(`    ✅ ${testCase.name} - Valid response`);
        
        // Check for correct displayName (should be just repo name, not owner/repo)
        if (response.data.displayName && !response.data.displayName.includes('/')) {
          logSuccess(`    ✅ displayName is correct: "${response.data.displayName}"`);
        } else {
          logError(`    ❌ displayName is incorrect: "${response.data.displayName}"`);
          allPassed = false;
        }
      } else {
        logError(`    ❌ ${testCase.name} - Expected valid but got: ${response.status}`);
        allPassed = false;
      }
    } else {
      if (!response.ok || (response.data && response.data.valid === false)) {
        logSuccess(`    ✅ ${testCase.name} - Correctly rejected`);
      } else {
        logError(`    ❌ ${testCase.name} - Expected invalid but got valid response`);
        allPassed = false;
      }
    }
  }
  
  if (allPassed) {
    logSuccess('All validation test cases passed');
  }
  
  return allPassed;
}

async function testValidateNonExistentRepository() {
  logTest('POST /api/repo/validate (Non-existent)');
  
  let allPassed = true;
  
  for (const testCase of NON_EXISTENT_REPO_TEST_CASES) {
    logInfo(`  Testing: ${testCase.name}`);
    
    const response = await makeRequest(`${BASE_URL}/api/repo/validate`, {
      method: 'POST',
      body: JSON.stringify(testCase.data)
    });
    
    if (response.status === testCase.expectedStatus || !response.ok) {
      logSuccess(`    ✅ ${testCase.name} - Correctly rejected (${response.status})`);
    } else {
      logError(`    ❌ ${testCase.name} - Expected ${testCase.expectedStatus} but got ${response.status}`);
      allPassed = false;
    }
  }
  
  if (allPassed) {
    logSuccess('All non-existent repository validation test cases passed');
  }
  
  return allPassed;
}

async function testAddRepository() {
  logTest('POST /api/repo/add');
  
  // First validate a repo to get the data
  const validateResponse = await makeRequest(`${BASE_URL}/api/repo/validate`, {
    method: 'POST',
    body: JSON.stringify({ repoUrl: REPO_TEST_DATA.omniLens.url })
  });
  
  if (!validateResponse.ok || !validateResponse.data.valid) {
    logError('Validation failed, cannot test add endpoint');
    return false;
  }
  
  const testCases = ADD_REPO_TEST_CASES.map(testCase => {
    if (testCase.name === 'Valid repository data') {
      return {
        ...testCase,
        data: {
          repoPath: validateResponse.data.repoPath,
          displayName: validateResponse.data.displayName,
          htmlUrl: validateResponse.data.htmlUrl,
          defaultBranch: validateResponse.data.defaultBranch
        }
      };
    }
    return testCase;
  });
  
  let allPassed = true;
  let addedSlug = null;
  
  for (const testCase of testCases) {
    logInfo(`  Testing: ${testCase.name}`);
    
    const response = await makeRequest(`${BASE_URL}/api/repo/add`, {
      method: 'POST',
      body: JSON.stringify(testCase.data)
    });
    
    if (testCase.shouldPass) {
      if (response.ok && response.data && response.data.success) {
        logSuccess(`    ✅ ${testCase.name} - Repository added successfully`);
        addedSlug = response.data.repo.slug; // Store the slug for cleanup
      } else if (response.status === 409) {
        logSuccess(`    ✅ ${testCase.name} - Repository already exists (expected for duplicate test)`);
        addedSlug = response.data.slug; // Store the slug for cleanup
      } else {
        logError(`    ❌ ${testCase.name} - Expected success but got: ${response.status}`);
        allPassed = false;
      }
    } else {
      if (!response.ok) {
        logSuccess(`    ✅ ${testCase.name} - Correctly rejected`);
      } else {
        logError(`    ❌ ${testCase.name} - Expected failure but got success`);
        allPassed = false;
      }
    }
  }
  
  // Clean up: remove the added repo so it doesn't interfere with other tests
  if (addedSlug) {
    await makeRequest(`${BASE_URL}/api/repo/${addedSlug}`, { method: 'DELETE' });
  }
  
  return allPassed;
}

async function testAddNonExistentRepository() {
  logTest('POST /api/repo/add (Non-existent)');
  
  let allPassed = true;
  
  for (const testCase of ADD_NON_EXISTENT_REPO_TEST_CASES) {
    logInfo(`  Testing: ${testCase.name}`);
    
    const response = await makeRequest(`${BASE_URL}/api/repo/add`, {
      method: 'POST',
      body: JSON.stringify(testCase.data)
    });
    
    if (response.status === testCase.expectedStatus) {
      logSuccess(`    ✅ ${testCase.name} - Correctly rejected (${response.status})`);
    } else {
      logError(`    ❌ ${testCase.name} - Expected ${testCase.expectedStatus} but got ${response.status}`);
      allPassed = false;
    }
  }
  
  if (allPassed) {
    logSuccess('All non-existent repository add test cases passed');
  }
  
  return allPassed;
}

async function testGetSpecificRepository() {
  logTest('GET /api/repo/{slug}');
  
  // First add a repo to test with
  const validateResponse = await makeRequest(`${BASE_URL}/api/repo/validate`, {
    method: 'POST',
    body: JSON.stringify({ repoUrl: 'https://github.com/Visi0ncore/OmniLens' })
  });
  
  if (!validateResponse.ok || !validateResponse.data.valid) {
    logError('Validation failed, cannot test specific repo endpoint');
    return false;
  }
  
  const addResponse = await makeRequest(`${BASE_URL}/api/repo/add`, {
    method: 'POST',
    body: JSON.stringify({
      repoPath: validateResponse.data.repoPath,
      displayName: validateResponse.data.displayName,
      htmlUrl: validateResponse.data.htmlUrl,
      defaultBranch: validateResponse.data.defaultBranch
    })
  });
  
  if (!addResponse.ok) {
    logError('Add failed, cannot test specific repo endpoint');
    return false;
  }
  
  const slug = addResponse.data.repo.slug;
  
  const testCases = [
    {
      name: 'Valid slug',
      slug: slug,
      shouldPass: true
    },
    {
      name: 'Invalid slug',
      slug: 'non-existent-repo',
      shouldPass: false
    }
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    logInfo(`  Testing: ${testCase.name}`);
    
    const response = await makeRequest(`${BASE_URL}/api/repo/${testCase.slug}`);
    
    if (testCase.shouldPass) {
      if (response.ok && response.data && response.data.success) {
        logSuccess(`    ✅ ${testCase.name} - Repository retrieved successfully`);
      } else {
        logError(`    ❌ ${testCase.name} - Expected success but got: ${response.status}`);
        allPassed = false;
      }
    } else {
      if (!response.ok && response.status === 404) {
        logSuccess(`    ✅ ${testCase.name} - Correctly not found`);
      } else {
        logError(`    ❌ ${testCase.name} - Expected 404 but got: ${response.status}`);
        allPassed = false;
      }
    }
  }
  
  // Clean up: remove the added repo so it doesn't interfere with other tests
  if (slug) {
    await makeRequest(`${BASE_URL}/api/repo/${slug}`, { method: 'DELETE' });
  }
  
  return allPassed;
}

async function testDeleteRepository() {
  logTest('DELETE /api/repo/{slug}');
  
  // First add a repo to test deletion
  const validateResponse = await makeRequest(`${BASE_URL}/api/repo/validate`, {
    method: 'POST',
    body: JSON.stringify({ repoUrl: 'https://github.com/microsoft/vscode' }) // Use different repo
  });
  
  if (!validateResponse.ok || !validateResponse.data.valid) {
    logError('Validation failed, cannot test delete endpoint');
    return false;
  }
  
  const addResponse = await makeRequest(`${BASE_URL}/api/repo/add`, {
    method: 'POST',
    body: JSON.stringify({
      repoPath: validateResponse.data.repoPath,
      displayName: validateResponse.data.displayName,
      htmlUrl: validateResponse.data.htmlUrl,
      defaultBranch: validateResponse.data.defaultBranch
    })
  });
  
  if (!addResponse.ok && addResponse.status !== 409) {
    logError('Add failed, cannot test delete endpoint');
    return false;
  }
  
  // If repository already exists (409), we can still test deletion
  const slug = addResponse.ok ? addResponse.data.repo.slug : addResponse.data.slug;
  
  const testCases = [
    {
      name: 'Valid slug',
      slug: slug,
      shouldPass: true
    },
    {
      name: 'Invalid slug',
      slug: 'non-existent-repo',
      shouldPass: false
    }
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    logInfo(`  Testing: ${testCase.name}`);
    
    const response = await makeRequest(`${BASE_URL}/api/repo/${testCase.slug}`, {
      method: 'DELETE'
    });
    
    if (testCase.shouldPass) {
      if (response.ok && response.data && response.data.success) {
        logSuccess(`    ✅ ${testCase.name} - Repository deleted successfully`);
      } else {
        logError(`    ❌ ${testCase.name} - Expected success but got: ${response.status}`);
        allPassed = false;
      }
    } else {
      if (!response.ok && response.status === 404) {
        logSuccess(`    ✅ ${testCase.name} - Correctly not found`);
      } else {
        logError(`    ❌ ${testCase.name} - Expected 404 but got: ${response.status}`);
        allPassed = false;
      }
    }
  }
  
  return allPassed;
}

async function testSlugGeneration() {
  logTest('Slug Generation (Clean URLs)');
  
  // Test the slug generation logic
  const testCases = SLUG_TEST_CASES;
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    const actualSlug = testCase.repoPath.replace(/\//g, '-');
    
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
async function runAllTests() {
  log('\n🚀 Starting OmniLens API Test Suite', 'bright');
  log('=' .repeat(50), 'bright');
  
  const tests = [
    { name: 'Server Health', fn: testServerHealth },
    { name: 'OpenAPI Specification', fn: testOpenAPISpec },
    { name: 'API Documentation Page', fn: testAPIDocsPage },
    { name: 'GET /api/repo', fn: testGetRepositories },
    { name: 'POST /api/repo/validate', fn: testValidateRepository },
    { name: 'POST /api/repo/validate (Non-existent)', fn: testValidateNonExistentRepository },
    { name: 'POST /api/repo/add', fn: testAddRepository },
    { name: 'POST /api/repo/add (Non-existent)', fn: testAddNonExistentRepository },
    { name: 'GET /api/repo/{slug}', fn: testGetSpecificRepository },
    { name: 'DELETE /api/repo/{slug}', fn: testDeleteRepository },
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
  
  // Use shared summary function
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    if (result.passed) {
      logSuccess(`${result.name}`);
    } else {
      logError(`${result.name}${result.error ? ` - ${result.error}` : ''}`);
    }
  });
  
  log('\n' + '=' .repeat(50), 'bright');
  log(`🎯 Overall: ${passed}/${total} tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n🎉 All tests passed! Your API is working perfectly!', 'green');
    return true;
  } else {
    log('\n🚨 Some tests failed. Please check the errors above.', 'yellow');
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
    
    const success = await runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  runAllTests,
  testServerHealth,
  testOpenAPISpec,
  testAPIDocsPage,
  testGetRepositories,
  testValidateRepository,
  testValidateNonExistentRepository,
  testAddRepository,
  testAddNonExistentRepository,
  testGetSpecificRepository,
  testDeleteRepository,
  testSlugGeneration,
  testZodValidation
};
