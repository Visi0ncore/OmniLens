"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, XCircle, ArrowDown, ArrowUp } from "lucide-react";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { RadialBar, RadialBarChart, Bar, BarChart, PieChart, Pie, Cell } from "recharts";
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
  const passedPercentage = Math.round((passed / total) * 100);

  // Prepare data for the radial bar chart
  const chartData = [
    {
      name: "Passed",
      value: passed,
      fill: "hsl(var(--chart-1))"
    },
    {
      name: "Failed", 
      value: failed,
      fill: "hsl(var(--chart-2))"
    }
  ];

  const chartConfig = {
    Passed: {
      label: "Passed",
      color: "hsl(var(--chart-1))",
    },
    Failed: {
      label: "Failed", 
      color: "hsl(var(--chart-2))",
    },
  };

  return (
    <div className="relative w-[96px] h-[96px]">
      <ChartContainer
        config={chartConfig}
        className="h-full w-full"
      >
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={45}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-sm font-semibold">{passedPercentage}%</div>
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

function AreaSpark({ runs }: { runs: WorkflowRun[] }) {
  const buckets = new Array(24).fill(0) as number[];
  runs.forEach((r) => {
    const h = new Date(r.run_started_at).getHours();
    buckets[h] += 1;
  });
  
  const chartData = buckets.map((count, hour) => ({
    hour: hour.toString(),
    count
  }));

  const chartConfig = {
    count: {
      label: "Runs",
    },
  };

  return (
    <ChartContainer
      config={chartConfig}
      className="h-32"
    >
      <BarChart data={chartData}>
        <Bar dataKey="count" fill="hsl(var(--foreground))" fillOpacity={0.7} />
      </BarChart>
    </ChartContainer>
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
    { label: 'Consistent', value: consistent, color: 'hsl(var(--chart-1))' },
    { label: 'Improved', value: improved, color: 'hsl(var(--chart-2))' },
    { label: 'Regressed', value: regressed, color: 'hsl(var(--chart-3))' },
    { label: 'Still failing', value: regressing, color: 'hsl(var(--chart-4))' },
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
                <AreaSpark runs={todayRuns} />
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
  const chartData = segments.map((segment, index) => ({
    name: segment.label || `Segment ${index + 1}`,
    value: segment.value,
    fill: segment.color
  }));

  const chartConfig = segments.reduce((config, segment, index) => {
    const key = segment.label || `Segment${index + 1}`;
    config[key] = {
      label: segment.label || `Segment ${index + 1}`,
      color: segment.color,
    };
    return config;
  }, {} as any);

  return (
    <div className="relative w-[90px] h-[90px]">
      <ChartContainer
        config={chartConfig}
        className="h-full w-full"
      >
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="90%"
          data={chartData}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={4}
            fill="var(--color-Segment1)"
          />
        </RadialBarChart>
      </ChartContainer>
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


