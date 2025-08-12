"use client";

import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { getRepoConfig } from "@/lib/utils";
import { getRepoNameFromEnv } from "@/lib/github";
// no need for env-mapped repo name here; use same transformation as dashboard
import DailyReportCard from "@/components/DailyReportCard";
import ThirtyDayHealthCard from "@/components/ThirtyDayHealthCard";
import NinetyDayHealthCard from "@/components/NinetyDayHealthCard";
import ThirtyDayWorkflowHealthDetails from "@/components/ThirtyDayWorkflowHealthDetails";

import type { WorkflowRun } from "@/lib/github";

interface PageProps {
  params: { slug: string };
}

function useDaily(repoSlug: string, date: Date, repoPath?: string | null) {
  return useQuery({
    queryKey: ["report-daily", repoSlug, repoPath || null, format(date, "yyyy-MM-dd")],
    queryFn: async () => {
      const qs = `date=${format(date, "yyyy-MM-dd")}&${repoPath ? `repoPath=${encodeURIComponent(repoPath)}` : `repo=${encodeURIComponent(repoSlug)}`}`;
      const url = `/api/workflows?${qs}&_t=${Date.now()}`;
      const res = await fetch(url, { headers: { "Cache-Control": "no-store" } });
      if (!res.ok) throw new Error("Failed to fetch daily data");
      return res.json();
    },
    enabled: !!getRepoConfig(repoSlug) || !!repoPath,
  });
}

// Same helper used in dashboard page
function formatRepoDisplayName(repoName: string): string {
  const repoNamePart = repoName.split('/').pop() || repoName;
  return repoNamePart
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l: string) => l.toUpperCase())
    .trim();
}

function SegmentedBar({ segments }: { segments: Array<{ color: string; value: number; label: string }> }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="w-full h-3 rounded bg-muted overflow-hidden flex">
      {segments.map((s, i) => (
        <div
          key={i}
          className={s.color}
          style={{ width: `${(s.value / total) * 100}%` }}
          title={`${s.label}: ${s.value}`}
        />
      ))}
    </div>
  );
}

export default function ReportPage({ params }: PageProps) {
  const repoSlug = params.slug;
  const repoConfig = getRepoConfig(repoSlug);
  const today = new Date();
  const yesterday = subDays(today, 1);
  const queryClient = useQueryClient();

  // Resolve local repoPath if this is a locally added repository
  const [repoPath, setRepoPath] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("userAddedRepos");
      if (stored) {
        const parsed = JSON.parse(stored) as Array<any>;
        const found = parsed.find((r) => r.slug === repoSlug);
        setRepoPath(found?.repoPath || null);
      } else {
        setRepoPath(null);
      }
    } catch {
      setRepoPath(null);
    }
  }, [repoSlug]);

  const { data: todayData } = useDaily(repoSlug, today, repoPath);
  const { data: yData } = useDaily(repoSlug, yesterday, repoPath);

  const todayRuns: WorkflowRun[] = todayData?.workflowRuns || [];
  const yRuns: WorkflowRun[] = yData?.workflowRuns || [];

  // Prefetch 30-day and 90-day range + 30-day details to make cards instant on refresh
  useEffect(() => {
    const doPrefetch = async () => {
      const configured = !!repoConfig || !!repoPath;
      if (!configured) return;
      const end = new Date();
      const start30 = subDays(end, 30);
      const start90 = subDays(end, 90);
      const qp = repoPath
        ? `repoPath=${encodeURIComponent(repoPath)}`
        : `repo=${encodeURIComponent(repoSlug)}`; // allow server to resolve slug to env repoPath

      // 30-day range
      queryClient.prefetchQuery({
        queryKey: ["report-30-health-range", repoSlug, repoPath || null],
        queryFn: async () => {
          const qs = `${qp}&start=${format(start30, "yyyy-MM-dd")}&end=${format(end, "yyyy-MM-dd")}`;
          const res = await fetch(`/api/workflows/range?${qs}`);
          if (!res.ok) return { workflow_runs: [] } as any;
          return res.json();
        },
        staleTime: 60 * 1000,
        cacheTime: 5 * 60 * 1000,
      });

      // 90-day range
      queryClient.prefetchQuery({
        queryKey: ["report-90-health-range", repoSlug, repoPath || null],
        queryFn: async () => {
          const qs = `${qp}&start=${format(start90, "yyyy-MM-dd")}&end=${format(end, "yyyy-MM-dd")}`;
          const res = await fetch(`/api/workflows/range?${qs}`);
          if (!res.ok) return { workflow_runs: [] } as any;
          return res.json();
        },
        staleTime: 60 * 1000,
        cacheTime: 5 * 60 * 1000,
      });

      // 30-day details uses the same range endpoint under the hood. Prefetching 30-day range is sufficient,
      // but also seed the details query key to avoid the initial network turn.
      queryClient.prefetchQuery({
        queryKey: ["report-30-health-details", repoSlug, repoPath || null],
        queryFn: async () => {
          const qs = `${qp}&start=${format(start30, "yyyy-MM-dd")}&end=${format(end, "yyyy-MM-dd")}`;
          const res = await fetch(`/api/workflows/range?${qs}`);
          if (!res.ok) return { workflow_runs: [] } as any;
          return res.json();
        },
        staleTime: 60 * 1000,
        cacheTime: 5 * 60 * 1000,
      });
    };
    doPrefetch();
  }, [repoSlug, repoConfig, repoPath, queryClient]);

  // Today vs Yesterday summary
  const tPassed = todayRuns.filter((r) => r.conclusion === "success").length;
  const tFailed = todayRuns.filter((r) => r.conclusion === "failure").length;
  const yPassed = yRuns.filter((r) => r.conclusion === "success").length;
  const yFailed = yRuns.filter((r) => r.conclusion === "failure").length;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/${repoSlug}`} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <BarChart3 className="h-6 w-6" /> {(() => {
                  const base = formatRepoDisplayName(getRepoNameFromEnv(repoSlug));
                  const noLocal = base.replace(/^Local\s+/i, '').trim();
                  return /central\s+testing/i.test(noLocal) ? 'Central Testing' : noLocal;
                })()} Report
              </h1>
              <p className="text-muted-foreground">{format(today, "EEEE, MMM d, yyyy")}</p>
            </div>
          </div>
          
        </div>
      </header>

      <DailyReportCard
        repoSlug={repoSlug}
        todayRuns={todayRuns}
        yesterdayRuns={yRuns}
        overview={todayData?.overviewData || { completedRuns: 0, inProgressRuns: 0, passedRuns: 0, failedRuns: 0, totalRuntime: 0, didntRunCount: 0, totalWorkflows: 0, missingWorkflows: [] }}
        runsChart="area"
        metricsChart="bars"
        sparkWidth={357}
        sparkHeight={102}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 compact-gap">
        <ThirtyDayHealthCard repoSlug={repoSlug} repoPath={repoPath} />
        <NinetyDayHealthCard repoSlug={repoSlug} repoPath={repoPath} />
      </div>

      <ThirtyDayWorkflowHealthDetails repoSlug={repoSlug} repoPath={repoPath} />

      
    </div>
  );
}


