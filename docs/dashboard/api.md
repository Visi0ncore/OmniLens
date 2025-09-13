# Dashboard API Documentation

## Environment Variables Required

**Backend (.env.local):**
- `GITHUB_TOKEN` - GitHub Personal Access Token with `actions:read` permission
- `GITHUB_REPO_1` - Primary repository in format `owner/repo` (e.g., `microsoft/vscode`)
- `GITHUB_REPO_2` - Secondary repository in format `owner/repo` (optional)
- `GITHUB_REPO_3` - Tertiary repository in format `owner/repo` (optional)

## Frontend to Backend APIs

### 1. Get Available Repositories
**Endpoint:** 
```
GET /api/repositories
```

**Required Values:**
- None

**Request Body:**
- None (GET request)

**Response Body:**
```json
{
  "repositories": [
    {
      "slug": "repo1",
      "repoPath": "owner/repo",
      "envKey": "GITHUB_REPO_1",
      "displayName": "Owner/Repo",
      "hasConfig": true
    }
  ]
}
```

**Note:** The `displayName` field contains the repository name extracted from the corresponding environment variable (e.g., `GITHUB_REPO_1` value).

**Expected Result Code:** 
- `200` - Success
- `500` - Server error (missing env vars, config issues, etc.)

**Example Request:**
```http
GET /api/repositories
```

### 2. Get Repositories with Metrics
**Endpoint:** 
```
GET /api/repositories/metrics
```

**Required Values:**
- None

**Request Body:**
- None (GET request)

**Response Body:**
```json
{
  "repositories": [
    {
      "slug": "repo1",
      "repoPath": "owner/repo",
      "envKey": "GITHUB_REPO_1",
      "displayName": "Owner/Repo",
      "hasConfig": true,
      "hasWorkflows": true,
      "metrics": {
        "totalWorkflows": 5,
        "passedRuns": 3,
        "failedRuns": 1,
        "inProgressRuns": 1,
        "successRate": 75,
        "hasActivity": true
      }
    }
  ]
}
```

**Note:** 
- The `displayName` field contains the repository name extracted from the corresponding environment variable
- The `metrics` field contains today's workflow summary data for the home page display
- `metrics` will be `null` if the repository has no workflows configured or if there was an error fetching data
- `successRate` is calculated as `(passedRuns / (passedRuns + failedRuns)) * 100`, rounded to nearest integer
- `hasActivity` indicates if there were any completed runs or runs in progress today

