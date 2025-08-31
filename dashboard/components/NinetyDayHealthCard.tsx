"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkflowRun } from "@/lib/github";

import { CheckCircle, XCircle, Clock, ArrowDown, ArrowUp } from "lucide-react";

interface Props {
  repoSlug: string;
  repoPath?: string | null;
}

type Segment = { label: string; value: number; color: string };

function compareDaily(todayRuns: WorkflowRun[], yesterdayRuns: WorkflowRun[]) {
  const yMap = new Map<number, string>();
  yesterdayRuns.forEach((r) => {
    const s = r.conclusion === 'success' ? 'passed' : (r.conclusion === null && r.status === 'in_progress') ? 'running' : 'failed';
    yMap.set(r.workflow_id, s);
  });
  let consistent = 0, improved = 0, regressed = 0, regressing = 0;
  todayRuns.forEach((r) => {
    const s = r.conclusion === 'success' ? 'passed' : (r.conclusion === null && r.status === 'in_progress') ? 'running' : 'failed';
    if (s === 'running') return;
    const ys = yMap.get(r.workflow_id) || 'unknown';
    if (s === 'passed' && ys === 'passed') consistent++;
    else if (s === 'passed' && ys === 'failed') improved++;
    else if (s === 'failed' && ys === 'passed') regressed++;
    else if (s === 'failed' && ys === 'failed') regressing++;
  });
  return { consistent, improved, regressed, regressing };
}

