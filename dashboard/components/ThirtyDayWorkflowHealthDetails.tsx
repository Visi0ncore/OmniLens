"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkflowRun } from "@/lib/github";
import { getRepoConfig } from "@/lib/utils";
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
  const repoConfigured = !!getRepoConfig(repoSlug) || !!repoPath;

  const { data, isLoading } = useQuery<{ groups: Grouped } | undefined>({
    queryKey: ["report-30-health-details", repoSlug, repoPath || null],
    enabled: repoConfigured,
    queryFn: async () => {
      const end = new Date();
      const start = subDays(end, 30);
      const qs = `repoPath=${encodeURIComponent(repoPath || "")}&start=${format(start, "yyyy-MM-dd")}&end=${format(end, "yyyy-MM-dd")}`;
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

      // Build per-day maps of latest runs per workflow
      const perDayMaps: Array<Map<number, SimpleRun>> = sortedDays.map((d) => pickLatestPerWorkflow(byDay.get(d) || []));

      // Track latest run across the 30-day window per workflow for display
      const latestAcross = new Map<number, SimpleRun>();
      for (const r of all) {
        const existing = latestAcross.get(r.workflow_id);
        if (!existing) {
          latestAcross.set(r.workflow_id, r as unknown as SimpleRun);
        } else {
          const prev = new Date(existing.run_started_at || existing.updated_at).getTime();
          const cur = new Date(r.run_started_at || r.updated_at).getTime();
          if (cur > prev) latestAcross.set(r.workflow_id, r as unknown as SimpleRun);
        }
      }

      // Accumulate transitions across consecutive days
      const counts = new Map<number, { consistent: number; improved: number; regressed: number; regressing: number }>();
      const inc = (id: number, key: keyof { consistent: number; improved: number; regressed: number; regressing: number }) => {
        const cur = counts.get(id) || { consistent: 0, improved: 0, regressed: 0, regressing: 0 };
        cur[key] += 1;
        counts.set(id, cur);
      };

      for (let i = 1; i < perDayMaps.length; i++) {
        const prev = perDayMaps[i - 1];
        const cur = perDayMaps[i];
        for (const id of cur.keys()) {
          if (!prev.has(id)) continue; // require presence on both days
          const t = cur.get(id);
          const y = prev.get(id);
          const ts = statusOf(t);
          const ys = statusOf(y);
          if (ts === "running") continue;
          if (ts === "passed" && ys === "passed") inc(id, "consistent");
          else if (ts === "passed" && ys === "failed") inc(id, "improved");
          else if (ts === "failed" && ys === "passed") inc(id, "regressed");
          else if (ts === "failed" && ys === "failed") inc(id, "regressing");
        }
      }

      // Assign to dominant category over window with severity priority
      const buckets: Grouped = { consistent: [], improved: [], regressed: [], regressing: [] };
      const priority: Array<keyof Grouped> = ["regressing", "regressed", "improved", "consistent"];
      for (const [id, c] of counts) {
        const maxVal = Math.max(c.consistent, c.improved, c.regressed, c.regressing);
        if (maxVal === 0) continue;
        const candidates: Array<keyof Grouped> = [];
        if (c.regressing === maxVal) candidates.push("regressing");
        if (c.regressed === maxVal) candidates.push("regressed");
        if (c.improved === maxVal) candidates.push("improved");
        if (c.consistent === maxVal) candidates.push("consistent");
        const chosen = priority.find((k) => candidates.includes(k)) || "consistent";
        const run = latestAcross.get(id);
        if (run) buckets[chosen].push(run);
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

      return { groups: buckets };
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
      <div className="rounded border border-border max-h-64 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
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


