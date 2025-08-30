/**
 * Test Cases and Test Data
 * Predefined test cases and data for API testing
 */

// Repository test data
export const REPO_TEST_DATA = {
  omniLens: {
    url: 'https://github.com/Visi0ncore/OmniLens',
    slug: 'Visi0ncore-OmniLens',
    displayName: 'OmniLens'
  },
  vscode: {
    url: 'https://github.com/microsoft/vscode',
    slug: 'microsoft-vscode',
    displayName: 'vscode'
  }
};

// Repository validation test cases
export const VALIDATION_TEST_CASES = [
  {
    name: 'Valid repository (OmniLens)',
    data: { repoUrl: REPO_TEST_DATA.omniLens.url },
    expectedValid: true
  },
  {
    name: 'Valid repository (VSCode)',
    data: { repoUrl: REPO_TEST_DATA.vscode.url },
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

// Non-existent repository test cases
export const NON_EXISTENT_REPO_TEST_CASES = [
  {
    name: 'Non-existent repository',
    data: { repoUrl: 'https://github.com/non-existent-user/non-existent-repo' },
    expectedValid: false,
    expectedStatus: 404
  },
  {
    name: 'Invalid GitHub URL format',
    data: { repoUrl: 'https://github.com/invalid-format' },
    expectedValid: false,
    expectedStatus: 400
  }
];

// Zod validation test cases
export const ZOD_VALIDATION_TEST_CASES = [
  {
    name: 'Valid request with repoUrl',
    data: { repoUrl: REPO_TEST_DATA.omniLens.url },
    shouldPass: true
  },
  {
    name: 'Empty repoUrl',
    data: { repoUrl: '' },
    shouldPass: false
  },
  {
    name: 'Missing repoUrl',
    data: {},
    shouldPass: false
  }
];

// Slug generation test cases
export const SLUG_TEST_CASES = [
  {
    repoPath: 'Visi0ncore/OmniLens',
    expectedSlug: 'OmniLens',
    description: 'Should generate clean slug without local- prefix'
  },
  {
    repoPath: 'microsoft/vscode',
    expectedSlug: 'vscode',
    description: 'Should extract just the repository name'
  }
];

// Repository add test cases
export const ADD_REPO_TEST_CASES = [
  {
    name: 'Valid repository data',
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

// Non-existent repository add test cases
export const ADD_NON_EXISTENT_REPO_TEST_CASES = [
  {
    name: 'Non-existent repository data',
    data: {
      repoPath: 'non-existent-user/non-existent-repo',
      displayName: 'Non-existent Repo',
      htmlUrl: 'https://github.com/non-existent-user/non-existent-repo',
      defaultBranch: 'main'
    },
    shouldPass: false, // The add endpoint now validates repository existence
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
    shouldPass: false, // The add endpoint now validates repository existence
    expectedStatus: 404
  }
];

// CRUD test sequence
export const CRUD_TEST_SEQUENCE = [
  {
    name: 'Repository Validation',
    description: 'Validate the test repository exists and is accessible'
  },
  {
    name: 'Add Repository',
    description: 'Add the validated repository to the dashboard'
  },
  {
    name: 'Get All Repositories',
    description: 'Verify the repository appears in the list'
  },
  {
    name: 'Get Specific Repository',
    description: 'Retrieve the repository by its slug'
  },
  {
    name: 'Get Non-existent Repository',
    description: 'Test 404 handling for non-existent resources'
  },
  {
    name: 'Delete Repository',
    description: 'Remove the repository from the dashboard'
  },
  {
    name: 'Delete Non-existent Repository',
    description: 'Test 404 handling for deletion of non-existent resources'
  },
  {
    name: 'Verify Repository Deleted',
    description: 'Confirm the repository is removed from the list'
  }
];

// API endpoint test cases
export const API_ENDPOINT_TESTS = [
  {
    name: 'Server Health',
    description: 'Check if the development server is running'
  },
  {
    name: 'OpenAPI Specification',
    description: 'Validate OpenAPI spec is accessible and well-formed'
  },
  {
    name: 'API Documentation Page',
    description: 'Test Swagger UI documentation page'
  },
  {
    name: 'GET /api/repo',
    description: 'Test repository listing endpoint'
  },
  {
    name: 'POST /api/repo/validate',
    description: 'Test repository validation endpoint'
  },
  {
    name: 'POST /api/repo/validate (Non-existent)',
    description: 'Test repository validation endpoint with non-existent repository'
  },
  {
    name: 'POST /api/repo/add',
    description: 'Test repository addition endpoint'
  },
  {
    name: 'POST /api/repo/add (Non-existent)',
    description: 'Test repository addition endpoint with non-existent repository'
  },
  {
    name: 'GET /api/repo/{slug}',
    description: 'Test specific repository retrieval'
  },
  {
    name: 'DELETE /api/repo/{slug}',
    description: 'Test repository deletion'
  },
  {
    name: 'Slug Generation',
    description: 'Test clean URL slug generation'
  },
  {
    name: 'Zod Validation',
    description: 'Test Zod schema validation integration'
  }
];