**Expected Result Code:** 
- `200` - Success (individual repository errors don't fail the entire request)
- `500` - Server error (missing env vars, config issues, etc.)

**Example Request:**
```http
GET /api/repositories/metrics
```

### 3. Get Workflow Data
**Endpoint:** 
```
GET /api/workflows
```

**Required Values:**
- `date` (query parameter) - Date in YYYY-MM-DD format
- `repo` (query parameter) - Repository slug (e.g., `repo1`, `repo2`, `repo3`)

```
GET /api/workflows?date=2025-08-01&repo=repo1
```

**Request Body:**
- None (GET request)

**Response Body:**
```json
{
  "workflowRuns": [
    {
      "id": 16665280399,
      "name": "🧪 Single Workflow",
      "workflow_id": 123456,
      "workflow_name": "Single Workflow",
      "path": ".github/workflows/single-workflow.yml",
      "conclusion": "success" | "failure" | null,
      "status": "completed" | "in_progress" | "queued",
      "html_url": "https://github.com/owner/repo/actions/runs/16665280399",
      "run_started_at": "2025-08-01T05:10:39Z",
      "updated_at": "2025-08-01T05:12:15Z",
      "run_count": 1,
      "all_runs": [
        {
          "id": 16665280399,
          "conclusion": "success",
          "status": "completed",
          "html_url": "https://github.com/owner/repo/actions/runs/16665280399",
          "run_started_at": "2025-08-01T05:10:39Z"
        }
      ],
    }
  ],
  "overviewData": {
    "completedRuns": 2,
    "inProgressRuns": 0,
    "passedRuns": 1,
    "failedRuns": 1,
    "totalRuntime": 156,
    "didntRunCount": 1,
    "totalWorkflows": 2,
    "missingWorkflows": ["build-workflow.yml"]
  }
}
```

**Expected Result Code:** 
- `200` - Success
- `400` - Missing or invalid date/repo parameter
- `500` - Server error (GitHub API failure, missing env vars, etc.)

**Example Request:**
```http
GET /api/workflows?date=2025-08-01&repo=repo1
```

## Backend to External APIs

### 1. GitHub Actions API - List Workflow Runs
**Endpoint:** 
```
GET https://api.github.com/repos/{owner}/{repo}/actions/runs
```

**Required Values:**
- `{owner}` - GitHub repository owner/organization (e.g., "microsoft")
- `{repo}` - GitHub repository name (e.g., "vscode")
- `created` (query parameter) - Date range filter in ISO format
- `per_page` (query parameter) - Results per page (max 100)
- `page` (query parameter) - Page number (starts at 1)

**Note:** The `{owner}` and `{repo}` values are extracted from the corresponding `GITHUB_REPO_X` environment variable for the requested repository slug.

```
GET https://api.github.com/repos/owner/repo/actions/runs?created=2025-08-01T00:00:00Z..2025-08-01T23:59:59Z&per_page=100&page=1
```

**Required Headers:**
- `Accept: application/vnd.github+json`
- `Authorization: Bearer {GITHUB_TOKEN}`
- `X-GitHub-Api-Version: 2022-11-28`

**Request Body:**
- None (GET request)

**Response Body:**
```json
{
  "total_count": 234,
  "workflow_runs": [
    {
      "id": 16665280399,
      "name": "🧪 Single Workflow",
      "workflow_id": 123456,
      "path": ".github/workflows/single-workflow.yml",
      "conclusion": "success",
      "status": "completed",
      "html_url": "https://github.com/owner/repo/actions/runs/16665280399",
      "run_started_at": "2025-08-01T05:10:39Z",
      "updated_at": "2025-08-01T05:12:15Z",
      "head_branch": "main",
      "head_sha": "abc123def456"
    }
  ]
}
```

**Expected Result Code:**
- `200` - Success
- `401` - Invalid or missing GitHub token
- `403` - Rate limit exceeded or insufficient permissions
- `404` - Repository not found
- `422` - Invalid parameters

**Example Request:**
```http
GET https://api.github.com/repos/owner/repo/actions/runs?created=2025-08-01T00:00:00Z..2025-08-01T23:59:59Z&per_page=100&page=1
Authorization: Bearer ghp_xxxxxxxxxxxx
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
```

## Error Handling

### Frontend Errors
- **Network errors** - Displays error state component
- **400/500 responses** - Shows error message to user
- **Missing data** - Falls back to skeleton loading state
- **No repositories found** - Displays "No repositories found" message with configuration instructions

### Backend Errors
- **GitHub API rate limits** - Returns 500 with descriptive error
- **Invalid GitHub token** - Returns 500 with auth error
- **Missing environment variables** - Returns 500 with configuration error
- **Date parsing errors** - Returns 400 with validation error
- **Invalid repository slug** - Returns 400 with validation error
- **Repository not found in config** - Returns 400 with configuration error

## Pagination

The GitHub API automatically handles pagination:
- **Per page limit:** 100 results maximum
- **Page tracking:** Automatically fetches all pages until no more results
- **Logging:** Reports total pages fetched for debugging
- **Safety limit:** Maximum 10 pages to prevent infinite loops

## Multi-Repository Support

The dashboard now supports up to 3 repositories:

### Repository Configuration
- **Environment Variables:** `GITHUB_REPO_1`, `GITHUB_REPO_2`, `GITHUB_REPO_3` (source of truth for repository names)
- **Repository Slugs:** `repo1`, `repo2`, `repo3` (used in API calls and URLs)
- **Configuration:** Each repository has its own categories and trigger mappings in `workflows.json`
- **Repository Names:** Extracted from environment variables, not stored in JSON config

### URL Structure
- **Home Page:** `/` - Repository selection page
- **Repository Dashboard:** `/dashboard/[slug]` - Where `[slug]` is `repo1`, `repo2`, or `repo3`

### Data Isolation
- **Local Storage:** Repository-specific keys (e.g., `reviewedWorkflows-repo1-2025-01-15`)
- **API Calls:** All workflow data is scoped to the specific repository
- **Configuration:** Each repository maintains its own workflow categories and mappings
- **Repository Names:** Single source of truth from environment variables, eliminating data duplication
