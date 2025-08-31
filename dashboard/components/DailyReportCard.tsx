"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, XCircle, ArrowDown, ArrowUp } from "lucide-react";
import type { WorkflowRun } from "@/lib/github";


type OverviewData = {
  completedRuns: number;
  inProgressRuns: number;
  passedRuns: number;
  failedRuns: number;
  totalRuntime: number;
  didntRunCount: number;
  totalWorkflows: number;
  missingWorkflows: string[];
};

type RunsChartType = 'bars' | 'area' | 'top';
type MetricsChartType = 'bars' | 'pie';

interface Props {
  repoSlug: string;
  todayRuns: WorkflowRun[];
  yesterdayRuns: WorkflowRun[];
  overview: OverviewData;
  runsChart?: RunsChartType;
  metricsChart?: MetricsChartType;
  sparkWidth?: number;
  sparkHeight?: number;
}

function Donut({ passed, failed }: { passed: number; failed: number }) {
  const total = Math.max(1, passed + failed);
  const radius = 36;
  const C = 2 * Math.PI * radius;
  const passedPct = passed / total;
  const failedPct = failed / total;
  return (
    <div className="relative w-[96px] h-[96px]">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        {passed > 0 && (
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="rgb(34, 197, 94)"
            strokeWidth="10"
            strokeDasharray={C}
            strokeDashoffset={C - passedPct * C}
            strokeLinecap="round"
          />
        )}
        {failed > 0 && (
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="rgb(239, 68, 68)"
            strokeWidth="10"
            strokeDasharray={C}
            strokeDashoffset={C - failedPct * C}
            transform={`rotate(${passedPct * 360} 48 48)`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-sm font-semibold">{Math.round((passed / total) * 100)}%</div>
      </div>
    </div>
  );
}

function MetricsHorizontalBars({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
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
          <div className="w-6 text-right">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function AreaSpark({ runs, width = 420, height = 120 }: { runs: WorkflowRun[]; width?: number; height?: number }) {
  const buckets = new Array(24).fill(0) as number[];
  runs.forEach((r) => {
    const h = new Date(r.run_started_at).getHours();
    buckets[h] += 1;
  });
  const max = Math.max(1, ...buckets);
  const pad = 8;
  const stepX = (width - pad * 2) / 23;
  const points = buckets.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - (v / max) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ');
  const lastX = pad + (buckets.length - 1) * stepX;
  const area = `${path} L ${lastX} ${height - pad} L ${pad} ${height - pad} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="block mx-auto">
      <path d={area} fill="rgba(255,255,255,0.15)" />
      <path d={path} stroke="white" strokeWidth={2} fill="none" />
    </svg>
  );
}

function HourlyLegend({ runs }: { runs: WorkflowRun[] }) {
  const counts = new Array(24).fill(0) as number[];
  runs.forEach((r) => {
    const h = new Date(r.run_started_at).getHours();
    counts[h] += 1;
  });
  const vals = counts;
  const total = vals.reduce((a, b) => a + b, 0);
  const avg = vals.length > 0 ? Math.round(total / vals.length) : 0;
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
      <div className="flex items-center gap-2 text-purple-400">
        <Clock className="h-4 w-4" />
        <span>Avg</span>
        <span className="font-semibold tabular-nums text-foreground">{avg}</span>
      </div>
      <div className="flex items-center gap-2 text-green-500">
        <ArrowDown className="h-4 w-4" />
        <span>Min</span>
        <span className="font-semibold tabular-nums text-foreground">{min}</span>
      </div>
      <div className="flex items-center gap-2 text-red-500">
        <ArrowUp className="h-4 w-4" />
        <span>Max</span>
        <span className="font-semibold tabular-nums text-foreground">{max}</span>
      </div>
    </div>
  );
}

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

function CategoryBars({ runs, repoSlug }: { runs: WorkflowRun[]; repoSlug: string }) {
  // Since we removed categorization, show a simple summary
  const totalWorkflows = runs.length;
  const completedWorkflows = runs.filter(r => r.status === 'completed').length;
  const failedWorkflows = runs.filter(r => r.conclusion === 'failure').length;
  
  const rows = [
    { label: 'Total Workflows', value: totalWorkflows },
    { label: 'Completed', value: completedWorkflows },
    { label: 'Failed', value: failedWorkflows }
  ];
  
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate">{r.label}</span>
            <span>{r.value}</span>
          </div>
          <div className="h-2 rounded bg-muted overflow-hidden">
            <div className="h-2 bg-primary" style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DailyReportCard({ repoSlug, todayRuns, yesterdayRuns, overview, runsChart = 'area', metricsChart = 'bars', sparkWidth = 357, sparkHeight = 102 }: Props) {
  const { consistent, improved, regressed, regressing } = compareDaily(todayRuns, yesterdayRuns);
  const totalDaily = consistent + improved + regressed + regressing;
  const metricSegments = [
    { label: 'Consistent', value: consistent, color: 'rgb(34, 197, 94)' },
    { label: 'Improved', value: improved, color: 'rgb(59, 130, 246)' },
    { label: 'Regressed', value: regressed, color: 'rgb(249, 115, 22)' },
    { label: 'Still failing', value: regressing, color: 'rgb(239, 68, 68)' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Daily Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left: Overview */}
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Overview</div>
            <div className="flex items-center gap-4">
              <Donut passed={overview.passedRuns} failed={overview.failedRuns} />
              <div className="space-y-2 text-sm min-w-[260px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground w-40">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Completed</span>
                  </div>
                  <div className="font-semibold tabular-nums">{overview.completedRuns}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground w-40">
                    <Clock className="h-4 w-4 text-purple-500" />
                    <span>Total Runtime</span>
                  </div>
                  <div className="font-semibold tabular-nums">{formatDuration(overview.totalRuntime)}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground w-40">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>Didn’t run</span>
                  </div>
                  <div className="font-semibold tabular-nums">{overview.didntRunCount}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle: Health */}
          <div className="space-y-4 min-h-[128px]">
            <div className="text-sm text-muted-foreground">Health</div>
            {metricsChart === 'bars' ? (
              <MetricsHorizontalBars segments={metricSegments} />
            ) : (
              <div className="flex items-center gap-4">
                <MiniPie segments={metricSegments.map(({ color, value }) => ({ color, value, label: '' })) as any} />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Legend color="bg-green-500" label="Consistent" value={consistent} />
                  <Legend color="bg-blue-500" label="Improved" value={improved} />
                  <Legend color="bg-orange-500" label="Regressed" value={regressed} />
                  <Legend color="bg-red-500" label="Still failing" value={regressing} />
                </div>
              </div>
            )}
          </div>

          {/* Right: Runs by hour */}
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Runs by hour</div>
            {runsChart === 'area' ? (
              <>
                <AreaSpark runs={todayRuns} width={sparkWidth} height={sparkHeight} />
                <HourlyLegend runs={todayRuns} />
              </>
            ) : (
              <CategoryBars runs={todayRuns} repoSlug={repoSlug} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function MiniPie({ segments }: { segments: Array<{ color: string; value: number; label: string }> }) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const radius = 34;
  const C = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="relative w-[90px] h-[90px]">
      <svg width="90" height="90" className="-rotate-90">
        <circle cx="45" cy="45" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        {segments.map((s, i) => {
          const pct = s.value / total;
          const el = (
            <circle
              key={i}
              cx="45"
              cy="45"
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth="10"
              strokeDasharray={C}
              strokeDashoffset={C - pct * C}
              transform={`rotate(${offset * 360} 45 45)`}
              strokeLinecap="butt"
            />
          );
          offset += pct;
          return el;
        })}
      </svg>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded ${color}`} />
      <span className="truncate">{label}</span>
      <span className="ml-auto font-semibold">{value}</span>
    </div>
  );
}


