import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserRepo, getWorkflows } from '@/lib/db-storage';
import type { WorkflowRun } from '@/lib/github';

// Zod schemas for validation
const slugSchema = z.string().min(1, 'Repository slug is required');

// GET /api/workflow/{slug}/latest-runs - Get latest run for each workflow
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Validate the slug parameter
    const validatedSlug = slugSchema.parse(params.slug);
    console.log(`🔍 [LATEST RUNS API] Request for repo slug: ${validatedSlug}`);
    
    // Check if the repository exists in our database
    const repo = await getUserRepo(validatedSlug);
    if (!repo) {
      console.log(`❌ [LATEST RUNS API] Repository not found in database: ${validatedSlug}`);
      return NextResponse.json(
        { error: 'Repository not found in dashboard' },
        { status: 404 }
      );
    }
    
    console.log(`✅ [LATEST RUNS API] Found repo in database:`, {
      slug: validatedSlug,
      repoPath: repo.repoPath,
      displayName: repo.displayName
    });
    
    // Get saved workflows from database (active only)
    const allSavedWorkflows = await getWorkflows(validatedSlug);
    const savedWorkflows = allSavedWorkflows.filter(workflow => workflow.state === 'active');
    
    if (savedWorkflows.length === 0) {
      console.log(`⚠️ [LATEST RUNS API] No active workflows found in database for ${validatedSlug}`);
      return NextResponse.json({
        repository: {
          slug: validatedSlug,
          displayName: repo.displayName,
          repoPath: repo.repoPath
        },
        latestRuns: [],
        message: 'No active workflows found. Please fetch workflows first.'
      });
    }
    
    // Get GitHub token from environment
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('GitHub token not configured');
      return NextResponse.json(
        { error: 'GitHub integration not configured' },
        { status: 500 }
      );
    }
    
    // Extract owner and repo name from the repository path
    const [owner, repoName] = repo.repoPath.split('/');
    if (!owner || !repoName) {
      return NextResponse.json(
        { error: 'Invalid repository path format' },
        { status: 400 }
      );
    }
    
    // Get the repository's default branch
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OmniLens-Dashboard'
        }
      }
    );
    
    if (!repoResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch repository information' },
        { status: 500 }
      );
    }
    
    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;
    
    console.log(`🏃 [LATEST RUNS API] Repository default branch: ${defaultBranch}`);
    
    console.log(`🏃 [LATEST RUNS API] Fetching latest runs for ${savedWorkflows.length} active workflows...`);
    
    // Fetch latest runs for each active workflow
    const latestRuns: WorkflowRun[] = [];
    
    for (const workflow of savedWorkflows) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${workflow.id}/runs?branch=${defaultBranch}&per_page=1`,
          {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'OmniLens-Dashboard'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.workflow_runs && data.workflow_runs.length > 0) {
            const run = data.workflow_runs[0];
            latestRuns.push({
              id: run.id,
              name: run.name,
              workflow_id: workflow.id,
              path: run.path,
              conclusion: run.conclusion,
              status: run.status,
              html_url: run.html_url,
              run_started_at: run.run_started_at,
              updated_at: run.updated_at
            });
          }
        } else {
          console.warn(`Failed to fetch latest run for workflow ${workflow.id}: ${response.status}`);
        }
      } catch (error) {
        console.error(`Error fetching latest run for workflow ${workflow.id}:`, error);
      }
    }
    
    console.log(`📤 [LATEST RUNS API] Fetched ${latestRuns.length} latest runs:`, {
      run_count: latestRuns.length,
      workflow_ids: latestRuns.map(r => r.workflow_id),
      run_statuses: latestRuns.map(r => ({ id: r.id, workflow_id: r.workflow_id, status: r.status, conclusion: r.conclusion }))
    });
    
    const response = {
      repository: {
        slug: validatedSlug,
        displayName: repo.displayName,
        repoPath: repo.repoPath
      },
      latestRuns: latestRuns,
      totalCount: latestRuns.length
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid repository slug', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error fetching latest runs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
