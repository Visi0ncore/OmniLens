# Simple OpenAPI Migration Guide - Dashboard API

This document outlines a **simple, practical approach** to make your existing OmniLens Dashboard API OpenAPI 3.0 compliant by adding Zod validation to your existing endpoints.

## Current Dashboard API Structure Analysis

### Dashboard API Endpoints (`/dashboard/app/api/`)
- **GET** `/api/repositories` - List available repositories
- **GET** `/api/repositories/metrics` - Repository metrics overview
- **GET** `/api/repositories/workflows` - Available workflows in repository
- **GET** `/api/repositories/workflow-runs` - Raw workflow runs data
- **GET** `/api/repositories/trigger-map` - Workflow trigger mappings
- **POST** `/api/repositories/validate` - Validate repository access
- **GET** `/api/workflows` - Workflow runs for specific date
- **GET** `/api/workflows/range` - Workflow runs for date range

## Simple Approach: Add Zod to Existing Endpoints

### Step 1: Install Zod
```bash
cd dashboard
bun add zod
```

### Step 2: Add Validation to Your Existing Endpoint
Instead of rebuilding everything, just add Zod validation to your existing code:

```typescript
// Before (your existing code)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const repoUrl = body?.repoUrl;
  
  if (!repoUrl) {
    return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 });
  }
  // ... rest of your logic
}

// After (add Zod validation)
import { z } from 'zod';

const validateRepoSchema = z.object({
  repoUrl: z.string().min(1, 'Repository URL is required')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Add Zod validation here
    const { repoUrl } = validateRepoSchema.parse(body);
    
    // ... rest of your existing logic stays the same
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: error.errors 
      }, { status: 400 });
    }
    // ... handle other errors
  }
}
```

**That's it!** No complex abstractions, no new files, just add validation where you need it.

## Simple Migration Strategy

### What We're NOT Doing
❌ **Complex abstractions** - No separate schema files, validation helpers, or error factories  
❌ **Rebuilding everything** - Your existing code works fine  
❌ **Over-engineering** - No middleware layers or complex type systems  

### What We ARE Doing
✅ **Add Zod validation** to existing endpoints  
✅ **Keep your current error handling** - just add validation errors  
✅ **Minimal changes** - validate inputs, keep outputs the same  
✅ **Optional OpenAPI docs** - add if you want them  

## Step-by-Step Migration

### Step 1: Choose Your First Endpoint
Start with the simplest one: `/api/repositories/validate` (POST)

### Step 2: Add Zod Schema
Add this at the top of your existing route file:

```typescript
import { z } from 'zod';

const validateRepoSchema = z.object({
  repoUrl: z.string().min(1, 'Repository URL is required')
});
```

### Step 3: Add Validation
Wrap your existing request parsing:

```typescript
// Before
const body = await request.json();
const repoUrl = body?.repoUrl;

// After  
const body = await request.json();
const { repoUrl } = validateRepoSchema.parse(body);
```

### Step 4: Add Error Handling
Add this around your existing logic:

```typescript
try {
  // Your existing code here
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ 
      error: 'Invalid request', 
      details: error.errors 
    }, { status: 400 });
  }
  // Your existing error handling
}
```

**That's it!** Your endpoint is now OpenAPI compatible.

## Optional: OpenAPI Documentation

### Step 5: Add OpenAPI Comments (Optional)
If you want machine-readable API docs, add JSDoc comments:

```typescript
/**
 * @openapi
 * /repositories/validate:
 *   post:
 *     summary: Validate a GitHub repository
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               repoUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Repository is valid
 *       400:
 *         description: Invalid request
 */
export async function POST(request: NextRequest) {
  // Your validated code here
}
```

### Step 6: Generate OpenAPI Spec (Optional)
Create a simple `openapi.yaml` file:

```yaml
openapi: 3.0.3
info:
  title: OmniLens Dashboard API
  version: 1.0.0
paths:
  /repositories/validate:
    post:
      summary: Validate a GitHub repository
      # ... rest of your endpoint docs
```

**This is completely optional!** Your API works fine without it.

## Simple Implementation Plan

### Phase 1: Add Validation (30 minutes)
1. ✅ Install Zod: `bun add zod`
2. ✅ Add validation to `/api/repositories/validate`
3. ✅ Test the endpoint works

### Phase 2: Repeat for Other Endpoints (1-2 hours)
1. ✅ Add validation to `/api/repositories` (GET)
2. 🔄 Add validation to `/api/workflows` (GET with query params)
3. 🔄 Add validation to `/api/repositories/workflow-runs` (GET with query params)
4. 🔄 Add validation to remaining endpoints

### Phase 3: Optional Documentation (30 minutes)
1. 🔄 Add OpenAPI comments if desired
2. 🔄 Create simple OpenAPI spec file

**Total time: 2-3 hours** (not weeks!)

## Dependencies

### Required
```bash
bun add zod
```

### Optional (for documentation)
```bash
bun add swagger-ui-react
bun add -d @types/swagger-ui-react
```

## Why This Simple Approach Works

