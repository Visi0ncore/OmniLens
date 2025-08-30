import { NextRequest, NextResponse } from 'next/server';
import { getAvailableRepositories } from '@/lib/github';
import YAML from 'yaml';

const API_BASE = 'https://api.github.com';

export const dynamic = 'force-dynamic';

function normalizeName(name: string | undefined | null): string {
  if (!name) return '';
  return String(name).toLowerCase().trim();
}

function fileBase(path: string): string {
  const p = path.split('/').pop() || path;
  return p.toLowerCase();
}

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function GET(request: NextRequest) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return NextResponse.json({ error: 'Missing GITHUB_TOKEN' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    let repoPath = searchParams.get('repoPath');
    const slug = searchParams.get('repo');

    if (!repoPath && slug) {
      const available = getAvailableRepositories();
      const found = available.find(r => r.slug === slug);
      repoPath = found?.repoPath || null;
    }

    if (!repoPath) {
      return NextResponse.json({ error: 'repoPath or repo (slug) is required' }, { status: 400 });
    }

    // In-memory TTL cache to avoid recomputing trigger maps repeatedly
    const cacheKey = repoPath || slug || '';
    try {
      const globalCache = ((globalThis as any).__triggerMapApiCache ||= {
        data: new Map<string, { ts: number; value: any }>(),
        ttlMs: 5 * 60 * 1000, // 5 minutes
      });
      const hit = globalCache.data.get(cacheKey);
      if (hit && Date.now() - hit.ts < globalCache.ttlMs) {
        return NextResponse.json(hit.value, { headers: { 'Cache-Control': 'no-store' } });
      }
    } catch {}

    // 1) List workflows
    let page = 1;
    let allWorkflows: any[] = [];
    let hasMore = true;
    while (hasMore) {
      const json = await fetchJson(`${API_BASE}/repos/${repoPath}/actions/workflows?per_page=100&page=${page}`, token);
      const items = json.workflows || [];
      allWorkflows = allWorkflows.concat(items);
      hasMore = items.length === 100;
      page += 1;
      if (page > 10) break;
    }

    // 2) Fetch and parse YAML for each workflow
    const nameToTesting: Record<string, string[]> = {}; // trigger-name (normalized) -> testing file basenames
    const fileToTesting: Record<string, string[]> = {}; // trigger-file (lower) -> testing file basenames
    const workflowsMeta: Array<{ path: string; name: string; isTesting: boolean; isTrigger: boolean; isReusable: boolean }>
      = [];

    // helper to push mapping
    function addMap(triggerKey: string, testingFile: string, map: Record<string, string[]>) {
      const k = normalizeName(triggerKey);
      if (!k) return;
      const arr = map[k] || (map[k] = []);
      if (!arr.includes(testingFile)) arr.push(testingFile);
    }

    for (const wf of allWorkflows) {
      const wfPath: string = wf.path || `/.github/workflows/${wf.name}`;
      const base = fileBase(wfPath);

      const contents = await fetchJson(`${API_BASE}/repos/${repoPath}/contents/${encodeURIComponent(wfPath)}`, token);
      const content = Buffer.from(contents.content || '', 'base64').toString('utf-8');
      let parsed: any = {};
      try { parsed = YAML.parse(content) || {}; } catch {}

      const wfName = parsed?.name || base.replace(/\.ya?ml$/i, '').replace(/[-_]/g, ' ');
      const on = parsed?.on || parsed?.events || {};
      const isReusable = !!on?.workflow_call;

      let isTesting = false;
      const upstreamNames: string[] = [];

      // on.workflow_run.workflows may be string or array
      if (on?.workflow_run) {
        const wr = on.workflow_run;
        const list = Array.isArray(wr?.workflows) ? wr.workflows : wr?.workflows ? [wr.workflows] : [];
        for (const n of list) {
          const nn = String(n);
          upstreamNames.push(nn);
        }
        if (list.length > 0) isTesting = true;
      }

      // jobs.*.uses -> parent calls reusable workflows (treat parent as trigger)
      const jobs = parsed?.jobs || {};
      const calledLocalFiles: string[] = [];
      for (const j of Object.values(jobs) as any[]) {
        if (!j) continue;
        const u = j.uses || j?.with?.uses;
        if (typeof u === 'string' && u.startsWith('./.github/workflows/')) {
          const usedBase = fileBase(u.replace(/^\.\//, ''));
          calledLocalFiles.push(usedBase);
        }
      }

      // record meta
      workflowsMeta.push({ path: wfPath, name: wfName, isTesting, isTrigger: calledLocalFiles.length > 0, isReusable });

      // Map testing -> trigger by names declared in workflow_run
      for (const up of upstreamNames) {
        const testingFile = base;
        addMap(up, testingFile, nameToTesting);
      }

      // Map trigger by called local reusable workflows (parent is trigger)
      for (const used of calledLocalFiles) {
        const triggerKeyFile = base; // parent file
        const arr = fileToTesting[triggerKeyFile] || (fileToTesting[triggerKeyFile] = []);
        if (!arr.includes(used)) arr.push(used);
      }
    }

    // Build reverse map
    const testingToTrigger: Record<string, string[]> = {};
    const merge = (target: Record<string, string[]>, key: string, val: string) => {
      const arr = target[key] || (target[key] = []);
      if (!arr.includes(val)) arr.push(val);
    };
    for (const [k, list] of Object.entries(nameToTesting)) {
      for (const t of list) merge(testingToTrigger, t, k);
    }
    for (const [k, list] of Object.entries(fileToTesting)) {
      for (const t of list) merge(testingToTrigger, t, k);
    }

    const payload = {
      repoPath,
      workflows: workflowsMeta,
      nameToTesting, // key: normalized workflow name -> testing file basenames
      fileToTesting, // key: trigger file basename -> testing file basenames
      testingToTrigger,
    };

    // Save to in-memory cache
    try {
      const globalCache = ((globalThis as any).__triggerMapApiCache ||= {
        data: new Map<string, { ts: number; value: any }>(),
        ttlMs: 5 * 60 * 1000,
      });
      globalCache.data.set(cacheKey, { ts: Date.now(), value: payload });
    } catch {}

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to build trigger map' }, { status: 500 });
  }
}


