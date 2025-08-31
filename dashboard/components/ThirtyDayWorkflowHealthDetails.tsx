"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkflowRun } from "@/lib/github";

import { CheckCircle, TrendingUp, TrendingDown, ArrowDown } from "lucide-react";

interface Props {
  repoSlug: string;
  repoPath?: string | null;
}

type SimpleRun = {
  id: number;
  workflow_id: number;
  name: string;
  path?: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  run_started_at: string;
  updated_at: string;
};

type Grouped = {
  consistent: SimpleRun[];
  improved: SimpleRun[];
  regressed: SimpleRun[];
  regressing: SimpleRun[]; // still failing
};

function pickLatestPerWorkflow(runs: WorkflowRun[]): Map<number, SimpleRun> {
  const byWorkflow = new Map<number, SimpleRun>();
  runs.forEach((r) => {
    const existing = byWorkflow.get(r.workflow_id);
    if (!existing) {
      byWorkflow.set(r.workflow_id, r as unknown as SimpleRun);
      return;
    }
    const prev = new Date(existing.run_started_at || existing.updated_at).getTime();
    const cur = new Date(r.run_started_at || r.updated_at).getTime();
    if (cur > prev) byWorkflow.set(r.workflow_id, r as unknown as SimpleRun);
  });
  return byWorkflow;
}

function statusOf(run: SimpleRun | undefined): "passed" | "failed" | "running" | "missing" {
  if (!run) return "missing";
  if (run.conclusion === "success") return "passed";
  if (run.conclusion === null && (run.status === "in_progress" || run.status === "queued")) return "running";
  return "failed";
}