### Benefits
✅ **Minimal changes** - Your existing code stays mostly the same  
✅ **Type safety** - Zod provides excellent TypeScript integration  
✅ **Better error messages** - Clear validation errors for API consumers  
✅ **OpenAPI compatible** - Validated schemas can generate OpenAPI specs  
✅ **Fast** - Zod is very performant with Bun  

### No Complex Abstractions
❌ **No separate schema files** - Keep schemas close to where they're used  
❌ **No validation helpers** - Zod's built-in methods are sufficient  
❌ **No error factories** - Use your existing error handling  
❌ **No middleware layers** - Keep it simple and direct

## Real Examples for Your Endpoints

### Example 1: Repository Validation (POST)
```typescript
// Before
export async function POST(request: NextRequest) {
  const body = await request.json();
  const repoUrl = body?.repoUrl;
  
  if (!repoUrl) {
    return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 });
  }
  // ... rest of logic
}

// After
import { z } from 'zod';

const validateRepoSchema = z.object({
  repoUrl: z.string().min(1, 'Repository URL is required')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoUrl } = validateRepoSchema.parse(body);
    
    // ... rest of your existing logic stays the same
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: error.errors 
      }, { status: 400 });
    }
    // ... your existing error handling
  }
}
```

### Example 2: Workflows with Query Params (GET)
```typescript
// Before
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const repo = searchParams.get('repo');
  
  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }
  // ... rest of logic
}

// After
const workflowsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  repo: z.string().optional(),
  repoPath: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryData = {
      date: searchParams.get('date'),
      repo: searchParams.get('repo'),
      repoPath: searchParams.get('repoPath')
    };
    
    const { date, repo, repoPath } = workflowsQuerySchema.parse(queryData);
    
    // ... rest of your existing logic stays the same
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid query parameters', 
        details: error.errors 
      }, { status: 400 });
    }
    // ... your existing error handling
  }
}
```

**Key point**: Your existing logic stays exactly the same - we just add validation at the beginning!

## Testing Your Changes

### Manual Testing
1. **Test valid requests** - Make sure your endpoint still works
2. **Test invalid requests** - Verify you get proper validation errors
3. **Test edge cases** - Empty strings, wrong types, etc.

### Example Test Commands
```bash
# Test valid request
curl -X POST http://localhost:3000/api/repositories/validate \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/microsoft/vscode"}'

# Test invalid request
curl -X POST http://localhost:3000/api/repositories/validate \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": ""}'
```

**That's it!** No complex testing setup needed.

## Benefits You'll Get

✅ **Better error messages** - Clear validation errors for API consumers  
✅ **Type safety** - Catch validation errors at compile time  
✅ **Consistent validation** - Same validation logic across all endpoints  
✅ **OpenAPI ready** - Your schemas can generate OpenAPI documentation  
✅ **Future-proof** - Easy to add more validation rules later  

**No complex abstractions, no breaking changes, just better validation!**

## Simple Checklist

- [x] Install Zod: `bun add zod`
- [x] Add validation to `/api/repositories/validate`
- [x] Test the endpoint works
- [x] Add validation to `/api/repositories` (GET)
- [ ] Add validation to other endpoints (optional)
- [x] Add OpenAPI documentation (optional)

**That's it!** No complex setup, no weeks of work.

## Database Integration ✅

### PostgreSQL Setup
We've successfully migrated from in-memory storage to PostgreSQL:

- [x] **Installed PostgreSQL client**: `bun add pg @types/pg`
- [x] **Created database**: `createdb omnilens`
- [x] **Created schema**: `lib/schema.sql` with repositories table
- [x] **Database connection**: `lib/db.ts` with connection pool
- [x] **Database storage**: `lib/db-storage.ts` with async functions
- [x] **Updated API endpoints**: All endpoints now use database
- [x] **Tested persistence**: Data persists across server restarts

### API-Level Validation ✅

We've implemented API-level validation to ensure data integrity:

- [x] **Enhanced `POST /api/repo/add`**: Now validates repository existence before adding
- [x] **GitHub API integration**: Checks if repository exists and is accessible
- [x] **Proper error handling**: Returns 404 for non-existent repos, 403 for access denied
- [x] **Updated test cases**: All tests now reflect the new validation behavior
- [x] **Updated OpenAPI spec**: Added new response codes (403, 404) for add endpoint
- [x] **Data integrity**: No more invalid repositories in the dashboard

### Database Schema
```sql
CREATE TABLE repositories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  repo_path VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  html_url TEXT NOT NULL,
  default_branch VARCHAR(100) NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Benefits Achieved
✅ **Persistence**: Data survives server restarts  
✅ **Scalability**: Can handle multiple users  
✅ **Reliability**: ACID compliance  
✅ **Performance**: Indexed queries  
✅ **Type Safety**: Full TypeScript support  

## Next Steps

1. **Test the dashboard UI** with the new database backend
2. **Add validation to remaining endpoints** if needed
3. **Consider adding user authentication** for multi-user support
4. **Add database migrations** for future schema changes

### Quick Start
```bash
# Database is already set up and working
cd dashboard
bun run dev

# Test the API endpoints
bun run test:api
```

**Goal**: Robust, persistent storage for your dashboard repositories. Mission accomplished! 🎉
