# OmniLens API Test Suite

This directory contains comprehensive tests for the OmniLens API endpoints.

## Quick Start

Make sure your development server is running:
```bash
bun run dev
```

Then run the test suite:
```bash
bun run test:api
```

## What's Tested

The test suite validates:

### ✅ **Server Health**
- Ensures the development server is running and responding

### ✅ **OpenAPI Specification**
- Validates that the OpenAPI spec is accessible at `/openapi.yaml`
- Checks for proper YAML structure
- Counts available endpoints

### ✅ **API Documentation**
- Tests the Swagger UI page at `/api-docs.html`
- Verifies Swagger UI is properly loaded

### ✅ **GET /api/repo**
- Tests the repository listing endpoint
- Validates response structure
- Counts available repositories

### ✅ **POST /api/repo/validate**
- Tests repository validation with multiple scenarios:
  - Valid repositories (OmniLens, VSCode)
  - Empty repository URLs
  - Missing repository URLs
- Validates `displayName` returns just the repo name (not owner/repo)
- Tests Zod validation integration

### ✅ **Slug Generation**
- Validates clean URL generation (no more ugly `local-` prefix!)
- Tests slash-to-dash conversion

### ✅ **Zod Validation**
- Tests Zod schema validation for request bodies
- Validates proper error responses for invalid data

## Test Output

The test suite provides colorful, detailed output:

- 🧪 **Test sections** with clear descriptions
- ✅ **Success indicators** for passing tests
- ❌ **Error indicators** for failing tests
- ℹ️ **Info messages** with additional details
- 📊 **Summary** with overall pass/fail count

## Example Output

```
🚀 Starting OmniLens API Test Suite
==================================================

🧪 Testing: Server Health Check
✅ Server is running and responding

🧪 Testing: POST /api/repo/validate
ℹ️    Testing: Valid repository (OmniLens)
✅     ✅ Valid repository (OmniLens) - Valid response
✅     ✅ displayName is correct: "OmniLens"

📊 Test Results Summary
==================================================
✅ Server Health
✅ OpenAPI Specification
✅ API Documentation Page
✅ GET /api/repo
✅ POST /api/repo/validate
✅ Slug Generation
✅ Zod Validation

🎯 Overall: 7/7 tests passed
🎉 All tests passed! Your API is working perfectly!
```

## Adding New Tests

To add new tests:

1. Create a new test function in `api-endpoints.test.js`
2. Add it to the `tests` array in `runAllTests()`
3. Export it from the module

Example:
```javascript
async function testNewEndpoint() {
  logTest('New Endpoint Test');
  
  const response = await makeRequest(`${BASE_URL}/api/new-endpoint`);
  
  if (response.ok) {
    logSuccess('New endpoint is working');
    return true;
  } else {
    logError(`New endpoint failed: ${response.status}`);
    return false;
  }
}
```

## Troubleshooting

### Server Not Running
If you get "Server is not running!" error:
```bash
bun run dev
```

### Test Failures
- Check the server logs for any errors
- Verify the API endpoints are working manually
- Check that all dependencies are installed

### Permission Issues
If you get permission errors:
```bash
chmod +x tests/api-endpoints.test.js
```

## Continuous Integration

This test suite is designed to be run in CI/CD pipelines. It exits with:
- `0` if all tests pass
- `1` if any tests fail

Perfect for automated testing! 🚀
