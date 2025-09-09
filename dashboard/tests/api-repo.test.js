#!/usr/bin/env node

/**
 * OmniLens API Repository Test Suite
 * 
 * This test suite validates all our API endpoints individually to ensure they're working correctly
 * and returning the expected responses. Tests each endpoint in isolation with various test cases.
 * Focuses on CRUD operations and API functionality.
 * 
 * Run with: node tests/api-repo.test.js
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

async function testGetRepositories() {
  logTest('GET /api/repo');
  
  const response = await makeRequest(`${BASE_URL}/api/repo`);
  
  if (response.ok) {
    logSuccess('GET /api/repo endpoint is working');
    
    if (response.data && response.data.repositories) {
      logSuccess('Response has correct structure with repositories array');
      logInfo(`Found ${response.data.repositories.length} repositories`);
      
      // Validate each repository has required fields
      const requiredFields = ['slug', 'displayName'];
      let allValid = true;
      
      for (const repo of response.data.repositories) {
        for (const field of requiredFields) {
          if (!repo.hasOwnProperty(field)) {
            logError(`Repository missing required field: ${field}`);
            allValid = false;
          }
        }
      }
      
      return allValid;
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
  
  const testCases = [
    {
      name: 'Valid repository (Visi0ncore/OmniLens)',
      data: { repoUrl: 'https://github.com/Visi0ncore/OmniLens' },
      expectedValid: true
    },
    {
      name: 'Valid repository (microsoft/vscode)',
      data: { repoUrl: 'https://github.com/microsoft/vscode' },
      expectedValid: true
    },
    {
      name: 'Empty repoUrl',
      data: { repoUrl: '' },
      expectedValid: false
    },
    {
      name: 'Missing repoUrl',
      data: {},
      expectedValid: false
    }
  ];
  
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
        
        // Check for required fields
        const requiredFields = ['repoPath', 'htmlUrl', 'defaultBranch', 'owner', 'avatarUrl'];
        for (const field of requiredFields) {
          if (response.data.hasOwnProperty(field)) {
            logSuccess(`    ✅ Contains ${field}`);
          } else {
            logError(`    ❌ Missing ${field}`);
            allPassed = false;
          }
        }
      } else {
        logError(`    ❌ ${testCase.name} - Expected valid but got: ${response.status}`);
        if (response.data && response.data.error) {
          logError(`    ❌ Error: ${response.data.error}`);
        }
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
  
  const testCases = [
    {
      name: 'Non-existent repository',
      data: { repoUrl: 'https://github.com/non-existent-user/non-existent-repo' },
      expectedStatus: 404
    },
    {
      name: 'Invalid GitHub URL format',
      data: { repoUrl: 'https://github.com/invalid-format' },
      expectedStatus: 400
    }
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
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
    body: JSON.stringify({ repoUrl: 'https://github.com/Visi0ncore/OmniLens' })
  });
  
  if (!validateResponse.ok || !validateResponse.data.valid) {
    logError('Validation failed, cannot test add endpoint');
    return false;
  }
  
  const testCases = [
    {
      name: 'Valid repository data',
      data: {
        repoPath: validateResponse.data.repoPath,
        displayName: validateResponse.data.displayName,
        htmlUrl: validateResponse.data.htmlUrl,
        defaultBranch: validateResponse.data.defaultBranch
      },
      shouldPass: true
    },
    {
      name: 'Missing required fields',
      data: {
        repoPath: 'Visi0ncore/OmniLens'
        // Missing other required fields
      },
      shouldPass: false
    },
    {
      name: 'Invalid HTML URL',
      data: {
        repoPath: 'Visi0ncore/OmniLens',
        displayName: 'OmniLens',
        htmlUrl: 'not-a-url',
        defaultBranch: 'main'
      },
      shouldPass: false
    }
  ];
  
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
        
        // Validate response structure
        const requiredFields = ['slug', 'repoPath', 'displayName', 'htmlUrl', 'defaultBranch'];
        for (const field of requiredFields) {
          if (response.data.repo.hasOwnProperty(field)) {
            logSuccess(`    ✅ Response contains ${field}`);
          } else {
            logError(`    ❌ Response missing ${field}`);
            allPassed = false;
          }
        }
      } else if (response.status === 409) {
        logSuccess(`    ✅ ${testCase.name} - Repository already exists (expected for duplicate test)`);
        addedSlug = response.data.slug; // Store the slug for cleanup
      } else {
        logError(`    ❌ ${testCase.name} - Expected success but got: ${response.status}`);
        if (response.data && response.data.error) {
          logError(`    ❌ Error: ${response.data.error}`);
        }
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
    const deleteResponse = await makeRequest(`${BASE_URL}/api/repo/${addedSlug}`, { method: 'DELETE' });
    if (deleteResponse.ok) {
      logSuccess(`    ✅ Cleaned up test repository: ${addedSlug}`);
    } else {
      logWarning(`    ⚠️ Failed to clean up test repository: ${addedSlug}`);
    }
  }
  
  return allPassed;
}

async function testAddNonExistentRepository() {
  logTest('POST /api/repo/add (Non-existent)');
  
  const testCases = [
    {
      name: 'Non-existent repository data',
      data: {
        repoPath: 'non-existent-user/non-existent-repo',
        displayName: 'Non-existent Repo',
        htmlUrl: 'https://github.com/non-existent-user/non-existent-repo',
        defaultBranch: 'main'
      },
      shouldPass: false,
      expectedStatus: 404
    },
    {
      name: 'Invalid repository path format',
      data: {
        repoPath: 'invalid-format',
        displayName: 'Invalid Format',
        htmlUrl: 'https://github.com/invalid-format',
        defaultBranch: 'main'
      },
      shouldPass: false,
      expectedStatus: 404
    }
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
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
  
  if (!addResponse.ok && addResponse.status !== 409) {
    logError('Add failed, cannot test specific repo endpoint');
    return false;
  }
  
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
    
    const response = await makeRequest(`${BASE_URL}/api/repo/${testCase.slug}`);
    
    if (testCase.shouldPass) {
      if (response.ok && response.data && response.data.success) {
        logSuccess(`    ✅ ${testCase.name} - Repository retrieved successfully`);
        
        // Validate response structure
        const requiredFields = ['id', 'slug', 'repoPath', 'displayName', 'htmlUrl', 'defaultBranch'];
        for (const field of requiredFields) {
          if (response.data.repo.hasOwnProperty(field)) {
            logSuccess(`    ✅ Response contains ${field}`);
          } else {
            logError(`    ❌ Response missing ${field}`);
            allPassed = false;
          }
        }
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
    const deleteResponse = await makeRequest(`${BASE_URL}/api/repo/${slug}`, { method: 'DELETE' });
    if (deleteResponse.ok) {
      logSuccess(`    ✅ Cleaned up test repository: ${slug}`);
    } else {
      logWarning(`    ⚠️ Failed to clean up test repository: ${slug}`);
    }
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
        
        // Validate response structure
        const requiredFields = ['message', 'deletedRepo'];
        for (const field of requiredFields) {
          if (response.data.hasOwnProperty(field)) {
            logSuccess(`    ✅ Response contains ${field}`);
          } else {
            logError(`    ❌ Response missing ${field}`);
            allPassed = false;
          }
        }
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

// Main test runner
async function runAllTests() {
  log('\n🚀 Starting OmniLens API Test Suite', 'bright');
  log('=' .repeat(50), 'bright');
  
  const tests = [
    { name: 'GET /api/repo', fn: testGetRepositories },
    { name: 'POST /api/repo/validate', fn: testValidateRepository },
    { name: 'POST /api/repo/validate (Non-existent)', fn: testValidateNonExistentRepository },
    { name: 'POST /api/repo/add', fn: testAddRepository },
    { name: 'POST /api/repo/add (Non-existent)', fn: testAddNonExistentRepository },
    { name: 'GET /api/repo/{slug}', fn: testGetSpecificRepository },
    { name: 'DELETE /api/repo/{slug}', fn: testDeleteRepository }
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
  testGetRepositories,
  testValidateRepository,
  testValidateNonExistentRepository,
  testAddRepository,
  testAddNonExistentRepository,
  testGetSpecificRepository,
  testDeleteRepository
};
