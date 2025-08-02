# Multi-Repository Implementation Plan

## Overview
Transform the single-repository dashboard into a multi-repository system supporting up to 3 repositories, with a home page for repo selection and repo-specific dashboard views.

## 1. Environment Variables Enhancement

### Current Structure
```bash
GITHUB_TOKEN=your_token
GITHUB_REPO=owner/repo
```

### New Structure
```bash
GITHUB_TOKEN=your_token
GITHUB_REPO_1=owner/repo1
GITHUB_REPO_2=owner/repo2  
GITHUB_REPO_3=owner/repo3
```

## 2. Configuration Updates

### Current `workflows.json`
```json
{
  "categories": { /* single config */ },
  "trigger_mappings": { /* single config */ }
}
```

### New `workflows.json`
```json
{
  "repositories": {
    "repo1": {
      "name": "Repository 1 Display Name",
      "slug": "repo1",
      "categories": { /* repo1 specific categories */ },
      "trigger_mappings": { /* repo1 specific mappings */ }
    },
    "repo2": { /* ... */ },
    "repo3": { /* ... */ }
  }
}
```

## 3. Routing Structure Changes

### Current
- `/` - Dashboard for single repo

### New  
- `/` - Home page with repo cards
- `/dashboard/[slug]` - Repo-specific dashboard (current functionality)

## 4. Local Storage Updates

### Current Keys
- `reviewedWorkflows-${date}`
- `collapsedCategories-${date}`
- `reviewedTestingWorkflows-${date}`

### New Keys (repo-specific)
- `reviewedWorkflows-${repoSlug}-${date}`
- `collapsedCategories-${repoSlug}-${date}`
- `reviewedTestingWorkflows-${repoSlug}-${date}`

## 5. Implementation Steps

### Phase 1: Backend Infrastructure
1. **Update GitHub lib** (`lib/github.ts`)
   - Modify `getEnvVars()` to return all 3 repos 
   - Add repo parameter to API functions
   - Update error handling for missing repos

2. **Extend API route** (`app/api/workflows/route.ts`)
   - Add `repo` query parameter 
   - Validate repo parameter against available repos
   - Pass repo to GitHub lib functions

### Phase 2: Configuration & Utils
3. **Update workflows config** (`config/workflows.json`)
   - Restructure to support multiple repositories
   - Migrate existing config to new structure

4. **Update utility functions** (`lib/utils.ts`)
   - Add repo-aware config access functions
   - Update workflow filtering for repo-specific configs

### Phase 3: Frontend Components  
5. **Create Home Page** (`app/page.tsx`)
   - Repository cards grid (simple cards with repo names)
   - Use existing card styling
   - Link to `/dashboard/[slug]` routes

6. **Create Repo Dashboard** (`app/dashboard/[slug]/page.tsx`)
   - Move current dashboard logic here
   - Add repo context throughout
   - Update local storage keys with repo prefix

7. **Update existing components**
   - Pass repo context through props
   - Update any hardcoded config references

### Phase 4: Data Management
8. **Local Storage Cleanup**
   - Clear all existing localStorage data (no migration needed)
   - Implement new repo-specific storage keys
   - Fresh start with new structure

## 6. File Structure Changes

```
app/
├── page.tsx (new home page)
├── dashboard/
│   └── [slug]/
│       └── page.tsx (current dashboard moved here)
├── api/
│   └── workflows/
│       └── route.ts (updated with repo param)
```

## Decisions Made ✅

1. **Repo Discovery**: Auto-detect from environment variables (`GITHUB_REPO_1`, `GITHUB_REPO_2`, `GITHUB_REPO_3`)

2. **Fallback Behavior**: Display "No repositories found" message if no `GITHUB_REPO_*` environment variables exist

3. **URL Structure**: Use `/dashboard/[slug]` pattern for repo-specific dashboards

4. **Home Page Features**: Simple cards with repo names only (extensible for future enhancements)

5. **Local Storage**: Clear all existing data and start fresh (no migration needed)

6. **Repo Naming**: Use repo slug and display name from config

7. **Error Handling**: Show repo card with name but display red error message and make card unclickable

8. **Configuration Migration**: Provide automated migration script for existing `workflows.json`

## Repo Discovery Implementation Details

### Environment Variable Detection
The system will scan for environment variables in sequence:
```javascript
function getAvailableRepos() {
  const repos = [];
  for (let i = 1; i <= 3; i++) {
    const repo = process.env[`GITHUB_REPO_${i}`];
    if (repo) {
      repos.push({
        envKey: `GITHUB_REPO_${i}`,
        repoPath: repo,
        slug: `repo${i}`, // or derive from repo name
        displayName: repo // or from config
      });
    }
  }
  return repos;
}
```

### Auto-Config Generation
- If repos found in env vars but not in `workflows.json`, auto-generate basic config structure
- Use repo path as display name initially  
- Create empty categories structure that can be manually populated

### Configuration Migration Script
- Detect existing single-repo `workflows.json` structure
- Automatically migrate to new multi-repo structure
- Preserve existing categories and trigger_mappings
- Generate migration for `GITHUB_REPO_1` using existing `GITHUB_REPO` value
- Backup original config file before migration

### Error States
- **No repos found**: Show "No repositories found. Please configure GITHUB_REPO_1, GITHUB_REPO_2, or GITHUB_REPO_3 environment variables."
- **Invalid repo access**: Show repo card with name but display red error message inside card and make unclickable
- **Malformed config**: Fallback to auto-generated structure
- **API failures**: Individual repo cards show error state without affecting other repos

## Technical Implementation Notes

- **Config Validation**: Add TypeScript types and runtime validation for new config structure
- **Component Reuse**: Existing dashboard components can be reused with minimal modifications (add repo context)
- **Testing Strategy**: Use environment variable overrides for multi-repo testing in development
- **Backward Compatibility**: Automated migration script handles old single-repo setup
- **Error Card Design**: Red error text, disabled hover states, no click handlers for failed repos
- **Migration Strategy**: Run migration script automatically on first load if old config detected
