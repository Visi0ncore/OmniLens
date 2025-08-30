# API Test Suite

This directory contains automated tests for the OmniLens Dashboard API.

## Test Files

### `test-utils.js` ⭐ NEW
Shared utilities and configuration for all test files:
- Common configuration (URLs, test data)
- Color-coded logging functions
- HTTP request utilities
- Server health checks
- Test result summaries
- Re-exports test cases from test-cases.js

### `test-cases.js` ⭐ NEW
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

### `api-repo.test.js`
Comprehensive test suite for all API endpoints including:
- Server health check
- OpenAPI specification validation
- API documentation page
- All repository endpoints (individual testing)
- Zod validation integration
- Slug generation
- Multiple test cases per endpoint (valid, invalid, edge cases)

**Run with:** `bun run test:api`

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

# Run API repository tests only
bun run test:api

# Run golden repository tests only
bun run test:golden

# Run both test suites
bun run test:api && bun run test:golden
```

### GitHub Actions

The following workflows are available for automated testing:

- **`test-api-repo.yml`** - Runs API repository tests only
- **`test-golden-repo.yml`** - Runs golden repository tests only  
- **`test-all.yml`** - Runs both test suites (recommended)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Manual dispatch via GitHub Actions UI

**Requirements:**
- PostgreSQL 15 service container
- GitHub token for API access
- Bun runtime environment

## Test Coverage

### API Endpoints Tested
- ✅ `GET /api/repo` - List repositories
- ✅ `POST /api/repo/validate` - Validate repository
- ✅ `POST /api/repo/add` - Add repository to dashboard
- ✅ `GET /api/repo/{slug}` - Get specific repository
- ✅ `DELETE /api/repo/{slug}` - Delete repository

### Test Coverage
- ✅ **API Repository Testing**: Individual endpoint testing with multiple test cases
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
