import { NextRequest, NextResponse } from 'next/server';
import { getRepoNameFromEnv, isValidRepoSlug } from '@/lib/github';

// Simple in-memory cache (per server instance)
const rangeCache = new Map<string, { ts: number; data: any }>();
const RANGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return NextResponse.json({ error: 'Missing GITHUB_TOKEN' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    let repoPath = searchParams.get('repoPath'); // owner/repo
    const repoSlug = searchParams.get('repo'); // optional slug for env-mapped repos
    const start = searchParams.get('start'); // yyyy-mm-dd or iso
    const end = searchParams.get('end');

    if ((!repoPath && !repoSlug) || !start || !end) {
      return NextResponse.json({ error: 'repoPath or repo (slug), start and end are required' }, { status: 400 });
    }

    // If repoPath missing but repo slug provided, resolve via server env
    if (!repoPath && repoSlug) {
      if (!isValidRepoSlug(repoSlug)) {
        return NextResponse.json({ error: 'Invalid repo slug or repo not configured' }, { status: 400 });
      }
      repoPath = getRepoNameFromEnv(repoSlug);
    }

    // Normalize to full-day UTC range
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format for start or end' }, { status: 400 });
    }
    const startStr = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0)).toISOString();
    const endStr = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999)).toISOString();

    // Cache key normalized on repo and exact UTC range
    const cacheKey = `${repoPath}|${startStr}|${endStr}`;
    const cached = rangeCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < RANGE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=600'
        }
      });
    }

    let page = 1;
    let allRuns: any[] = [];
    let hasMore = true;
    while (hasMore) {
      const res = await fetch(`https://api.github.com/repos/${repoPath}/actions/runs?created=${startStr}..${endStr}&per_page=100&page=${page}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'OmniLens-Dashboard'
        },
        cache: 'no-store',
      });

      if (res.status === 404) {
        return NextResponse.json({ workflow_runs: [] }, { status: 200 });
      }
      if (!res.ok) {
        const body = await res.text();
        const sso = res.headers.get('X-GitHub-SSO') || '';
        const isRateLimit = (res.headers.get('X-RateLimit-Remaining') === '0') || /rate limit/i.test(body);
        const detail = isRateLimit ? 'GitHub API rate limit exceeded' : (sso ? `SSO authorization required: ${sso}` : body);
        return NextResponse.json({ error: `GitHub API error: ${res.status} ${res.statusText} ${detail}` }, { status: res.status });
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
      if (page > 25) break; // safety
    }

    const payload = { workflow_runs: allRuns };
    rangeCache.set(cacheKey, { ts: Date.now(), data: payload });
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=600'
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch range' }, { status: 500 });
  }
}


