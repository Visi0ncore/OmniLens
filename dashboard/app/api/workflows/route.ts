import { NextRequest, NextResponse } from 'next/server';
import { calculateOverviewData, getWorkflowRunsForDate, isValidRepoSlug } from '@/lib/github';

// Force this route to be dynamic since it uses search parameters
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const repo = searchParams.get('repo');
    const repoPath = searchParams.get('repoPath'); // owner/repo (bypasses slug validation)
    
    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    // Require either repo (slug) or repoPath (owner/repo)
    if (!repo && !repoPath) {
      return NextResponse.json({ error: 'Either repo (slug) or repoPath (owner/repo) is required' }, { status: 400 });
    }

    const targetDate = new Date(date);
    
    // Validate date
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // If explicit repoPath provided, fetch directly from GitHub using token and bypass slug validation
    let workflowRuns: any[] = [];
    let overviewData: any = null;

    if (repoPath) {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return NextResponse.json({ error: 'Missing GITHUB_TOKEN environment variable' }, { status: 500 });
      }

      const dateStr = targetDate.toISOString().slice(0, 10);
      const start = `${dateStr}T00:00:00Z`;
      const end = `${dateStr}T23:59:59Z`;

      let page = 1;
      let allRuns: any[] = [];
      let hasMore = true;
      while (hasMore) {
        const res = await fetch(`https://api.github.com/repos/${repoPath}/actions/runs?created=${start}..${end}&per_page=100&page=${page}`, {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'OmniLens-Dashboard'
          },
          cache: 'no-store',
        });
        if (!res.ok) {
          const msg = await res.text();
          const sso = res.headers.get('X-GitHub-SSO') || '';
          const isRateLimit = (res.headers.get('X-RateLimit-Remaining') === '0') || /rate limit/i.test(msg);
          const detail = isRateLimit ? 'GitHub API rate limit exceeded' : (sso ? `SSO authorization required: ${sso}` : msg);
          return NextResponse.json({ error: `GitHub API error: ${res.status} ${res.statusText} ${detail}` }, { status: res.status });
        }
        const json = await res.json();
        const pageRuns = json.workflow_runs || [];
        allRuns = allRuns.concat(pageRuns);
        hasMore = pageRuns.length === 100;
        page += 1;
        if (page > 10) break;
      }
      // Normalize a subset of fields used by UI
      const normalized = allRuns.map((r: any) => ({
        id: r.id,
        name: r.name,
        workflow_id: r.workflow_id,
        path: r.path,
        conclusion: r.conclusion,
        status: r.status,
        html_url: r.html_url,
        run_started_at: r.run_started_at,
        updated_at: r.updated_at,
      }));

      // Group by workflow file (fallback to name) and keep latest run, counting duplicates
      const latestByFile = new Map<string, any>();
      const counts = new Map<string, number>();
      const allByFile = new Map<string, any[]>();
      normalized
        .sort((a, b) => new Date(b.run_started_at).getTime() - new Date(a.run_started_at).getTime())
        .forEach((run) => {
          const keySource = run.path || run.name || '';
          const key = (keySource.split('/').pop() || keySource).toLowerCase();
          if (!latestByFile.has(key)) {
            latestByFile.set(key, run);
            counts.set(key, 1);
            allByFile.set(key, [{ id: run.id, conclusion: run.conclusion, status: run.status, html_url: run.html_url, run_started_at: run.run_started_at }]);
          } else {
            counts.set(key, (counts.get(key) || 0) + 1);
            const arr = allByFile.get(key) || [];
            arr.push({ id: run.id, conclusion: run.conclusion, status: run.status, html_url: run.html_url, run_started_at: run.run_started_at });
            allByFile.set(key, arr);
          }
        });

      workflowRuns = Array.from(latestByFile.values()).map((run) => {
        const keySource = run.path || run.name || '';
        const key = (keySource.split('/').pop() || keySource).toLowerCase();
        return {
          ...run,
          run_count: counts.get(key) || 1,
          all_runs: allByFile.get(key) || [],
        };
      });
      // Compute overview without category filtering
      const completedRuns = workflowRuns.filter(r => r.status === 'completed').length;
      const inProgressRuns = workflowRuns.filter(r => r.status === 'in_progress' || r.status === 'queued').length;
      const passedRuns = workflowRuns.filter(r => r.conclusion === 'success').length;
      const failedRuns = workflowRuns.filter(r => r.conclusion === 'failure').length;
      const totalRuntime = workflowRuns.reduce((total, r) => {
        if (r.status === 'completed') {
          const startMs = new Date(r.run_started_at).getTime();
          const endMs = new Date(r.updated_at).getTime();
          return total + Math.max(0, Math.floor((endMs - startMs) / 1000));
        }
        return total;
      }, 0);
      overviewData = {
        completedRuns,
        inProgressRuns,
        passedRuns,
        failedRuns,
        totalRuntime,
        didntRunCount: 0,
        totalWorkflows: workflowRuns.length,
        missingWorkflows: [],
      };
    } else {
      // Existing slug-based path (env repos)
      if (!repo || !isValidRepoSlug(repo)) {
        return NextResponse.json({ error: 'Invalid repo slug or repo not configured' }, { status: 400 });
      }
      workflowRuns = await getWorkflowRunsForDate(targetDate, repo);
      overviewData = calculateOverviewData(workflowRuns, repo);
    }

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