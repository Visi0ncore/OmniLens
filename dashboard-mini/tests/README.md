# API Test Suite

This directory contains automated tests for the OmniLens Dashboard Mini API.

**Note**: Dashboard-mini is designed to work with a single repository. Repository management endpoints (add, validate, delete) are disabled.

## Test Files

### `test-utils.js`
Shared utilities and configuration for all test files:
- Common configuration (URLs, test data)
- Color-coded logging functions
- HTTP request utilities
- Server health checks
- Test result summaries
- Re-exports test cases from test-cases.js

### `test-cases.js`
Predefined test cases and test data:
- Repository test data (OmniLens, VSCode)
- Validation test cases (for validation endpoint)
- Non-existent repository validation test cases
- Zod validation test cases (for schema validation)
- Slug generation test cases
- Repository add test cases (valid and invalid data)
- Non-existent repository add test cases
- CRUD test sequence definitions
- API endpoint test definitions

### `health.test.js`
Health and infrastructure test suite including:
- Server health check
- Zod validation integration
- Slug generation testing
- Core system functionality validation

**Run with:** `bun run test:health`

### `api-repo.test.js`
Comprehensive test suite for API endpoints including:
- All repository endpoints (individual testing)
- CRUD operations validation
- Multiple test cases per endpoint (valid, invalid, edge cases)
- Database integration testing

**Run with:** `bun run test:api:recon`

### `api-workflow.test.js`
Comprehensive test suite for workflow API endpoints including:
- Workflow retrieval for valid repositories
- Error handling for non-existent repositories
- Response structure validation
- GitHub workflows integration testing

**Run with:** `bun run test:workflow`

### `golden-repo.test.js`
Golden repository test suite for the complete user journey:
- Repository validation
- Adding repositories to dashboard
- Getting all repositories
- Getting specific repository by slug
- Deleting repositories
- Error handling for non-existent resources
- Tests the complete workflow: validate → add → get → delete
- Uses https://github.com/Visi0ncore/OmniLens as the golden test repository

**Run with:** `bun run test:golden`

## Prerequisites

1. **Development server running**: `bun run dev`
2. **PostgreSQL database**: Set up and running
3. **GitHub token**: Configured in `.env.local`

## Running Tests

### Local Development

```bash
# Run all tests
bun run test

# Run health tests only
bun run test:health

# Run API repository tests only
bun run test:api:recon

# Run workflow API tests only
bun run test:api:workflow

# Run golden repository tests only
bun run test:golden

# Run specific test suites
bun run test:health && bun run test:api:recon && bun run test:api:workflow && bun run test:golden
```

### GitHub Actions

The following workflows are available for automated testing:

- **`test-health.yml`** - Runs health and infrastructure tests only
- **`test-api-repo.yml`** - Runs API repository tests only
- **`test-api-workflow.yml`** - Runs workflow API tests only
- **`test-golden-repo.yml`** - Runs golden repository tests only

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Manual dispatch via GitHub Actions UI

**Requirements:**
- PostgreSQL 15 service container (for API and golden tests)
- GitHub token for API access
- Bun runtime environment

**Note:** Each workflow runs independently. To run all tests locally, use `bun run test`.

## Test Coverage

### API Endpoints Tested
- ✅ `GET /api/repo` - List repositories (single repository only)
- ✅ `POST /api/repo/validate` - Validate repository (with single repo constraint)
- ✅ `POST /api/repo/add` - Add repository (with single repo constraint)
- ✅ `GET /api/repo/{slug}` - Get specific repository
- ✅ `DELETE /api/repo/{slug}` - Delete repository

### Test Coverage
- ✅ **Health & Infrastructure Testing**: System health, Zod validation, slug generation

- ✅ **API Repository Testing**: Individual endpoint testing with multiple test cases
- ✅ **Workflow API Testing**: GitHub workflows integration and validation
- ✅ **Golden Repository Testing**: Complete user journey testing with OmniLens repo
- ✅ **Error Handling**: Non-existent resources, validation errors
- ✅ **Data Integrity**: Database persistence and cleanup

## Test Results

Both test suites should show:
- ✅ Server connectivity
- ✅ All endpoints responding correctly
- ✅ Proper error handling
- ✅ Database persistence
- ✅ Zod validation working
- ✅ Clean test environment (no leftover data)

## Troubleshooting

If tests fail:
1. Ensure development server is running (`bun run dev`)
2. Check PostgreSQL is running (`brew services list | grep postgresql`)
3. Verify GitHub token is configured
4. Check database connection in `lib/db.ts`
