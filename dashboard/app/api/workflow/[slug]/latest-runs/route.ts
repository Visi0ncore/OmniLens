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
    
    // Check if the repository exists in our database
    const repo = await getUserRepo(validatedSlug);
    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found in dashboard' },
        { status: 404 }
      );
    }
    
    // Get saved workflows from database (active only)
    const allSavedWorkflows = await getWorkflows(validatedSlug);
    const savedWorkflows = allSavedWorkflows.filter(workflow => workflow.state === 'active');
    
    if (savedWorkflows.length === 0) {
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
    
    // Fetch latest runs for each active workflow
    const latestRuns: WorkflowRun[] = [];
    
    for (const workflow of savedWorkflows) {
      try {
        // First, try to get any currently running workflows (in_progress, queued)
        const runningResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${workflow.id}/runs?status=in_progress&per_page=1`,
          {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'OmniLens-Dashboard'
            }
          }
        );
        
        let foundRun = null;
        
        if (runningResponse.ok) {
          const runningData = await runningResponse.json();
          if (runningData.workflow_runs && runningData.workflow_runs.length > 0) {
            foundRun = runningData.workflow_runs[0];
          }
        }
        
        // If no running workflow found, try queued
        if (!foundRun) {
          const queuedResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${workflow.id}/runs?status=queued&per_page=1`,
            {
              headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'OmniLens-Dashboard'
              }
            }
          );
          
          if (queuedResponse.ok) {
            const queuedData = await queuedResponse.json();
            if (queuedData.workflow_runs && queuedData.workflow_runs.length > 0) {
              foundRun = queuedData.workflow_runs[0];
            }
          }
        }
        
        // If no running/queued workflow, fall back to latest completed run from default branch
        if (!foundRun) {
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
              foundRun = data.workflow_runs[0];
            }
          } else {
            console.warn(`Failed to fetch latest run for workflow ${workflow.id}: ${response.status}`);
          }
        }
        
        if (foundRun) {
          latestRuns.push({
            id: foundRun.id,
            name: foundRun.name,
            workflow_id: workflow.id,
            path: foundRun.path,
            conclusion: foundRun.conclusion,
            status: foundRun.status,
            html_url: foundRun.html_url,
            run_started_at: foundRun.run_started_at,
            updated_at: foundRun.updated_at
          });
        }
      } catch (error) {
        console.error(`Error fetching latest run for workflow ${workflow.id}:`, error);
      }
    }
    
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
