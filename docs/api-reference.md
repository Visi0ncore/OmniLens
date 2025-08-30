# OmniLens API Reference Documentation

## Overview

This document provides a comprehensive reference for all API calls used throughout the OmniLens application. It covers both internal Next.js API routes and external GitHub API integrations, including their context, parameters, responses, and usage patterns.

## Table of Contents

1. [Internal API Routes](#internal-api-routes)
2. [GitHub API Integration](#github-api-integration)
3. [API Call Contexts](#api-call-contexts)
4. [Error Handling](#error-handling)
5. [Caching Strategies](#caching-strategies)
6. [Rate Limiting](#rate-limiting)
7. [Authentication](#authentication)

## Internal API Routes

### 1. Repository Validation API

**Endpoint**: `POST /api/repositories/validate`

**Context**: Used when adding a new repository to validate its existence and accessibility.

**Request**:
```typescript
{
  repoUrl: string; // GitHub URL or owner/repo format
}
```

**Response**:
```typescript
{
  valid: boolean;
  repoPath: string;      // owner/repo format
  displayName: string;   // Formatted repository name
  htmlUrl: string;       // Full GitHub URL
  defaultBranch: string; // Default branch name
}
```

**Error Responses**:
```typescript
// 400 - Invalid input
{
  error: 'Invalid GitHub repository URL or format. Use owner/repo or a full GitHub URL.'
}

// 404 - Repository not found
{
  valid: false,
  error: 'Repository not found'
}

// 403 - Access denied
{
  valid: false,
  error: 'Repository access denied. Check token permissions.'
}

// 500 - Server error
{
  error: 'Failed to validate repository'
}
```

**Usage Example**:
```typescript
const validateRepository = async (repoUrl: string) => {
  const response = await fetch('/api/repositories/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl })
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Validation failed');
  }
  
  return data;
};
```

### 2. Workflow Data API

**Endpoint**: `GET /api/workflows`

**Context**: Primary data source for dashboard, fetches workflow runs for a specific date and repository.

**Query Parameters**:
```typescript
{
  date: string;        // YYYY-MM-DD format
  repo?: string;       // Repository slug (for env-configured repos)
  repoPath?: string;   // owner/repo format (for user-added repos)
}
```

**Response**:
```typescript
{
  workflowRuns: Array<{
    id: number;
    name: string;
    workflow_id: number;
    path?: string;
    conclusion: string | null;
    status: string;
    html_url: string;
    run_started_at: string;
    updated_at: string;
    run_count?: number;
    all_runs?: Array<{
      id: number;
      conclusion: string | null;
      status: string;
      html_url: string;
      run_started_at: string;
    }>;
  }>;
  overviewData: {
    completedRuns: number;
    inProgressRuns: number;
    passedRuns: number;
    failedRuns: number;
    totalRuntime: number;
    didntRunCount: number;
    totalWorkflows: number;
    missingWorkflows: string[];
  };
}
```

**Error Responses**:
```typescript
// 400 - Missing parameters
{
  error: 'Date parameter is required'
}

// 400 - Invalid repository
{
  error: 'Invalid repo slug or repo not configured'
}

// 403 - Access denied
{
  error: 'Repository access denied. Please check your GitHub token permissions.'
}

// 500 - Server error
{
  error: 'Failed to fetch workflow data'
}
```

**Usage Example**:
```typescript
const fetchWorkflowData = async (date: Date, repoSlug: string, repoPath?: string) => {
  const dateStr = format(date, "yyyy-MM-dd");
  const url = repoPath
    ? `/api/workflows?date=${dateStr}&repoPath=${encodeURIComponent(repoPath)}`
    : `/api/workflows?date=${dateStr}&repo=${encodeURIComponent(repoSlug)}`;
    
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch workflow data');
  }
  
  return response.json();
};
```

### 3. Repository List API

**Endpoint**: `GET /api/repositories`

**Context**: Fetches list of available repositories for the home page.

**Response**:
```typescript
{
  repositories: Array<{
    slug: string;
    repoPath: string;
    envKey: string;
    displayName: string;
    hasConfig: boolean;
    hasWorkflows?: boolean;
    metrics?: {
      totalWorkflows: number;
      passedRuns: number;
      failedRuns: number;
      inProgressRuns: number;
      successRate: number;
      hasActivity: boolean;
    };
  }>;
}
```

**Usage Example**:
```typescript
const fetchRepositories = async () => {
  const response = await fetch('/api/repositories');
  if (!response.ok) {
    throw new Error('Failed to fetch repositories');
  }
  return response.json();
};
```

### 4. Workflow Runs API

**Endpoint**: `GET /api/repositories/workflow-runs`

**Context**: Fetches raw workflow runs data for a specific repository and date.

**Query Parameters**:
```typescript
{
  repoPath: string;  // owner/repo format
  date: string;      // YYYY-MM-DD format
}
```

**Response**:
```typescript
{
  workflow_runs: Array<{
    id: number;
    name: string;
    workflow_id: number;
    path?: string;
    conclusion: string | null;
    status: string;
    html_url: string;
    run_started_at: string;
    updated_at: string;
  }>;
}
```

**Usage Example**:
```typescript
const fetchWorkflowRuns = async (repoPath: string, date: string) => {
  const response = await fetch(
    `/api/repositories/workflow-runs?repoPath=${encodeURIComponent(repoPath)}&date=${encodeURIComponent(date)}`,
    { cache: 'no-store' }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch workflow runs');
  }
  
  return response.json();
};
```

### 5. Available Workflows API

**Endpoint**: `GET /api/repositories/workflows`

**Context**: Fetches list of available workflow files in a repository for configuration.

**Query Parameters**:
```typescript
{
  repoPath: string;  // owner/repo format
}
```

**Response**:
```typescript
{
  workflows: Array<{
    id: number;
    name: string;
    path: string;
    state: string;
    html_url: string;
  }>;
}
```

**Usage Example**:
```typescript
const fetchAvailableWorkflows = async (repoPath: string) => {
  const response = await fetch(`/api/repositories/workflows?repoPath=${encodeURIComponent(repoPath)}`);
  const json = await response.json();
  
  if (!response.ok) {
    throw new Error(json?.error || 'Failed to fetch workflows');
  }
  
  return json.workflows || [];
};
```

### 6. Trigger Map API

**Endpoint**: `GET /api/repositories/trigger-map`

**Context**: Fetches trigger-testing workflow mappings for a repository.

**Query Parameters**:
```typescript
{
  repo?: string;     // Repository slug (for env-configured repos)
  repoPath?: string; // owner/repo format (for user-added repos)
}
```

**Response**:
```typescript
{
  fileToTesting: Record<string, string[]>;  // File-based mappings
  nameToTesting: Record<string, string[]>;  // Name-based mappings
  testingToTrigger: Record<string, string[]>; // Reverse mappings
  workflows: Array<{
    path?: string;
    name?: string;
    isTrigger?: boolean;
  }>;
}
```

**Usage Example**:
```typescript
const fetchTriggerMap = async (repoSlug: string, repoPath?: string) => {
  const url = repoPath
    ? `/api/repositories/trigger-map?repoPath=${encodeURIComponent(repoPath)}`
    : `/api/repositories/trigger-map?repo=${encodeURIComponent(repoSlug)}`;
    
  const response = await fetch(url, { cache: 'no-store' });
  if (response.ok) {
    return response.json();
  }
  return null;
};
```

## GitHub API Integration

### 1. Repository Information

**Endpoint**: `GET https://api.github.com/repos/{owner}/{repo}`

**Context**: Validates repository existence and accessibility.

**Headers**:
```typescript
{
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'OmniLens-Dashboard'
}
```

**Response**:
```typescript
{
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  // ... other repository fields
}
```

### 2. Workflow Runs

**Endpoint**: `GET https://api.github.com/repos/{owner}/{repo}/actions/runs`

**Context**: Fetches workflow runs for a specific date range.

**Query Parameters**:
```typescript
{
  created: string;    // Date range: YYYY-MM-DDTHH:MM:SSZ..YYYY-MM-DDTHH:MM:SSZ
  per_page: number;   // Number of results per page (max 100)
  page: number;       // Page number for pagination
}
```

**Response**:
```typescript
{
  total_count: number;
  workflow_runs: Array<{
    id: number;
    name: string;
    workflow_id: number;
    path?: string;
    conclusion: string | null;
    status: string;
    html_url: string;
    run_started_at: string;
    updated_at: string;
    // ... other run fields
  }>;
}
```

### 3. Workflow Files

**Endpoint**: `GET https://api.github.com/repos/{owner}/{repo}/actions/workflows`

**Context**: Fetches available workflow files in a repository.

**Response**:
```typescript
{
  total_count: number;
  workflows: Array<{
    id: number;
    name: string;
    path: string;
    state: string;
    html_url: string;
    // ... other workflow fields
  }>;
}
```

## API Call Contexts

### 1. Home Page Context

**Initial Load**:
```typescript
// Load user-added repositories from localStorage
const userRepos = loadUserAddedRepos();

// Fetch metrics for each repository
const enhanced = await Promise.all(
  userRepos.map(async (repo) => {
    const res = await fetch(`/api/repositories/workflow-runs?repoPath=${encodeURIComponent(repo.repoPath)}&date=${todayStr}`);
    // Process and return enhanced repo data
  })
);
```

**Background Polling**:
```typescript
// Poll every 10 seconds for fresh data
useEffect(() => {
  const intervalId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      hydrateUserRepos();
    }
  }, 10000);
  return () => clearInterval(intervalId);
}, [hydrateUserRepos]);
```

### 2. Dashboard Context

**Page Initialization**:
```typescript
// Main workflow data query
const { data: todayData, isLoading, error } = useQuery({
  queryKey: ["workflowData", repoSlug, format(selectedDate, "yyyy-MM-dd")],
  queryFn: () => fetchWorkflowData(selectedDate, repoSlug),
  enabled: !!repoConfig || !!addedRepoPath,
  staleTime: isSelectedDateToday ? 0 : 5 * 60 * 1000,
  refetchInterval: isSelectedDateToday ? 10000 : false,
  refetchOnWindowFocus: isSelectedDateToday,
});

// Yesterday's data for comparison
const { data: yesterdayData } = useQuery({
  queryKey: ["yesterdayWorkflowData", repoSlug, format(selectedDate, "yyyy-MM-dd")],
  queryFn: async () => {
    const yesterday = new Date(selectedDate);
    yesterday.setDate(yesterday.getDate() - 1);
    return await fetchWorkflowData(yesterday, repoSlug);
  },
  enabled: !!repoConfig || !!addedRepoPath,
  staleTime: 5 * 60 * 1000,
});
```

**Configuration Modal**:
```typescript
// Load available workflows for configuration
const openConfigureModal = async () => {
  const res = await fetch(`/api/repositories/workflows?repoPath=${encodeURIComponent(repoPath)}`);
  const json = await res.json();
  setAvailableWorkflows(json.workflows || []);
  
  // Preload trigger map
  await ensureTriggerMapLoaded();
  
  // Preload today's and yesterday's data
  const [todayRes, yRes] = await Promise.all([
    fetch(todayUrl, { cache: 'no-store' }),
    fetch(yUrl, { cache: 'no-store' })
  ]);
  
  // Update query cache
  queryClient.setQueryData(["workflowData", repoSlug, selectedStr], todayJson);
  queryClient.setQueryData(["yesterdayWorkflowData", repoSlug, selectedStr], yJson);
};
```

### 3. Repository Addition Context

**Validation Flow**:
```typescript
const handleAddRepo = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validate repository
  const res = await fetch('/api/repositories/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl: input })
  });
  
  const json = await res.json();
  if (!res.ok || json.valid === false) {
    setAddError(json?.error || 'Repository validation failed');
    return;
  }
  
  // Create repository entry
  const newRepo = {
    slug: `local-${json.repoPath.replace(/\//g, '-')}`,
    repoPath: json.repoPath,
    displayName: json.displayName,
    // ... other fields
  };
  
  // Save to localStorage and update UI
  setAvailableRepos(prev => [...prev, newRepo]);
  saveUserAddedRepos([...stored, { slug: newRepo.slug, repoPath: json.repoPath, displayName: json.displayName }]);
};
```

## Error Handling

### 1. GitHub API Errors

**Rate Limiting**:
```typescript
if (res.headers.get('X-RateLimit-Remaining') === '0') {
  throw new Error('GitHub API rate limit exceeded');
}
```

**Authentication Errors**:
```typescript
if (res.status === 401) {
  throw new Error('Invalid GitHub token');
}
```

**Authorization Errors**:
```typescript
if (res.status === 403) {
  const sso = res.headers.get('X-GitHub-SSO');
  throw new Error(sso ? `SSO authorization required: ${sso}` : 'Repository access denied');
}
```

**Repository Not Found**:
```typescript
if (res.status === 404) {
  return { workflowRuns: [], overviewData: { /* empty data */ } };
}
```

### 2. Network Errors

**Timeout Handling**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(url, {
    signal: controller.signal,
    // ... other options
  });
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('Request timeout');
  }
  throw error;
} finally {
  clearTimeout(timeoutId);
}
```

**Retry Logic**:
```typescript
const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // Don't retry on client errors
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

## Caching Strategies

### 1. TanStack Query Caching

**Query Configuration**:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
    },
  },
});
```

**Cache Keys**:
```typescript
// Workflow data cache key
["workflowData", repoSlug, dateString]

// Yesterday's data cache key
["yesterdayWorkflowData", repoSlug, dateString]

// Repository list cache key
["repositories"]

// Trigger map cache key
["triggerMap", repoSlug]
```

### 2. Browser Caching

**Cache Headers**:
```typescript
// For static data (5 minutes)
{
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
}

// For dynamic data (30 seconds)
{
  'Cache-Control': 'public, max-age=30, stale-while-revalidate=300'
}

// For real-time data (no cache)
{
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
}
```

### 3. Local Storage Caching

**Trigger Map Cache**:
```typescript
// Cache trigger maps with TTL
const cacheKey = `triggerMap-${repoSlug}`;
const cached = localStorage.getItem(cacheKey);

if (cached) {
  const { ts, data } = JSON.parse(cached);
  if (Date.now() - ts < 24 * 60 * 60 * 1000) { // 24 hours TTL
    return data;
  }
}

// Fetch and cache
const data = await fetchTriggerMap(repoSlug);
localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
```

## Rate Limiting

### 1. GitHub API Rate Limits

**Rate Limit Headers**:
```typescript
const rateLimitRemaining = res.headers.get('X-RateLimit-Remaining');
const rateLimitReset = res.headers.get('X-RateLimit-Reset');

if (rateLimitRemaining === '0') {
  const resetTime = new Date(parseInt(rateLimitReset) * 1000);
  throw new Error(`Rate limit exceeded. Reset at ${resetTime.toISOString()}`);
}
```

**Rate Limit Monitoring**:
```typescript
const checkRateLimit = (response: Response) => {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const limit = response.headers.get('X-RateLimit-Limit');
  
  if (remaining && parseInt(remaining) < 10) {
    console.warn(`Rate limit warning: ${remaining}/${limit} requests remaining`);
  }
};
```

### 2. Application-Level Rate Limiting

**Request Throttling**:
```typescript
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;
  
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
    return fn();
  }
}

const apiRateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
```

## Authentication

### 1. GitHub Token Management

**Environment Configuration**:
```typescript
const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error('Missing GITHUB_TOKEN environment variable');
}
```

**Token Validation**:
```typescript
const validateToken = async (token: string) => {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  
  if (!response.ok) {
    throw new Error('Invalid GitHub token');
  }
  
  return response.json();
};
```

**Token Permissions**:
```typescript
const requiredScopes = ['repo', 'workflow'];
const validateTokenScopes = async (token: string) => {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  
  const scopes = response.headers.get('X-OAuth-Scopes');
  if (!scopes || !requiredScopes.every(scope => scopes.includes(scope))) {
    throw new Error(`Token missing required scopes: ${requiredScopes.join(', ')}`);
  }
};
```

### 2. Repository Access Validation

**Access Check**:
```typescript
const checkRepositoryAccess = async (repoPath: string, token: string) => {
  const response = await fetch(`https://api.github.com/repos/${repoPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  
  if (response.status === 404) {
    throw new Error('Repository not found');
  }
  
  if (response.status === 403) {
    throw new Error('Repository access denied');
  }
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  return response.json();
};
```

## API Performance Monitoring

### 1. Response Time Tracking

```typescript
const trackApiPerformance = async (url: string, options: RequestInit) => {
  const startTime = performance.now();
  
  try {
    const response = await fetch(url, options);
    const endTime = performance.now();
    
    console.log(`API Call: ${url} - ${Math.round(endTime - startTime)}ms`);
    
    return response;
  } catch (error) {
    const endTime = performance.now();
    console.error(`API Error: ${url} - ${Math.round(endTime - startTime)}ms`, error);
    throw error;
  }
};
```

### 2. Cache Hit Rate Monitoring

```typescript
const cacheStats = {
  hits: 0,
  misses: 0,
  get hitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }
};

const logCacheStats = () => {
  console.log(`Cache hit rate: ${cacheStats.hitRate.toFixed(2)}%`);
};
```

### 3. Error Rate Monitoring

```typescript
const errorStats = {
  total: 0,
  errors: 0,
  get errorRate() {
    return this.total > 0 ? (this.errors / this.total) * 100 : 0;
  }
};

const trackApiCall = async (fn: () => Promise<any>) => {
  errorStats.total++;
  
  try {
    return await fn();
  } catch (error) {
    errorStats.errors++;
    throw error;
  }
};
```

---

This API reference provides a comprehensive guide to all API interactions in the OmniLens application. It covers internal routes, external integrations, error handling, caching strategies, and performance monitoring. Use this document as a reference for development, debugging, and optimization of API calls throughout the application.
