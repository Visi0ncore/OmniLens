import { NextRequest, NextResponse } from 'next/server';
import { getAvailableRepositories } from '@/lib/github';

const API_BASE = 'https://api.github.com';

async function fetchAllWorkflows(repoPath: string, token: string) {
  let page = 1;
  const all: any[] = [];
  while (true) {
    const res = await fetch(`${API_BASE}/repos/${repoPath}/actions/workflows?per_page=100&page=${page}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });
    if (res.status === 404) {
      return { workflows: [], error: 'Repository not found' };
    }
    if (res.status === 403) {
      return { workflows: [], error: 'Repository access denied' };
    }
    if (!res.ok) {
      return { workflows: [], error: `GitHub API error: ${res.status} ${res.statusText}` };
    }
    const json = await res.json();
    const workflows = json.workflows || [];
    all.push(...workflows);
    if (workflows.length < 100) break;
    page += 1;
    if (page > 10) break; // safety
  }
  return { workflows: all, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Missing GITHUB_TOKEN' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const repoPathParam = searchParams.get('repoPath'); // owner/repo
    const repoSlug = searchParams.get('repo');

    let repoPath: string | null = null;
    if (repoPathParam) {
      repoPath = repoPathParam.trim();
    } else if (repoSlug) {
      // Map slug to repo path from available repos
      const available = getAvailableRepositories();
      const found = available.find(r => r.slug === repoSlug);
      repoPath = found?.repoPath || null;
    }

    if (!repoPath) {
      return NextResponse.json({ error: 'repoPath or repo slug is required' }, { status: 400 });
    }

    const { workflows, error } = await fetchAllWorkflows(repoPath, token);
    if (error) {
      const status = error.includes('not found') ? 404 : error.includes('denied') ? 403 : 500;
      return NextResponse.json({ error }, { status });
    }

    // Normalize minimal fields
    const simplified = workflows.map((w: any) => ({
      id: w.id,
      name: w.name,
      path: w.path,
      state: w.state,
      html_url: w.html_url,
      badge_url: w.badge_url,
    }));

    return NextResponse.json({ workflows: simplified }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('List workflows API error:', error);
    return NextResponse.json({ error: 'Failed to list workflows' }, { status: 500 });
  }
}


