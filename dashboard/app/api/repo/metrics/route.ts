import { NextResponse } from 'next/server';
import { calculateOverviewData, getWorkflowRunsForDate } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const availableRepos: Array<{ slug: string; displayName: string }> = [];
    const today = new Date();
    
    // Enhance with basic metrics for all repositories
    const reposWithMetrics = await Promise.all(
      availableRepos.map(async (repo) => {
        const displayName = repo.displayName;
        
        let metrics = null;
        let hasWorkflows = false;
        
        try {
          // Fetch today's workflow data to calculate metrics
          const workflowRuns = await getWorkflowRunsForDate(today, repo.slug);
          const overviewData = calculateOverviewData(workflowRuns);
          
          hasWorkflows = workflowRuns.length > 0;
          
          if (hasWorkflows) {
            // Create simplified metrics for home page
            metrics = {
              totalWorkflows: overviewData.totalWorkflows,
              passedRuns: overviewData.passedRuns,
              failedRuns: overviewData.failedRuns,
              inProgressRuns: overviewData.inProgressRuns,
              successRate: overviewData.completedRuns > 0 
                ? Math.round((overviewData.passedRuns / overviewData.completedRuns) * 100) 
                : 0,
              hasActivity: overviewData.completedRuns > 0 || overviewData.inProgressRuns > 0
            };
          }
        } catch (error) {
          console.error(`Error fetching metrics for ${repo.slug}:`, error);
          // Don't fail the entire request if one repo has issues
          metrics = {
            totalWorkflows: 0,
            passedRuns: 0,
            failedRuns: 0,
            inProgressRuns: 0,
            successRate: 0,
            hasActivity: false
          };
        }

        return {
          ...repo,
          displayName,
          hasConfig: true, // All repositories are now "configured" since we removed categorization
          hasWorkflows,
          metrics
        };
      })
    );

    return NextResponse.json({
      repositories: reposWithMetrics
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repository metrics' },
      { status: 500 }
    );
  }
}