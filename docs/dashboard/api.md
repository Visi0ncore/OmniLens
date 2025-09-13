# OmniLens Dashboard API Documentation

## Overview

The OmniLens Dashboard provides a REST API for managing GitHub repository workflows and their execution data. The system uses a database-driven approach with intelligent caching and GitHub API integration.

## Authentication

**Required Environment Variable:**
- `GITHUB_TOKEN` - GitHub Personal Access Token with the following permissions:
  - `actions:read` - Read access to GitHub Actions
  - `repo:read` - Read access to repository metadata
  - `workflows:read` - Read access to workflow definitions

## Database Integration

The dashboard uses a PostgreSQL database for:
- **Repository Management**: User-added repositories are stored in the database
- **Workflow Persistence**: Workflow definitions are cached with automatic validation
- **Performance**: Reduces GitHub API calls through intelligent caching

---

## Repository Management Endpoints

### 1. List Repositories

Get all user-added repositories from the database.

**Endpoint:** 
```http
GET /api/repo
```

**Response:**
```json
{
  "repositories": [
    {
      "slug": "omnilens-chris-repo-1",
      "displayName": "Chris/OmniLens",
      "avatarUrl": "https://avatars.githubusercontent.com/u/12345?v=4",
      "htmlUrl": "https://github.com/chris/omnilens"
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `500` - Database error

---

### 2. Add Repository

Add a new repository to the dashboard.

**Endpoint:**
```http
POST /api/repo/add
```

**Request Body:**
```json
{
  "repoPath": "owner/repository-name"
}
```

**Response:**
```json
{
  "success": true,
  "repository": {
    "slug": "omnilens-owner-repository-name",
    "repoPath": "owner/repository-name",
    "displayName": "Owner/Repository Name",
    "htmlUrl": "https://github.com/owner/repository-name",
    "defaultBranch": "main",
    "avatarUrl": "https://avatars.githubusercontent.com/u/12345?v=4"
  }
}
```

**Status Codes:**
- `201` - Repository added successfully
- `400` - Invalid repository path or validation failed
- `409` - Repository already exists
- `500` - Server error

---

### 3. Validate Repository

Validate a repository path before adding it.

**Endpoint:**
```http
POST /api/repo/validate
```

**Request Body:**
```json
{
  "repoInput": "owner/repository-name"
}
```

**Response:**
```json
{
  "isValid": true,
  "repoPath": "owner/repository-name",
  "displayName": "Owner/Repository Name",
  "htmlUrl": "https://github.com/owner/repository-name",
  "defaultBranch": "main",
  "avatarUrl": "https://avatars.githubusercontent.com/u/12345?v=4"
}
```

**Status Codes:**
- `200` - Validation successful
- `400` - Invalid repository format
- `404` - Repository not found or not accessible
- `500` - Server error

---

### 4. Get Repository Details

Get details for a specific repository.

**Endpoint:**
```http
GET /api/repo/{slug}
```

**Parameters:**
- `slug` - Repository slug (URL-safe identifier)

**Response:**
```json
{
  "repository": {
    "slug": "omnilens-owner-repo",
    "repoPath": "owner/repo",
    "displayName": "Owner/Repo",
    "htmlUrl": "https://github.com/owner/repo",
    "defaultBranch": "main",
    "avatarUrl": "https://avatars.githubusercontent.com/u/12345?v=4",
    "addedAt": "2024-09-13T10:30:00Z"
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Repository not found
- `500` - Server error

---

### 5. Delete Repository

Remove a repository from the dashboard.

**Endpoint:** 
```http
DELETE /api/repo/{slug}
```

**Parameters:**
- `slug` - Repository slug

**Response:**
```json
{
  "success": true,
  "message": "Repository removed successfully"
}
```

**Status Codes:**
- `200` - Repository deleted successfully
- `404` - Repository not found
- `500` - Server error

---

## Workflow Management Endpoints

### 1. Get Workflows / Workflow Runs

Main endpoint that returns either workflow definitions or workflow run data based on parameters.

**Endpoint:**
```http
GET /api/workflow/{slug}
GET /api/workflow/{slug}?date=YYYY-MM-DD
GET /api/workflow/{slug}?date=YYYY-MM-DD&grouped=true
```

**Parameters:**
- `slug` (path) - Repository slug
- `date` (query, optional) - Date in YYYY-MM-DD format
- `grouped` (query, optional) - Return grouped workflow runs (latest per workflow)

#### Without Date Parameter (Workflow Definitions)

**Response:**
```json
{
  "repository": {
    "slug": "omnilens-owner-repo",
    "displayName": "Owner/Repo",
    "repoPath": "owner/repo"
  },
  "workflows": [
    {
      "id": 12345,
      "name": "🧪 CI Tests",
      "path": ".github/workflows/ci.yml",
      "state": "active",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-09-13T14:20:00Z"
    }
  ],
  "totalCount": 5,
  "cached": false,
  "cacheUpdated": true
}
```

#### With Date Parameter (Workflow Runs)

**Response:**
```json
{
  "repository": {
    "slug": "omnilens-owner-repo",
    "displayName": "Owner/Repo",
    "repoPath": "owner/repo"
  },
  "workflowRuns": [
    {
      "id": 987654321,
      "name": "🧪 CI Tests",
      "workflow_id": 12345,
      "path": ".github/workflows/ci.yml",
      "conclusion": "success",
      "status": "completed",
      "html_url": "https://github.com/owner/repo/actions/runs/987654321",
      "run_started_at": "2024-09-13T10:00:00Z",
      "updated_at": "2024-09-13T10:05:00Z",
      "run_count": 3,
      "all_runs": [
        {
          "id": 987654321,
          "conclusion": "success",
          "status": "completed",
          "html_url": "https://github.com/owner/repo/actions/runs/987654321",
          "run_started_at": "2024-09-13T10:00:00Z"
        }
      ]
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid date format or parameters
- `404` - Repository not found
- `500` - Server error

**Cache Behavior:**
- Always fetches fresh data from GitHub API
- Compares with database cache to detect changes
- Updates cache only when differences are found
- Returns cache status indicators

---

### 2. Get Workflow Overview

Get daily metrics and overview data for a repository.

**Endpoint:**
```http
GET /api/workflow/{slug}/overview?date=YYYY-MM-DD
```

**Parameters:**
- `slug` (path) - Repository slug
- `date` (query, optional) - Date in YYYY-MM-DD format (defaults to today)

**Response:**
```json
{
  "repository": {
    "slug": "omnilens-owner-repo",
    "displayName": "Owner/Repo",
    "repoPath": "owner/repo"
  },
  "overview": {
    "completedRuns": 15,
    "inProgressRuns": 2,
    "passedRuns": 12,
    "failedRuns": 3,
    "totalRuntime": "2h 30m 45s",
    "didntRunCount": 1,
    "totalWorkflows": 5,
    "successRate": 80,
    "passRate": 80,
    "avgRunsPerHour": 2.5,
    "minRunsPerHour": 0,
    "maxRunsPerHour": 8,
    "runsByHour": [
      {
        "hour": 9,
        "passed": 2,
        "failed": 0,
        "total": 2
      }
    ]
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid date format
- `404` - Repository not found
- `500` - Server error

---

### 3. Check Workflow Existence

Check if workflows exist in the database cache without triggering GitHub API calls.

**Endpoint:**
```http
GET /api/workflow/{slug}/exists
```

**Parameters:**
- `slug` (path) - Repository slug

**Response:**
```json
{
  "hasWorkflows": true,
  "workflowCount": 5,
  "message": "Found 5 saved workflows for omnilens-owner-repo"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid repository slug
- `500` - Server error

---

### 4. Get Latest Workflow Runs

Get the latest run for each workflow (prioritizes running/queued over completed runs).

**Endpoint:**
```http
GET /api/workflow/{slug}/latest-runs
```

**Parameters:**
- `slug` (path) - Repository slug

**Response:**
```json
{
  "repository": {
    "slug": "omnilens-owner-repo",
    "displayName": "Owner/Repo",
    "repoPath": "owner/repo"
  },
  "latestRuns": [
    {
      "id": 987654321,
      "name": "🧪 CI Tests",
      "workflow_id": 12345,
      "path": ".github/workflows/ci.yml",
      "conclusion": "success",
      "status": "completed",
      "html_url": "https://github.com/owner/repo/actions/runs/987654321",
      "run_started_at": "2024-09-13T10:00:00Z",
      "updated_at": "2024-09-13T10:05:00Z"
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `404` - Repository not found
- `500` - Server error

---

### 5. Get Health Metrics

Get workflow health status based on yesterday vs today comparison.

**Endpoint:**
```http
GET /api/workflow/{slug}/health-metrics?date=YYYY-MM-DD
```

**Parameters:**
- `slug` (path) - Repository slug
- `date` (query, optional) - Date in YYYY-MM-DD format (defaults to today)

**Response:**
```json
{
  "repository": {
    "slug": "omnilens-owner-repo",
    "displayName": "Owner/Repo",
    "repoPath": "owner/repo"
  },
  "healthMetrics": [
    {
      "workflowId": 12345,
      "workflowName": "🧪 CI Tests",
      "status": "consistent",
      "totalRuns": 3,
      "successfulRuns": 3,
      "failedRuns": 0
    }
  ]
}
```

**Health Status Values:**
- `consistent` - Performing the same as yesterday
- `improved` - Better performance than yesterday
- `regressed` - Worse performance than yesterday
- `still_failing` - Continued failures from yesterday
- `no_runs_today` - No runs on the selected date

**Status Codes:**
- `200` - Success
- `400` - Invalid date format
- `404` - Repository not found
- `500` - Server error

---

## Response Format Standards

### Success Responses

All successful responses follow consistent patterns:

**Single Resource:**
```json
{
  "repository": { /* repository details */ },
  "data": { /* resource data */ }
}
```

**Multiple Resources:**
```json
{
  "repository": { /* repository details */ },
  "resources": [ /* array of resources */ ],
  "totalCount": 5
}
```

**Cache Indicators (when applicable):**
```json
{
  "cached": false,        // true if serving from cache
  "cacheUpdated": true    // true if cache was refreshed
}
```

### Error Responses

**Validation Errors (400):**
```json
{
  "error": "Invalid date format. Use YYYY-MM-DD format.",
  "details": ["date: String must contain exactly 10 character(s)"]
}
```

**Not Found Errors (404):**
```json
{
  "error": "Repository not found in dashboard"
}
```

**Server Errors (500):**
```json
{
  "error": "GitHub integration not configured"
}
```

---

## GitHub API Integration

### Rate Limiting

The dashboard implements intelligent rate limiting:
- **Cache-first approach**: Checks database before GitHub API calls
- **Batch operations**: Groups related API calls together
- **Error handling**: Graceful degradation on rate limit hits

### Branch Filtering

All workflow data is filtered to the repository's default branch:
- Workflow definitions must have runs on the default branch
- Workflow runs are filtered by default branch
- Historical data respects branch-based filtering

### Pagination

GitHub API responses are automatically paginated:
- **Page size**: 100 results per page (GitHub maximum)
- **Auto-pagination**: Continues until all results are fetched
- **Safety limits**: Maximum 10 pages to prevent infinite loops

---

## Database Schema

### Repositories Table

```sql
CREATE TABLE repositories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  repo_path VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  html_url TEXT NOT NULL,
  default_branch VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Workflows Table

```sql
CREATE TABLE workflows (
  id SERIAL PRIMARY KEY,
  repo_slug VARCHAR(255) NOT NULL,
  workflow_id INTEGER NOT NULL,
  workflow_name VARCHAR(255) NOT NULL,
  workflow_path VARCHAR(500) NOT NULL,
  workflow_state VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repo_slug, workflow_id)
);
```

---

## Environment Setup

### Required Environment Variables

```env
# GitHub Integration
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Database Connection
DATABASE_URL=postgresql://username:password@host:port/database

# Next.js Configuration
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

### GitHub Token Permissions

The GitHub token requires these scopes:
- `actions:read` - Read workflow runs and artifacts
- `repo` - Access repository data (for private repos)
- `workflow` - Read workflow definitions

### Database Setup

1. **Install PostgreSQL** (version 12+)
2. **Run schema migration**:
   ```bash
   psql -d your_database -f lib/schema.sql
   ```
3. **Verify tables** are created correctly

---

## Error Handling

### Client-Side Error Handling

**Network Errors:**
- Display error state components
- Provide retry mechanisms
- Graceful fallback to cached data

**API Errors:**
- Parse error response messages
- Show user-friendly error notifications
- Log detailed errors for debugging

### Server-Side Error Handling

**GitHub API Errors:**
- Rate limit detection and backoff
- Token validation and refresh
- Repository access verification

**Database Errors:**
- Connection pool management
- Transaction rollback on failures
- Data consistency checks

**Validation Errors:**
- Zod schema validation for all inputs
- Comprehensive error messages
- Input sanitization and security

---

## Security Considerations

### Authentication

- GitHub token stored securely in environment variables
- No tokens exposed to client-side code
- Token permissions follow principle of least privilege

### Input Validation

- All inputs validated with Zod schemas
- SQL injection prevention through parameterized queries
- XSS prevention through proper data sanitization

### Rate Limiting

- Intelligent caching reduces API call frequency
- Graceful degradation on rate limit hits
- Monitoring and alerting for unusual usage patterns

---

## Development and Testing

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### API Testing

The API includes comprehensive error handling and logging:
- Request/response logging in development
- Error tracking with stack traces
- Performance monitoring for slow endpoints

### Health Checks

Monitor API health through:
- Database connection status
- GitHub API connectivity
- Cache performance metrics
- Error rate monitoring

---

This documentation reflects the current state of the OmniLens Dashboard API as of September 2024. For the most up-to-date information, refer to the OpenAPI specifications in the codebase.