function Bars({ segments }: { segments: Segment[] }) {
  const max = Math.max(1, ...segments.map((s) => s.value));
  return (
    <div className="space-y-3">
      {segments.map((s) => (
        <div key={s.label} className="flex items-center gap-3 text-sm">
          <div className="w-28 truncate text-muted-foreground flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="truncate">{s.label}</span>
          </div>
          <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
            <div className="h-2" style={{ width: `${Math.round((s.value / max) * 100)}%`, background: s.color }} />
          </div>
          <div className="w-8 text-right tabular-nums">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function NinetyDayHealthCard({ repoSlug, repoPath }: Props) {
  const repoConfigured = !!repoPath;
  const endForKey = format(new Date(), 'yyyy-MM-dd');
  const storageKey = React.useMemo(() => {
    const id = repoPath || repoSlug;
    return `report-cache-90-${id}-${endForKey}`;
  }, [repoPath, repoSlug, endForKey]);

  const { data, isLoading } = useQuery({
    queryKey: ["report-90-health-range", repoSlug, repoPath || null],
    enabled: repoConfigured,
    staleTime: 60 * 1000, // 60s - aligns with API cache
    cacheTime: 5 * 60 * 1000,
    initialData: (() => {
      if (typeof window === 'undefined') return undefined;
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as { ts: number; payload: any };
        // 10 min TTL for 90-day metrics
        if (parsed && parsed.payload && Date.now() - parsed.ts < 10 * 60 * 1000) {
          return parsed.payload;
        }
      } catch {}
      return undefined;
    })(),
    queryFn: async () => {
      const end = new Date();
      const start = subDays(end, 90);
      const base = repoPath ? `repoPath=${encodeURIComponent(repoPath)}` : `repo=${encodeURIComponent(repoSlug)}`;
      const qs = `${base}&start=${format(start, 'yyyy-MM-dd')}&end=${format(end, 'yyyy-MM-dd')}`;
      const res = await fetch(`/api/workflows/range?${qs}`);
      if (!res.ok) return { consistent: 0, improved: 0, regressed: 0, regressing: 0, passCount: 0, failCount: 0, dailyAvgRuntime: [] };
      const json = await res.json();
      const all: WorkflowRun[] = json.workflow_runs || [];

      const byDay = new Map<string, WorkflowRun[]>();
      for (const r of all) {
        const day = new Date(r.run_started_at || r.updated_at).toISOString().slice(0, 10);
        const arr = byDay.get(day) || [];
        arr.push(r as any);
        byDay.set(day, arr);
      }
      const sortedDays = Array.from(byDay.keys()).sort();
      let consistent = 0, improved = 0, regressed = 0, regressing = 0;
      let passCount = 0, failCount = 0;
      const dailyAvgRuntime: number[] = [];
      for (let i = 0; i < sortedDays.length; i++) {
        const day = sortedDays[i];
        const runs = byDay.get(day)!;
        let totalSec = 0, c = 0;
        for (const r of runs) {
          if ((r as any).conclusion === 'success') passCount++;
          else if ((r as any).conclusion === 'failure') failCount++;
          if ((r as any).status === 'completed') {
            const s = new Date((r as any).run_started_at).getTime();
            const e = new Date((r as any).updated_at).getTime();
            totalSec += Math.max(0, Math.floor((e - s) / 1000));
            c++;
          }
        }
        dailyAvgRuntime.push(c > 0 ? Math.round(totalSec / c) : 0);

        if (i === 0) continue;
        const prev = byDay.get(sortedDays[i - 1])!;
        const cmp = compareDaily(runs as any, prev as any);
        consistent += cmp.consistent;
        improved += cmp.improved;
        regressed += cmp.regressed;
        regressing += cmp.regressing;
      }

      const payload = { consistent, improved, regressed, regressing, passCount, failCount, dailyAvgRuntime };
      // Persist for instant reloads
      try { if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify({ ts: Date.now(), payload })); } catch {}
      return payload;
    }
  });

  const segments: Segment[] = [
    { label: 'Consistent', value: data?.consistent || 0, color: 'rgb(34, 197, 94)' },
    { label: 'Improved', value: data?.improved || 0, color: 'rgb(59, 130, 246)' },
    { label: 'Regressed', value: data?.regressed || 0, color: 'rgb(249, 115, 22)' },
    { label: 'Still failing', value: data?.regressing || 0, color: 'rgb(239, 68, 68)' },
  ];

  const pass = data?.passCount || 0;
  const fail = data?.failCount || 0;
  const avgArr = data?.dailyAvgRuntime || [];
  const avgOverall = (() => {
    const vals = avgArr.filter((v: number) => v > 0);
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length);
  })();
  const minOverall = (() => {
    const vals = avgArr.filter((v: number) => v > 0);
    if (vals.length === 0) return 0;
    return Math.min(...vals);
  })();
  const maxOverall = avgArr.length ? Math.max(...avgArr) : 0;

  function Donut({ passed, failed }: { passed: number; failed: number }) {
    const total = Math.max(1, passed + failed);
    const r = 36; const C = 2 * Math.PI * r;
    const passPct = passed / total;
    const failPct = failed / total;
    return (
      <div className="relative w-[96px] h-[96px]">
        <svg width="96" height="96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          {passed > 0 && (
            <circle cx="48" cy="48" r={r} fill="none" stroke="rgb(34, 197, 94)" strokeWidth="10" strokeDasharray={C} strokeDashoffset={C - passPct * C} strokeLinecap="round" />
          )}
          {failed > 0 && (
            <circle cx="48" cy="48" r={r} fill="none" stroke="rgb(239, 68, 68)" strokeWidth="10" strokeDasharray={C} strokeDashoffset={C - failPct * C} transform={`rotate(${passPct * 360} 48 48)`} strokeLinecap="round" />
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-sm font-semibold">{Math.round((passed / total) * 100)}%</div>
      </div>
    );
  }

  function formatShort(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function RuntimeSpark({ values, width = 360, height = 80 }: { values: number[]; width?: number; height?: number }) {
    const pad = 8;
    const vals = values.length > 0 ? values : [0];
    const max = Math.max(1, ...vals);
    const stepX = (width - pad * 2) / Math.max(1, vals.length - 1);
    const points = vals.map((v, i) => {
      const x = pad + i * stepX;
      const y = height - pad - (v / max) * (height - pad * 2);
      return [x, y] as const;
    });
    const path = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ');
    const lastX = pad + (vals.length - 1) * stepX;
    const area = `${path} L ${lastX} ${height - pad} L ${pad} ${height - pad} Z`;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="block w-full">
        <path d={area} fill="rgba(255,255,255,0.15)" />
        <path d={path} stroke="white" strokeWidth={2} fill="none" />
      </svg>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">90 Day Health</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-20" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16 items-start">
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Pass/fail</div>
              <div className="flex items-center gap-4">
                <Donut passed={pass} failed={fail} />
                <div className="space-y-2 text-sm min-w-[120px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Pass</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>Fail</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Health</div>
              <Bars segments={segments} />
            </div>
            <div className="space-y-3 w-full overflow-hidden lg:col-span-2">
              <div className="text-sm text-muted-foreground">Avg runtime</div>
              <RuntimeSpark values={avgArr} />
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2 text-purple-400">
                  <Clock className="h-4 w-4" />
                  <span>Avg</span>
                  <span className="font-semibold tabular-nums text-foreground">{formatShort(avgOverall)}</span>
                </div>
                <div className="flex items-center gap-2 text-green-500">
                  <ArrowDown className="h-4 w-4" />
                  <span>Min</span>
                  <span className="font-semibold tabular-nums text-foreground">{formatShort(minOverall)}</span>
                </div>
                <div className="flex items-center gap-2 text-red-500">
                  <ArrowUp className="h-4 w-4" />
                  <span>Max</span>
                  <span className="font-semibold tabular-nums text-foreground">{formatShort(maxOverall)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


