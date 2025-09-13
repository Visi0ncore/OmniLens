import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserRepo, getWorkflows } from '@/lib/db-storage';
import { getWorkflowRunsForDate, getLatestWorkflowRuns } from '@/lib/github';

// Zod schemas for validation
const slugSchema = z.string().min(1, 'Repository slug is required');

// GET /api/workflow/{slug}/health-metrics - Get health status and trends for each workflow
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
        healthMetrics: [],
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
    
    // Get today's and yesterday's dates
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Fetch runs for today and yesterday (from default branch only)
    const [todayRuns, yesterdayRuns] = await Promise.all([
      getWorkflowRunsForDate(today, validatedSlug, defaultBranch),
      getWorkflowRunsForDate(yesterday, validatedSlug, defaultBranch)
    ]);
    
    // Calculate health metrics for each workflow
    const healthMetrics = savedWorkflows.map(workflow => {
      const todayWorkflowRuns = todayRuns.filter(run => run.workflow_id === workflow.id);
      const yesterdayWorkflowRuns = yesterdayRuns.filter(run => run.workflow_id === workflow.id);
      
      const todaySuccessful = todayWorkflowRuns.filter(run => run.conclusion === 'success').length;
      const todayFailed = todayWorkflowRuns.filter(run => run.conclusion === 'failure').length;
      const todayTotal = todayWorkflowRuns.length;
      
      const yesterdaySuccessful = yesterdayWorkflowRuns.filter(run => run.conclusion === 'success').length;
      const yesterdayFailed = yesterdayWorkflowRuns.filter(run => run.conclusion === 'failure').length;
      const yesterdayTotal = yesterdayWorkflowRuns.length;
      
      // Calculate health status
      let status: 'consistent' | 'improved' | 'regressed' | 'still_failing' | 'no_runs_today' = 'no_runs_today';
      
      if (todayTotal === 0) {
        status = 'no_runs_today';
      } else if (todayFailed === 0 && yesterdayFailed > 0) {
        status = 'improved';
      } else if (todayFailed > 0 && yesterdayFailed === 0) {
        status = 'regressed';
      } else if (todayFailed > 0 && yesterdayFailed > 0) {
        status = 'still_failing';
      } else {
        status = 'consistent';
      }
      
      return {
        workflowId: workflow.id,
        workflowName: workflow.name,
        status,
        metrics: {
          today: {
            totalRuns: todayTotal,
            successfulRuns: todaySuccessful,
            failedRuns: todayFailed,
            successRate: todayTotal > 0 ? Math.round((todaySuccessful / todayTotal) * 100) : 0
          },
          yesterday: {
            totalRuns: yesterdayTotal,
            successfulRuns: yesterdaySuccessful,
            failedRuns: yesterdayFailed,
            successRate: yesterdayTotal > 0 ? Math.round((yesterdaySuccessful / yesterdayTotal) * 100) : 0
          }
        }
      };
    });
    
    // Calculate summary statistics
    const summary = {
      totalWorkflows: savedWorkflows.length,
      consistent: healthMetrics.filter(m => m.status === 'consistent').length,
      improved: healthMetrics.filter(m => m.status === 'improved').length,
      regressed: healthMetrics.filter(m => m.status === 'regressed').length,
      stillFailing: healthMetrics.filter(m => m.status === 'still_failing').length,
      noRunsToday: healthMetrics.filter(m => m.status === 'no_runs_today').length
    };
    
    const response = {
      repository: {
        slug: validatedSlug,
        displayName: repo.displayName,
        repoPath: repo.repoPath
      },
      healthMetrics,
      summary,
      generatedAt: new Date().toISOString()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid repository slug', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error fetching health metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
