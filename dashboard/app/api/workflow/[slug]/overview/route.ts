import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserRepo, getWorkflows } from '@/lib/db-storage';
import { getWorkflowRunsForDate, calculateOverviewData } from '@/lib/github';

// Zod schemas for validation
const slugSchema = z.string().min(1, 'Repository slug is required');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional();

// GET /api/workflow/{slug}/overview - Get aggregated daily metrics
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Validate the slug parameter
    const validatedSlug = slugSchema.parse(params.slug);
    console.log(`🔍 [OVERVIEW API] Request for repo slug: ${validatedSlug}`);
    
    // Check if the repository exists in our database
    const repo = await getUserRepo(validatedSlug);
    if (!repo) {
      console.log(`❌ [OVERVIEW API] Repository not found in database: ${validatedSlug}`);
      return NextResponse.json(
        { error: 'Repository not found in dashboard' },
        { status: 404 }
      );
    }
    
    console.log(`✅ [OVERVIEW API] Found repo in database:`, {
      slug: validatedSlug,
      repoPath: repo.repoPath,
      displayName: repo.displayName
    });
    
    // Get date parameter (default to today)
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const date = dateParam ? dateSchema.parse(dateParam) : new Date().toISOString().split('T')[0];
    
    console.log(`📅 [OVERVIEW API] Fetching overview for date: ${date}`);
    
    // Get saved workflows from database (active only)
    const allSavedWorkflows = await getWorkflows(validatedSlug);
    const savedWorkflows = allSavedWorkflows.filter(workflow => workflow.state === 'active');
    
    if (savedWorkflows.length === 0) {
      console.log(`⚠️ [OVERVIEW API] No active workflows found in database for ${validatedSlug}`);
      return NextResponse.json({
        repository: {
          slug: validatedSlug,
          displayName: repo.displayName,
          repoPath: repo.repoPath
        },
        overview: {
          completedRuns: 0,
          inProgressRuns: 0,
          passedRuns: 0,
          failedRuns: 0,
          totalRuntime: 0,
          didntRunCount: savedWorkflows.length,
          totalWorkflows: savedWorkflows.length,
          missingWorkflows: [],
          successRate: 0,
          passRate: 0
        },
        message: 'No active workflows found. Please fetch workflows first.'
      });
    }
    
    // Get the repository's default branch
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
    
    console.log(`📅 [OVERVIEW API] Repository default branch: ${defaultBranch}`);
    
    // Get workflow runs for the specified date (from default branch only)
    const dateObj = new Date(date);
    const workflowRuns = await getWorkflowRunsForDate(dateObj, validatedSlug, defaultBranch);
    
    console.log(`📊 [OVERVIEW API] Fetched ${workflowRuns.length} workflow runs for ${date}`);
    
    // Calculate overview data using the existing function
    const overviewData = calculateOverviewData(workflowRuns);
    
    // Calculate additional metrics
    const successRate = overviewData.completedRuns > 0 
      ? Math.round((overviewData.passedRuns / overviewData.completedRuns) * 100) 
      : 0;
    
    const passRate = overviewData.totalWorkflows > 0 
      ? Math.round((overviewData.passedRuns / overviewData.totalWorkflows) * 100) 
      : 0;
    
    // Calculate hourly breakdown
    const runsByHour = Array.from({ length: 24 }, (_, hour) => {
      const hourRuns = workflowRuns.filter(run => {
        const runHour = new Date(run.run_started_at).getHours();
        return runHour === hour;
      });
      
      const passed = hourRuns.filter(run => run.conclusion === 'success').length;
      const failed = hourRuns.filter(run => run.conclusion === 'failure').length;
      
      return {
        hour,
        passed,
        failed,
        total: passed + failed
      };
    });
    
    // Calculate average runs per hour
    const totalRuns = workflowRuns.length;
    const avgRunsPerHour = totalRuns > 0 ? Math.round((totalRuns / 24) * 10) / 10 : 0;
    const minRunsPerHour = Math.min(...runsByHour.map(h => h.total));
    const maxRunsPerHour = Math.max(...runsByHour.map(h => h.total));
    
    const enhancedOverview = {
      ...overviewData,
      successRate,
      passRate,
      avgRunsPerHour,
      minRunsPerHour,
      maxRunsPerHour,
      runsByHour,
      totalRuns
    };
    
    const response = {
      repository: {
        slug: validatedSlug,
        displayName: repo.displayName,
        repoPath: repo.repoPath
      },
      overview: enhancedOverview,
      date,
      generatedAt: new Date().toISOString()
    };
    
    console.log(`📤 [OVERVIEW API] Final response:`, {
      overview_data: enhancedOverview,
      date: response.date
    });
    
    return NextResponse.json(response);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error fetching overview:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
