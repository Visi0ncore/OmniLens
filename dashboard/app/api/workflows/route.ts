import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowRunsForDate, calculateOverviewData, isValidRepoSlug } from '@/lib/github';

// Force this route to be dynamic since it uses search parameters
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const repo = searchParams.get('repo');
    
    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    if (!repo) {
      return NextResponse.json({ error: 'Repo parameter is required' }, { status: 400 });
    }

    const targetDate = new Date(date);
    
    // Validate date
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Validate repo slug
    if (!isValidRepoSlug(repo)) {
      // For unknown/local repos, return an empty response instead of 400 to avoid UI errors
      return NextResponse.json({
        workflowRuns: [],
        overviewData: {
          completedRuns: 0,
          inProgressRuns: 0,
          passedRuns: 0,
          failedRuns: 0,
          totalRuntime: 0,
          didntRunCount: 0,
          totalWorkflows: 0,
          missingWorkflows: []
        }
      }, { status: 200 });
    }

    const workflowRuns = await getWorkflowRunsForDate(targetDate, repo);
    const overviewData = calculateOverviewData(workflowRuns, repo);

    return NextResponse.json({
      workflowRuns,
      overviewData
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString()
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    
    // Check if it's a GitHub API error for a repository with no workflows
    if (error instanceof Error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        return NextResponse.json({
          workflowRuns: [],
          overviewData: {
            completedRuns: 0,
            inProgressRuns: 0,
            passedRuns: 0,
            failedRuns: 0,
            totalRuntime: 0,
            didntRunCount: 0,
            totalWorkflows: 0,
            missingWorkflows: []
          }
        }, { status: 200 });
      }
      
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'Repository access denied. Please check your GitHub token permissions.' },
          { status: 403 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch workflow data' },
      { status: 500 }
    );
  }
} 