export default function ThirtyDayWorkflowHealthDetails({ repoSlug, repoPath }: Props) {
  const repoConfigured = !!repoPath;
  const endForKey = format(new Date(), 'yyyy-MM-dd');
  const storageKey = React.useMemo(() => {
    const id = repoPath || repoSlug;
    return `report-cache-30-details-${id}-${endForKey}`;
  }, [repoPath, repoSlug, endForKey]);

  const { data, isLoading } = useQuery<{ groups: Grouped } | undefined>({
    queryKey: ["report-30-health-details", repoSlug, repoPath || null],
    enabled: repoConfigured,
    staleTime: 60 * 1000, // keep for 60s to avoid refetch storms
    cacheTime: 5 * 60 * 1000,
    initialData: (() => {
      if (typeof window === 'undefined') return undefined;
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as { ts: number; payload: any };
        if (parsed && parsed.payload && Date.now() - parsed.ts < 10 * 60 * 1000) {
          return parsed.payload;
        }
      } catch {}
      return undefined;
    })(),
    queryFn: async () => {
      const end = new Date();
      const start = subDays(end, 30);
      const base = repoPath ? `repoPath=${encodeURIComponent(repoPath)}` : `repo=${encodeURIComponent(repoSlug)}`;
      const qs = `${base}&start=${format(start, "yyyy-MM-dd")}&end=${format(end, "yyyy-MM-dd")}`;
      const sevenStart = subDays(end, 7);
      const res = await fetch(`/api/workflows/range?${qs}`);
      if (!res.ok) return { groups: { consistent: [], improved: [], regressed: [], regressing: [] } };
      const json = await res.json();
      const all: WorkflowRun[] = json.workflow_runs || [];

      // Bucket by ISO day
      const byDay = new Map<string, WorkflowRun[]>();
      for (const r of all) {
        const day = new Date(r.run_started_at || r.updated_at).toISOString().slice(0, 10);
        const arr = byDay.get(day) || [];
        arr.push(r as any);
        byDay.set(day, arr);
      }

      const sortedDays = Array.from(byDay.keys()).sort();
      if (sortedDays.length === 0) return { groups: { consistent: [], improved: [], regressed: [], regressing: [] } };

      // Build per-workflow run history across the 30-day window
      const runsByWorkflow = new Map<number, SimpleRun[]>();
      for (const r of all) {
        const arr = runsByWorkflow.get(r.workflow_id) || [];
        arr.push(r as unknown as SimpleRun);
        runsByWorkflow.set(r.workflow_id, arr);
      }
      // Sort each workflow's runs by time ascending
      for (const [id, arr] of runsByWorkflow) {
        arr.sort((a, b) => new Date(a.run_started_at || a.updated_at).getTime() - new Date(b.run_started_at || b.updated_at).getTime());
      }

      // Latest run across window for display
      const latestAcross = new Map<number, SimpleRun>();
      for (const [id, arr] of runsByWorkflow) {
        latestAcross.set(id, arr[arr.length - 1]);
      }

      // Categorize by counts over the window
      const buckets: Grouped = { consistent: [], improved: [], regressed: [], regressing: [] };
      for (const [id, arr] of runsByWorkflow) {
        const statuses = arr.map((r) => statusOf(r)).filter((s) => s !== "running");
        if (statuses.length === 0) continue;
        const passCount = statuses.filter((s) => s === "passed").length;
        const failCount = statuses.filter((s) => s === "failed").length;
        // Last 7 days snapshot for consistency check
        const last7 = arr.filter((r) => new Date(r.run_started_at || r.updated_at).getTime() >= sevenStart.getTime());
        const last7Statuses = last7.map((r) => statusOf(r)).filter((s) => s !== "running");
        const last7PassCount = last7Statuses.filter((s) => s === "passed").length;
        const last7FailCount = last7Statuses.filter((s) => s === "failed").length;

        if (failCount > 0 && passCount === 0) {
          buckets.regressing.push(latestAcross.get(id)!);
          continue;
        }
        // New Consistent definition: more passes than failures over 30 days AND no failures in the last 7 days (and at least one pass in last 7)
        if (passCount > failCount && last7FailCount === 0 && last7PassCount > 0) {
          buckets.consistent.push(latestAcross.get(id)!);
          continue;
        }
        if (passCount > failCount) {
          buckets.improved.push(latestAcross.get(id)!);
        } else if (failCount > passCount) {
          buckets.regressed.push(latestAcross.get(id)!);
        } else {
          // equal counts: do not categorize
        }
      }

      // Sort each group alphabetically by workflow display
      const sortByName = (a: SimpleRun, b: SimpleRun) => {
        const aName = (a.path || a.name || "").toString().split("/").pop()?.toLowerCase() || "";
        const bName = (b.path || b.name || "").toString().split("/").pop()?.toLowerCase() || "";
        return aName.localeCompare(bName);
      };
      buckets.consistent.sort(sortByName);
      buckets.improved.sort(sortByName);
      buckets.regressed.sort(sortByName);
      buckets.regressing.sort(sortByName);

      const payload = { groups: buckets };
      try { if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify({ ts: Date.now(), payload })); } catch {}
      return payload;
    },
  });

  const groups = data?.groups || { consistent: [], improved: [], regressed: [], regressing: [] };

  const Section = ({
    title,
    color,
    icon,
    items,
  }: {
    title: string;
    color: string;
    icon: React.ReactNode;
    items: SimpleRun[];
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className={color}>{icon}</span>
          <span className="text-muted-foreground">{title}</span>
        </div>
        <div className="text-sm font-semibold tabular-nums">{items.length}</div>
      </div>
      <div className="rounded border border-border">
        {items.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">None</div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((w) => {
              const display = (() => {
                const src = (w.path || w.name || "").toString();
                const base = (src.split("/").pop() || src).replace(/\.ya?ml$/i, "");
                return base.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
              })();
              return (
                <li key={w.id} className="flex items-center px-3 py-2 text-sm">
                  <span className="truncate" title={display}>{display}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">30 Day Workflow Health</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-24" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Section
              title="Consistent"
              color="text-green-600"
              icon={<CheckCircle className="h-4 w-4" />}
              items={groups.consistent}
            />
            <Section
              title="Improved"
              color="text-blue-600"
              icon={<TrendingUp className="h-4 w-4" />}
              items={groups.improved}
            />
            <Section
              title="Regressed"
              color="text-orange-600"
              icon={<TrendingDown className="h-4 w-4" />}
              items={groups.regressed}
            />
            <Section
              title="Still Failing"
              color="text-red-600"
              icon={<ArrowDown className="h-4 w-4" />}
              items={groups.regressing}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}


