#!/usr/bin/env node

/**
 * Golden Repository Test Suite
 * Tests the complete user workflow: validate → add → get → delete
 * Uses https://github.com/Visi0ncore/OmniLens as the golden test repository
 * Tests the end-to-end user journey through the dashboard
 */

import {
  BASE_URL,
  TEST_REPO,
  TEST_SLUG,
  log,
  logTest,
  makeRequest,
  checkServer,
  printTestSummary
} from './test-utils.js';

// Test 1: Validate Repository
async function testValidateRepository() {
  log('\n🧪 Testing: Repository Validation', 'cyan');
  
  const { response, data, ok, status } = await makeRequest(`${BASE_URL}/api/repo/validate`, {
    method: 'POST',
    body: JSON.stringify({ repoUrl: TEST_REPO })
  });
  
  if (ok && data.valid) {
    logTest('Repository Validation', 'PASS', `Repository is valid: ${data.displayName}`);
    return data; // Return validation data for next tests
  } else {
    logTest('Repository Validation', 'FAIL', `Status: ${status}, Error: ${data?.error || 'Unknown error'}`);
    return null;
  }
}

// Test 2: Add Repository
async function testAddRepository(validationData) {
  log('\n🧪 Testing: Add Repository', 'cyan');
  
  if (!validationData) {
    logTest('Add Repository', 'FAIL', 'Skipped - validation failed');
    return false;
  }
  
  const { response, data, ok, status } = await makeRequest(`${BASE_URL}/api/repo/add`, {
    method: 'POST',
    body: JSON.stringify({
      repoPath: validationData.repoPath,
      displayName: validationData.displayName,
      htmlUrl: validationData.htmlUrl,
      defaultBranch: validationData.defaultBranch,
      avatarUrl: validationData.avatarUrl
    })
  });
  
  if (ok && data.success) {
    logTest('Add Repository', 'PASS', `Repository added: ${data.repo.slug}`);
    return true;
  } else if (status === 409) {
    logTest('Add Repository', 'PASS', 'Repository already exists (expected)');
    return true;
  } else {
    logTest('Add Repository', 'FAIL', `Status: ${status}, Error: ${data?.error || 'Unknown error'}`);
    return false;
  }
}

// Test 3: Get All Repositories
async function testGetAllRepositories() {
  log('\n🧪 Testing: Get All Repositories', 'cyan');
  
  const { response, data, ok, status } = await makeRequest(`${BASE_URL}/api/repo`);
  
  if (ok && data.repositories) {
    const testRepo = data.repositories.find(repo => repo.slug === TEST_SLUG);
    if (testRepo) {
      logTest('Get All Repositories', 'PASS', `Found ${data.repositories.length} repositories, including test repo`);
      return true;
    } else {
      logTest('Get All Repositories', 'FAIL', 'Test repository not found in list');
      return false;
    }
  } else {
    logTest('Get All Repositories', 'FAIL', `Status: ${status}, Error: ${data?.error || 'Unknown error'}`);
    return false;
  }
}

// Test 4: Get Specific Repository
async function testGetSpecificRepository() {
  log('\n🧪 Testing: Get Specific Repository', 'cyan');
  
  const { response, data, ok, status } = await makeRequest(`${BASE_URL}/api/repo/${TEST_SLUG}`);
  
  if (ok && data.success && data.repo) {
    logTest('Get Specific Repository', 'PASS', `Repository found: ${data.repo.displayName}`);
    return true;
  } else {
    logTest('Get Specific Repository', 'FAIL', `Status: ${status}, Error: ${data?.error || 'Unknown error'}`);
    return false;
  }
}

// Test 5: Get Non-existent Repository
async function testGetNonExistentRepository() {
  log('\n🧪 Testing: Get Non-existent Repository', 'cyan');
  
  const { response, data, ok, status } = await makeRequest(`${BASE_URL}/api/repo/non-existent-repo`);
  
  if (status === 404) {
    logTest('Get Non-existent Repository', 'PASS', 'Correctly returned 404');
    return true;
  } else {
    logTest('Get Non-existent Repository', 'FAIL', `Expected 404, got ${status}`);
    return false;
  }
}

// Test 6: Delete Repository
async function testDeleteRepository() {
  log('\n🧪 Testing: Delete Repository', 'cyan');
  
  const { response, data, ok, status } = await makeRequest(`${BASE_URL}/api/repo/${TEST_SLUG}`, {
    method: 'DELETE'
  });
  
  if (ok && data.success) {
    logTest('Delete Repository', 'PASS', `Repository deleted: ${data.deletedRepo.slug}`);
    return true;
  } else {
    logTest('Delete Repository', 'FAIL', `Status: ${status}, Error: ${data?.error || 'Unknown error'}`);
    return false;
  }
}

// Test 7: Delete Non-existent Repository
async function testDeleteNonExistentRepository() {
  log('\n🧪 Testing: Delete Non-existent Repository', 'cyan');
  
  const { response, data, ok, status } = await makeRequest(`${BASE_URL}/api/repo/non-existent-repo`, {
    method: 'DELETE'
  });
  
  if (status === 404) {
    logTest('Delete Non-existent Repository', 'PASS', 'Correctly returned 404');
    return true;
  } else {
    logTest('Delete Non-existent Repository', 'FAIL', `Expected 404, got ${status}`);
    return false;
  }
}

// Test 8: Verify Repository Deleted
async function testVerifyRepositoryDeleted() {
  log('\n🧪 Testing: Verify Repository Deleted', 'cyan');
  
  const { response, data, ok, status } = await makeRequest(`${BASE_URL}/api/repo`);
  
  if (ok && data.repositories) {
    const testRepo = data.repositories.find(repo => repo.slug === TEST_SLUG);
    if (!testRepo) {
      logTest('Verify Repository Deleted', 'PASS', 'Repository successfully removed from list');
      return true;
    } else {
      logTest('Verify Repository Deleted', 'FAIL', 'Repository still exists in list');
      return false;
    }
  } else {
    logTest('Verify Repository Deleted', 'FAIL', `Status: ${status}, Error: ${data?.error || 'Unknown error'}`);
    return false;
  }
}

// Main test runner
async function runGoldenTests() {
  log('\n🚀 Starting Golden Repository Test Suite', 'bright');
  log('==================================================', 'blue');
  log(`Test Repository: ${TEST_REPO}`, 'yellow');
  log(`Expected Slug: ${TEST_SLUG}`, 'yellow');
  
  const results = [];
  
  // Run tests in sequence
  const validationData = await testValidateRepository();
  results.push(!!validationData);
  
  const added = await testAddRepository(validationData);
  results.push(added);
  
  const getAll = await testGetAllRepositories();
  results.push(getAll);
  
  const getSpecific = await testGetSpecificRepository();
  results.push(getSpecific);
  
  const getNonExistent = await testGetNonExistentRepository();
  results.push(getNonExistent);
  
  const deleted = await testDeleteRepository();
  results.push(deleted);
  
  const deleteNonExistent = await testDeleteNonExistentRepository();
  results.push(deleteNonExistent);
  
  const verified = await testVerifyRepositoryDeleted();
  results.push(verified);
  
  // Use shared summary function
  return printTestSummary(results, 'Golden Repository');
}

// Main execution
async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  
  const success = await runGoldenTests();
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`\n💥 Test suite crashed: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { runGoldenTests, checkServer };
