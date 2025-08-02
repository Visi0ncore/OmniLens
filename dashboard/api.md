# Dashboard API Documentation

## Environment Variables Required

**Backend (.env.local):**
- `GITHUB_TOKEN` - GitHub Personal Access Token with `actions:read` permission
- `GITHUB_REPO` - Repository in format `owner/repo` (e.g., `microsoft/vscode`)

## Frontend to Backend APIs

### 1. Get Workflow Data
**Endpoint:** 
```
GET /api/workflows
```

**Required Values:**
- `date` (query parameter) - Date in YYYY-MM-DD format

```
GET /api/workflows?date=2025-08-01
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
      "isMissing": false
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
- `400` - Missing or invalid date parameter
- `500` - Server error (GitHub API failure, missing env vars, etc.)

**Example Request:**
```http
GET /api/workflows?date=2025-08-01
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

### Backend Errors
- **GitHub API rate limits** - Returns 500 with descriptive error
- **Invalid GitHub token** - Returns 500 with auth error
- **Missing environment variables** - Returns 500 with configuration error
- **Date parsing errors** - Returns 400 with validation error

## Pagination

The GitHub API automatically handles pagination:
- **Per page limit:** 100 results maximum
- **Page tracking:** Automatically fetches all pages until no more results
- **Logging:** Reports total pages fetched for debugging
- **Safety limit:** Maximum 10 pages to prevent infinite loops
