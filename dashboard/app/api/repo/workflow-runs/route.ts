import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE = 'https://api.github.com';

export async function GET(request: NextRequest) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Missing GITHUB_TOKEN' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const repoPath = searchParams.get('repoPath');
    const date = searchParams.get('date');
    if (!repoPath || !date) {
      return NextResponse.json({ error: 'repoPath and date are required' }, { status: 400 });
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const startIso = new Date(targetDate);
    startIso.setUTCHours(0, 0, 0, 0);
    const endIso = new Date(targetDate);
    endIso.setUTCHours(23, 59, 59, 999);

    const startStr = startIso.toISOString();
    const endStr = endIso.toISOString();

    let page = 1;
    let allRuns: any[] = [];
    let hasMore = true;
    while (hasMore) {
      const res = await fetch(
        `${API_BASE}/repos/${repoPath}/actions/runs?created=${startStr}..${endStr}&per_page=100&page=${page}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
          cache: 'no-store',
        }
      );

      if (res.status === 404) {
        return NextResponse.json({ workflow_runs: [] }, { status: 200 });
      }
      if (res.status === 403) {
        return NextResponse.json({ error: 'Repository access denied' }, { status: 403 });
      }
      if (!res.ok) {
        return NextResponse.json({ error: `GitHub API error: ${res.status} ${res.statusText}` }, { status: 500 });
      }

      const json = await res.json();
      const pageRuns = (json.workflow_runs || []).map((r: any) => ({
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

      allRuns = allRuns.concat(pageRuns);
      hasMore = pageRuns.length === 100;
      page += 1;
      if (page > 10) break; // safety
    }

    return NextResponse.json({ workflow_runs: allRuns }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('List workflow runs API error:', error);
    return NextResponse.json({ error: 'Failed to list workflow runs' }, { status: 500 });
  }
}


