#!/usr/bin/env node

/**
 * OmniLens Workflow Persistence Test Suite
 * 
 * This test suite validates the new workflow persistence functionality
 * 
 * Run with: node tests/workflow-persistence.test.js
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
async function testWorkflowPersistence() {
  logTest('Workflow Persistence - Save and Retrieve');
  
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
  
  const slug = 'OmniLens';
  
  // Step 1: Fetch workflows from GitHub (this should save them to database)
  logInfo('Step 1: Fetching workflows from GitHub...');
  const fetchResponse = await makeRequest(`${BASE_URL}/api/workflow/${slug}`);
  
  if (!fetchResponse.ok) {
    logError(`Failed to fetch workflows: ${fetchResponse.status}`);
    return false;
  }
  
  logSuccess(`Fetched ${fetchResponse.data.totalCount} workflows from GitHub`);
  
  // Step 2: Retrieve workflows again (should come from database this time)
  logInfo('Step 2: Retrieving workflows again (should come from database)...');
  const secondResponse = await makeRequest(`${BASE_URL}/api/workflow/${slug}`);
  
  if (!secondResponse.ok) {
    logError(`Failed to retrieve workflows on second call: ${secondResponse.status}`);
    return false;
  }
  
  logSuccess(`Retrieved ${secondResponse.data.totalCount} workflows on second call`);
  
  // Step 3: Compare the results
  if (fetchResponse.data.totalCount === secondResponse.data.totalCount) {
    logSuccess('Workflow counts match between first and second calls');
    
    // Log some workflow details
    if (secondResponse.data.workflows.length > 0) {
      logInfo('Sample workflows:');
      secondResponse.data.workflows.slice(0, 3).forEach(workflow => {
        logInfo(`  - ${workflow.name} (${workflow.state}) - ${workflow.path}`);
      });
    }
    
    return true;
  } else {
    logError(`Workflow count mismatch: First=${fetchResponse.data.totalCount}, Second=${secondResponse.data.totalCount}`);
    return false;
  }
}

async function testWorkflowPersistenceForNewRepo() {
  logTest('Workflow Persistence - New Repository');
  
  const testSlug = 'test-repo-persistence';
  const repoData = {
    repoPath: 'Visi0ncore/OmniLens', // Use existing repo for testing
    displayName: 'Test Repo',
    htmlUrl: 'https://github.com/Visi0ncore/OmniLens',
    defaultBranch: 'main'
  };
  
  // Add test repository
  const addResponse = await makeRequest(`${BASE_URL}/api/repo/add`, {
    method: 'POST',
    body: JSON.stringify({ ...repoData, slug: testSlug })
  });
  
  if (!addResponse.ok) {
    logError(`Failed to add test repository: ${addResponse.status}`);
    return false;
  }
  
  // Try to get workflows (should be empty initially)
  const workflowResponse = await makeRequest(`${BASE_URL}/api/workflow/${testSlug}`);
  
  if (workflowResponse.ok && workflowResponse.data.totalCount === 0) {
    logSuccess('New repository correctly has no workflows');
    return true;
  } else {
    logError(`Expected empty workflows but got: ${workflowResponse.data.totalCount}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  log('🧪 Starting Workflow Persistence Tests...\n');
  
  // Check if server is running
  const serverRunning = await checkServer();
  if (!serverRunning) {
    logError('❌ Server is not running. Please start the development server first.');
    logInfo('Run: npm run dev');
    process.exit(1);
  }
  
  logSuccess('✅ Server is running\n');
  
  const tests = [
    testWorkflowPersistence,
    testWorkflowPersistenceForNewRepo
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      logError(`Test failed with error: ${error.message}`);
      failed++;
    }
    log(''); // Add spacing between tests
  }
  
  // Summary
  log('📊 Test Summary:');
  logSuccess(`✅ Passed: ${passed}`);
  if (failed > 0) {
    logError(`❌ Failed: ${failed}`);
  } else {
    logSuccess(`❌ Failed: ${failed}`);
  }
  
  const total = passed + failed;
  logInfo(`📈 Total: ${total}`);
  
  if (failed === 0) {
    logSuccess('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    logError('\n💥 Some tests failed!');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    logError(`Test runner failed: ${error.message}`);
    process.exit(1);
  });
}
