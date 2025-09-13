# Workflow Persistence Implementation

## Overview

This document outlines the changes made to implement workflow persistence and simplify the workflow management in the OmniLens dashboard.

## Changes Made

### 1. Database Schema Updates

**File: `lib/schema.sql`**
- Added new `workflows` table to store workflow IDs per repository
- Table structure:
  - `id`: Primary key
  - `repo_slug`: Repository slug (foreign key to repositories table)
  - `workflow_id`: GitHub workflow ID
  - `workflow_name`: Workflow name
  - `workflow_path`: Workflow file path
  - `workflow_state`: Workflow state (active/deleted)
  - `created_at`/`updated_at`: Timestamps
- Added appropriate indexes and triggers

### 2. Database Functions

**File: `lib/db-storage.ts`**
- Added `saveWorkflows()`: Saves workflow data to database
- Added `getWorkflows()`: Retrieves saved workflows for a repository
- Added `deleteWorkflows()`: Removes workflows for a repository

### 3. API Endpoints

**File: `app/api/workflow/[slug]/route.ts`**
- Updated to save workflows to database when fetched from GitHub
- Maintains backward compatibility

**File: `app/api/workflow/[slug]/route.ts`**
- Updated to check database first before fetching from GitHub
- Returns saved workflows from database if available
- Falls back to GitHub API if no saved workflows exist
- Automatically saves workflows to database when fetched from GitHub

### 4. Simplified Workflow Logic

**File: `lib/utils.ts`**
- Removed all complex workflow categorization functions:
  - `getRepoConfig()`
  - `getAllConfiguredWorkflows()`
  - `filterWorkflowsByCategories()`
  - `calculateMissingWorkflows()`
  - `getTestingWorkflowsForTrigger()`
  - `getTriggerWorkflowForTesting()`
  - `isTriggerWorkflow()`
- Kept utility functions for name cleaning and repository validation

**File: `lib/github.ts`**
- Removed complex workflow categorization imports and logic
- Simplified `getLatestWorkflowRuns()` to work with all workflows uniformly
- Updated `calculateOverviewData()` to work with all workflows
- Removed filtering based on workflow categories

### 5. Frontend Updates

**File: `app/dashboard/[slug]/page.tsx`**
- Removed "Configure Workflows" button and "No workflows configured" content
- Added loading skeleton that shows 3 rows of workflow cards (9 total) while loading
- Auto-loads workflows when component mounts using the standard API endpoint
- Shows skeleton during loading, then displays actual workflow cards
- Simplified UI with automatic workflow loading

## How It Works

### Workflow Persistence Flow

1. **First Visit**: When a user visits a repository dashboard for the first time:
   - Dashboard calls `GET /api/workflow/{slug}` (standard API endpoint)
   - API checks database first, finds no saved workflows
   - API fetches workflows from GitHub and saves them to database
   - Dashboard displays the workflows

2. **Subsequent Visits**: 
   - Dashboard calls `GET /api/workflow/{slug}` (standard API endpoint)
   - API finds saved workflows in database and returns them (fast)
   - No need to call GitHub API

3. **Automatic Loading**: 
   - Workflows are automatically loaded when the dashboard mounts
   - Shows loading skeleton while fetching
   - Displays workflow cards once loaded

### Benefits

1. **Performance**: Faster loading on subsequent visits
2. **Simplicity**: Removed complex workflow categorization logic
3. **Reliability**: Workflows are persisted and available offline
4. **Maintainability**: Cleaner codebase without workflow categorization complexity

## Testing

**New File: `tests/workflow-persistence.test.js`**
- Tests workflow persistence functionality
- Validates save and retrieve operations
- Ensures new repositories handle empty workflows correctly

Run with: `node tests/workflow-persistence.test.js`

## Migration Notes

- Existing repositories will automatically get their workflows saved on first fetch
- No manual migration required
- Legacy workflow categorization data is not migrated (simplified approach)
- All existing functionality continues to work

## Future Enhancements

The simplified architecture makes it easier to add features like:
- Workflow refresh functionality
- Workflow status tracking over time
- Custom workflow filtering (if needed)
- Workflow analytics and metrics
