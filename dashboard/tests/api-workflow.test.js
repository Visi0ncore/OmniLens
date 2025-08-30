#!/usr/bin/env node

/**
 * OmniLens Workflow API Test Suite
 * 
 * This test suite validates the workflow API endpoints to ensure they're working correctly
 * 
 * Run with: node tests/api-workflow.test.js
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
async function testGetWorkflowsForValidRepository() {
  logTest('GET /api/workflow/{slug} - Valid Repository');
  
  // Ensure the repository exists for testing
  const repoData = {
    repoPath: 'Visi0ncore/OmniLens',
    displayName: 'OmniLens',
    htmlUrl: 'https://github.com/Visi0ncore/OmniLens',
    defaultBranch: 'main'
  };
  
  // Try to add the repository (it might already exist)
  await makeRequest(`${BASE_URL}/api/repo/add`, {
    method: 'POST',
    body: JSON.stringify(repoData)
  });
  
  const slug = 'Visi0ncore-OmniLens';
  
  // Test getting workflows for this repository
  const response = await makeRequest(`${BASE_URL}/api/workflow/${slug}`);
  
  if (response.ok && response.data) {
    logSuccess('GET /api/workflow/{slug} endpoint is working');
    
    // Validate response structure
    if (response.data.repository && response.data.workflows && typeof response.data.totalCount === 'number') {
      logSuccess('Response has correct structure');
      
      // Validate repository info
      if (response.data.repository.slug === slug && 
          response.data.repository.displayName === 'OmniLens') {
        logSuccess('Repository information is correct');
      } else {
        logError('Repository information is incorrect');
        return false;
      }
      
      // Log workflow information
      logInfo(`Found ${response.data.totalCount} workflows`);
      if (response.data.workflows.length > 0) {
        response.data.workflows.forEach(workflow => {
          logInfo(`  - ${workflow.name} (${workflow.state})`);
        });
      }
      
      return true;
    } else {
      logError('Response structure is invalid');
      return false;
    }
  } else {
    logError(`GET /api/workflow/{slug} failed: ${response.status}`);
    if (response.data && response.data.error) {
      logError(`Error: ${response.data.error}`);
    }
    return false;
  }
}

async function testGetWorkflowsForNonExistentRepository() {
  logTest('GET /api/workflow/{slug} - Non-existent Repository');
  
  const nonExistentSlug = 'non-existent-repo-12345';
  const response = await makeRequest(`${BASE_URL}/api/workflow/${nonExistentSlug}`);
  
  if (response.status === 404) {
    logSuccess('Correctly returned 404 for non-existent repository');
    return true;
  } else {
    logError(`Expected 404 but got: ${response.status}`);
    return false;
  }
}

async function testGetWorkflowsForInvalidSlug() {
  logTest('GET /api/workflow/{slug} - Invalid Slug');
  
  const invalidSlug = 'invalid-slug-with-special-chars!@#$%';
  const response = await makeRequest(`${BASE_URL}/api/workflow/${invalidSlug}`);
  
  if (response.status === 404) {
    logSuccess('Correctly returned 404 for invalid slug');
    return true;
  } else {
    logError(`Expected 404 but got: ${response.status}`);
    return false;
  }
}

async function testGetWorkflowsResponseStructure() {
  logTest('GET /api/workflow/{slug} - Response Structure Validation');
  
  // Ensure the repository exists for testing
  const repoData = {
    repoPath: 'Visi0ncore/OmniLens',
    displayName: 'OmniLens',
    htmlUrl: 'https://github.com/Visi0ncore/OmniLens',
    defaultBranch: 'main'
  };
  
  // Try to add the repository (it might already exist)
  await makeRequest(`${BASE_URL}/api/repo/add`, {
    method: 'POST',
    body: JSON.stringify(repoData)
  });
  
  const slug = 'Visi0ncore-OmniLens';
  
  // Get workflows
  const response = await makeRequest(`${BASE_URL}/api/workflow/${slug}`);
  
  if (response.ok && response.data) {
    const data = response.data;
    
    // Check required fields
    const requiredFields = ['repository', 'workflows', 'totalCount'];
    let allFieldsPresent = true;
    
    for (const field of requiredFields) {
      if (data.hasOwnProperty(field)) {
        logSuccess(`✅ Contains ${field}`);
      } else {
        logError(`❌ Missing ${field}`);
        allFieldsPresent = false;
      }
    }
    
    // Check repository structure
    if (data.repository) {
      const repoFields = ['slug', 'displayName', 'repoPath'];
      for (const field of repoFields) {
        if (data.repository.hasOwnProperty(field)) {
          logSuccess(`✅ Repository contains ${field}`);
        } else {
          logError(`❌ Repository missing ${field}`);
          allFieldsPresent = false;
        }
      }
    }
    
    // Check workflows array structure (if any workflows exist)
    if (data.workflows && data.workflows.length > 0) {
      const workflow = data.workflows[0];
      const workflowFields = ['id', 'name', 'path', 'state', 'createdAt', 'updatedAt'];
      
      for (const field of workflowFields) {
        if (workflow.hasOwnProperty(field)) {
          logSuccess(`✅ Workflow contains ${field}`);
        } else {
          logError(`❌ Workflow missing ${field}`);
          allFieldsPresent = false;
        }
      }
    }
    
    return allFieldsPresent;
  } else {
    logError(`Failed to get workflows: ${response.status}`);
    return false;
  }
}

// Main test runner
async function runWorkflowTests() {
  log('\n🚀 Starting OmniLens Workflow API Test Suite', 'bright');
  log('=' .repeat(60), 'bright');
  
  const tests = [
    { name: 'GET /api/workflow/{slug} - Valid Repository', fn: testGetWorkflowsForValidRepository },
    { name: 'GET /api/workflow/{slug} - Non-existent Repository', fn: testGetWorkflowsForNonExistentRepository },
    { name: 'GET /api/workflow/{slug} - Invalid Slug', fn: testGetWorkflowsForInvalidSlug },
    { name: 'GET /api/workflow/{slug} - Response Structure', fn: testGetWorkflowsResponseStructure }
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
  
  log('\n📊 Workflow API Test Results:', 'bright');
  results.forEach(result => {
    if (result.passed) {
      logSuccess(`${result.name}`);
    } else {
      logError(`${result.name}${result.error ? ` - ${result.error}` : ''}`);
    }
  });
  
  log('\n' + '=' .repeat(60), 'bright');
  log(`🎯 Overall: ${passed}/${total} workflow API tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n🎉 All workflow API tests passed! Your workflow API is working perfectly!', 'green');
    return true;
  } else {
    log('\n🚨 Some workflow API tests failed. Please check the errors above.', 'yellow');
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
    
    const success = await runWorkflowTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    logError(`Workflow API test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  runWorkflowTests,
  testGetWorkflowsForValidRepository,
  testGetWorkflowsForNonExistentRepository,
  testGetWorkflowsForInvalidSlug,
  testGetWorkflowsResponseStructure
};
