import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserRepo, saveWorkflows, getWorkflows } from '@/lib/db-storage';
import { getLatestWorkflowRuns, getWorkflowRunsForDate, getWorkflowRunsForDateGrouped } from '@/lib/github';

// Zod schemas for validation
const slugSchema = z.string().min(1, 'Repository slug is required');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// GitHub API response types
interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'deleted';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

interface GitHubWorkflowsResponse {
  total_count: number;
  workflows: GitHubWorkflow[];
}

interface GitHubWorkflowRun {
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
}

interface GitHubWorkflowRunsResponse {
  total_count: number;
  workflow_runs: GitHubWorkflowRun[];
}

/**
 * @openapi
 * /api/workflow/{slug}:
 *   get:
 *     summary: Get workflows or workflow runs for a repository
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Repository slug
 *       - name: date
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Date in YYYY-MM-DD format to get workflow runs for that date
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/WorkflowsResponse'
 *                 - $ref: '#/components/schemas/WorkflowRunsResponse'
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: Repository not found
 *       500:
 *         description: Internal server error
 */
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
    
    // Check if this is a request for workflow runs (with date parameter)
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const grouped = searchParams.get('grouped') === 'true';
    
    if (date) {
      try {
        // Validate date parameter
        const validatedDate = dateSchema.parse(date);
        // Handle workflow runs request
        return await handleWorkflowRunsRequest(validatedSlug, repo, validatedDate, grouped);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Invalid date format. Use YYYY-MM-DD format.' },
            { status: 400 }
          );
        }
        throw error;
      }
    }
    
    // First, try to get workflows from database
    try {
      const savedWorkflows = await getWorkflows(validatedSlug);
      if (savedWorkflows.length > 0) {
        console.log(`📋 Returning ${savedWorkflows.length} workflows from database for ${validatedSlug}`);
        return NextResponse.json({
          repository: {
            slug: validatedSlug,
            displayName: repo.displayName,
            repoPath: repo.repoPath
          },
          workflows: savedWorkflows,
          totalCount: savedWorkflows.length
        });
      }
    } catch (error) {
      console.error('Error getting saved workflows:', error);
      // Continue to fetch from GitHub if database lookup fails
    }
    
    // If no saved workflows, fetch from GitHub
    console.log(`📋 No saved workflows found for ${validatedSlug}, fetching from GitHub...`);
    
    // Extract owner and repo name from the repository path
    const [owner, repoName] = repo.repoPath.split('/');
    if (!owner || !repoName) {
      return NextResponse.json(
        { error: 'Invalid repository path format' },
        { status: 400 }
      );
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
    
    // Fetch workflows from GitHub API
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/actions/workflows`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OmniLens-Dashboard'
        }
      }
    );
    
    if (!githubResponse.ok) {
      if (githubResponse.status === 404) {
        return NextResponse.json(
          { error: 'Repository not found on GitHub' },
          { status: 404 }
        );
      } else if (githubResponse.status === 403) {
        return NextResponse.json(
          { error: 'Access denied to repository workflows' },
          { status: 403 }
        );
      } else {
        console.error('GitHub API error:', githubResponse.status, githubResponse.statusText);
        return NextResponse.json(
          { error: 'Failed to fetch workflows from GitHub' },
          { status: 500 }
        );
      }
    }
    
    const workflowsData: GitHubWorkflowsResponse = await githubResponse.json();
    
    // Transform the response to match our API format
    const workflows = workflowsData.workflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      path: workflow.path,
      state: workflow.state,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at,
      deletedAt: workflow.deleted_at
    }));
    
    // Save workflows to database for persistence
    try {
      await saveWorkflows(validatedSlug, workflows);
    } catch (error) {
      console.error('Error saving workflows to database:', error);
      // Continue with the response even if saving fails
    }
    
    return NextResponse.json({
      repository: {
        slug: validatedSlug,
        displayName: repo.displayName,
        repoPath: repo.repoPath
      },
      workflows: workflows,
      totalCount: workflowsData.total_count
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid repository slug', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to handle workflow runs requests
async function handleWorkflowRunsRequest(
  slug: string,
  repo: any,
  date: string,
  grouped: boolean = false
) {
  try {
    // The getWorkflowRunsForDate function handles all GitHub API calls and error handling
    const dateObj = new Date(date);
    const workflowRuns = grouped 
      ? await getWorkflowRunsForDateGrouped(dateObj, slug)
      : await getWorkflowRunsForDate(dateObj, slug);
    
    // Calculate overview data
    const completedRuns = workflowRuns.filter(run => run.status === 'completed').length;
    const inProgressRuns = workflowRuns.filter(run => run.status === 'in_progress').length;
    const passedRuns = workflowRuns.filter(run => run.conclusion === 'success').length;
    const failedRuns = workflowRuns.filter(run => run.conclusion === 'failure').length;
    
    // Calculate total runtime (simplified - would need more detailed API calls for accurate runtime)
    const totalRuntime = workflowRuns.reduce((total, run) => {
      if (run.status === 'completed' && run.run_started_at && run.updated_at) {
        const start = new Date(run.run_started_at).getTime();
        const end = new Date(run.updated_at).getTime();
        return total + (end - start);
      }
      return total;
    }, 0);
    
    // Get total workflows count (this would need a separate API call to get all workflows)
    // For now, we'll use the unique workflow IDs from the runs
    const uniqueWorkflowIds = new Set(workflowRuns.map(run => run.workflow_id));
    const totalWorkflows = uniqueWorkflowIds.size;
    
    const overviewData = {
      completedRuns,
      inProgressRuns,
      passedRuns,
      failedRuns,
      totalRuntime,
      didntRunCount: 0, // Would need to compare with total workflows
      totalWorkflows,
      missingWorkflows: [] // Would need to compare with all workflows
    };
    
    return NextResponse.json({
      workflowRuns,
      overviewData
    });
    
  } catch (error) {
    console.error('Error fetching workflow runs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
