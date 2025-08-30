"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect, useCallback } from "react";
import { format, isToday } from "date-fns";

import WorkflowCard from "@/components/WorkflowCard";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import ErrorState from "@/components/ErrorState";
import WorkflowMetrics from "@/components/WorkflowMetrics";
import OverviewMetrics from "@/components/OverviewMetrics";
import { DatePicker } from "@/components/DatePicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Target, TestTube, Calendar, Hammer, ArrowLeft, AlertCircle, Plus, Trash2, Settings, CheckCircle, Loader2, BarChart3, Package } from "lucide-react";
import Link from "next/link";
import { getRepoConfig, removeEmojiFromWorkflowName, cleanWorkflowName, filterWorkflowsByCategories, calculateMissingWorkflows, getTestingWorkflowsForTrigger } from "@/lib/utils";

// Helper function to format repository name for display
function formatRepoDisplayName(repoName: string): string {
  // Extract just the repo name part (after the last slash)
  const repoNamePart = repoName.split('/').pop() || repoName;
  
  // Convert kebab-case or snake_case to Title Case
  return repoNamePart
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
    .trim();
}

function NoWorkflowsFound({ repoName }: { repoName: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-xl">
        <div className="border rounded-lg bg-card/60 backdrop-blur-sm p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold mb-4">
            No workflows configured
          </h2>
          <p className="text-sm text-muted-foreground">
            Add workflow files to start monitoring.
          </p>
        </div>
      </div>
    </div>
  );
}

// Types for hover state management
type MetricType = 'consistent' | 'improved' | 'regressed' | 'regressing' | 'didnt_run';
interface HoverState {
  metricType: MetricType | null;
  workflowIds: Set<string | number>; // Support both string IDs (missing workflows) and number IDs (actual workflows)
}

// Helper function to fetch data from API
const fetchWorkflowData = async (date: Date, repoSlug: string) => {
  const dateStr = format(date, "yyyy-MM-dd");
  const timestamp = new Date().toLocaleTimeString();
  
  console.log(`🔄 [${timestamp}] Fetching data for ${dateStr} from repo ${repoSlug}...`);
  // Map local slugs to repoPath if present
  let repoPath: string | null = null;
  try {
    const stored = localStorage.getItem('userAddedRepos');
    if (stored) {
      const parsed = JSON.parse(stored) as Array<any>;
      const found = parsed.find(r => r.slug === repoSlug);
      repoPath = found?.repoPath || null;
    }
  } catch {}

  const url = repoPath
    ? `/api/workflows?date=${dateStr}&repoPath=${encodeURIComponent(repoPath)}&_t=${Date.now()}`
    : `/api/workflows?date=${dateStr}&repo=${encodeURIComponent(repoSlug)}&_t=${Date.now()}`;

  const response = await fetch(url, {
    // Add cache-busting headers to prevent browser caching
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch workflow data');
  }
  
  const data = await response.json();
  console.log(`✅ [${timestamp}] Received data: ${data.workflowRuns?.length || 0} workflow runs from ${repoSlug}`);
  
  return data;
};

interface PageProps {
  params: { slug: string };
}

export default function DashboardPage({ params }: PageProps) {
  const { slug: repoSlug } = params;
  const queryClient = useQueryClient();
  const [addedRepoPath, setAddedRepoPath] = useState<string | null>(null);
  const [reviewedWorkflows, setReviewedWorkflows] = useState<Record<number, boolean>>({});
  const [hoverState, setHoverState] = useState<HoverState>({ metricType: null, workflowIds: new Set() });

  // Initialize with today's date explicitly  
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Helper functions for localStorage with repo context
  const getStorageKey = useCallback((date: Date) => {
    return `reviewedWorkflows-${repoSlug}-${format(date, "yyyy-MM-dd")}`;
  }, [repoSlug]);

  const loadReviewedWorkflows = useCallback((date: Date) => {
    try {
      const stored = localStorage.getItem(getStorageKey(date));
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load reviewed workflows from localStorage:', error);
    }
    return {};
  }, [getStorageKey]);

  const saveReviewedWorkflows = (date: Date, reviewedState: Record<number, boolean>) => {
    try {
      localStorage.setItem(getStorageKey(date), JSON.stringify(reviewedState));
    } catch (error) {
      console.error('Failed to save reviewed workflows to localStorage:', error);
    }
  };

  // Load reviewed workflows when date changes
  useEffect(() => {
    // Detect repoPath for added repos
    try {
      const stored = localStorage.getItem('userAddedRepos');
      if (stored) {
        const parsed = JSON.parse(stored) as Array<any>;
        const found = parsed.find(r => r.slug === repoSlug);
        setAddedRepoPath(found?.repoPath || null);
      } else {
        setAddedRepoPath(null);
      }
    } catch {
      setAddedRepoPath(null);
    }
    const storedReviewed = loadReviewedWorkflows(selectedDate);
    setReviewedWorkflows(storedReviewed);
  }, [selectedDate, loadReviewedWorkflows]);

  const selectedDateStr = format(selectedDate, "EEEE, MMMM d, yyyy");
  const isSelectedDateToday = isToday(selectedDate);

  // Single query for today's data with optimized real-time updates
  const { data: todayData, isLoading: todayLoading, isError: todayError, refetch: refetchToday } = useQuery({
    queryKey: ["workflowData", repoSlug, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      return await fetchWorkflowData(selectedDate, repoSlug);
    },
    enabled: false, // Disable API calls for now - show empty state
    staleTime: isSelectedDateToday ? 0 : 5 * 60 * 1000, // Historical data stays fresh longer
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchInterval: false, // No polling
    refetchIntervalInBackground: false, // No background polling
    refetchOnWindowFocus: false, // No refetch on focus
    refetchOnMount: false, // No refetch when component mounts
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Query for yesterday's data for Daily Metrics comparison
  const { data: yesterdayData, isLoading: yesterdayLoading, refetch: refetchYesterday } = useQuery({
    queryKey: ["yesterdayWorkflowData", repoSlug, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const yesterday = new Date(selectedDate);
      yesterday.setDate(yesterday.getDate() - 1);
      return await fetchWorkflowData(yesterday, repoSlug);
    },
    enabled: false, // Disable API calls for now - show empty state
    staleTime: 5 * 60 * 1000, // Data is stale after 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus for historical data
    refetchOnMount: false, // No refetch when component mounts
  });

  // Extract data from the responses
  const workflowData = todayData?.workflowRuns;
  const overviewData = todayData?.overviewData;
  const yesterdayWorkflowData = yesterdayData?.workflowRuns;

  // Log selected date and yesterday data when available
  React.useEffect(() => {
    if (workflowData) {
      console.log(`\n🏠 === DASHBOARD DATA FOR ${format(selectedDate, "yyyy-MM-dd")} ===`);
      console.log(`⏰ Last updated: ${new Date().toLocaleTimeString()}`);
      
      console.log(`\n📊 SELECTED DATE DATA:`);
      console.log(`  Total workflows: ${workflowData.length}`);
      console.log(`  Overview:`, overviewData);
      
      if (yesterdayWorkflowData) {
        console.log(`\n📊 YESTERDAY DATA:`);
        console.log(`  Total workflows: ${yesterdayWorkflowData.length}`);
      }
    }
  }, [workflowData, yesterdayWorkflowData, selectedDate, overviewData]);

  // Handle setting date to today
  const handleSetToday = useCallback(() => {
    setSelectedDate(today);
    // Clear hover state when changing dates
    setHoverState({ metricType: null, workflowIds: new Set() });
  }, [today]);

  // Toggle reviewed state for a workflow
  const toggleReviewed = useCallback((workflowId: number) => {
    setReviewedWorkflows(prev => {
      const newState = { ...prev, [workflowId]: !prev[workflowId] };
      saveReviewedWorkflows(selectedDate, newState);
      return newState;
    });
  }, [selectedDate, saveReviewedWorkflows]);

  // Handle metric hover for highlighting related workflows
  const handleMetricHover = useCallback((metricType: MetricType, workflowIds: string[] | number[]) => {
    setHoverState({ metricType, workflowIds: new Set(workflowIds.map(String)) });
  }, []);

  const handleMetricLeave = useCallback(() => {
    setHoverState({ metricType: null, workflowIds: new Set() });
  }, []);

  // Helper function to get border color for metric highlighting
  const getBorderColorForMetric = (metricType: MetricType): string => {
    switch (metricType) {
      case 'consistent': return 'border-green-500';
      case 'improved': return 'border-blue-500';
      case 'regressed': return 'border-red-500';
      case 'regressing': return 'border-orange-500';
      case 'didnt_run': return 'border-gray-500';
      default: return '';
    }
  };

  // Format repository display name - use the same logic as the repo card
  const repoDisplayName = addedRepoPath ? formatRepoDisplayName(addedRepoPath) : formatRepoDisplayName(repoSlug);

  // Show empty state for new repositories (no API calls)
  if (!todayData && !yesterdayData) {
    return (
      <div className="container mx-auto p-6 space-y-8">
        <header className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{formatRepoDisplayName(repoDisplayName)}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/${repoSlug}/report`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Report
                </Button>
              </Link>
              <Button
                variant={isSelectedDateToday ? "default" : "outline"}
                size="sm"
                onClick={handleSetToday}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Today
              </Button>
              <DatePicker
                date={selectedDate}
                onDateChange={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setHoverState({ metricType: null, workflowIds: new Set() });
                  }
                }}
                placeholder="Select Date"
              />
            </div>
          </div>
        </header>
        
        <NoWorkflowsFound repoName={formatRepoDisplayName(repoDisplayName)} />
      </div>
    );
  }

  // Show error state
  if (todayError) {
    return <ErrorState />;
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{formatRepoDisplayName(repoDisplayName)}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/dashboard/${repoSlug}/report`}>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Report
              </Button>
            </Link>
            <Button
              variant={isSelectedDateToday ? "default" : "outline"}
              size="sm"
              onClick={handleSetToday}
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Today
            </Button>
            <DatePicker
              date={selectedDate}
              onDateChange={(date) => {
                if (date) {
                  setSelectedDate(date);
                  // Clear hover state when changing dates
                  setHoverState({ metricType: null, workflowIds: new Set() });
                }
              }}
              placeholder="Select Date"
            />
          </div>
        </div>
      </header>

      {/* Show no workflows found if no data */}
      {!workflowData || workflowData.length === 0 ? (
        <NoWorkflowsFound repoName={formatRepoDisplayName(repoDisplayName)} />
      ) : (
        <>
          {/* Compact Overview Row */}
          {workflowData && overviewData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-8">
              <OverviewMetrics
                data={overviewData}
                onMetricHover={handleMetricHover}
                onMetricLeave={handleMetricLeave}
              />
              <WorkflowMetrics
                todayRuns={workflowData}
                yesterdayRuns={yesterdayWorkflowData || []}
                onMetricHover={handleMetricHover}
                onMetricLeave={handleMetricLeave}
              />
            </div>
          )}

          {/* All Workflows Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6" />
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                All Workflows
              </h2>
              <Badge variant="secondary" className="text-xs">
                {workflowData.length} workflows
              </Badge>
            </div>

            {workflowData && workflowData.length > 0 ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {workflowData.map((run: any) => {
                  const isHighlighted = hoverState.metricType !== null && hoverState.workflowIds.has(run.id);
                  const highlightColor = isHighlighted && hoverState.metricType
                    ? getBorderColorForMetric(hoverState.metricType)
                    : '';

                  return (
                    <WorkflowCard
                      key={run.id}
                      run={run}
                      isReviewed={reviewedWorkflows[run.id] || false}
                      onToggleReviewed={() => toggleReviewed(run.id)}
                      repoSlug={repoSlug}
                      isHighlighted={isHighlighted}
                      highlightColor={highlightColor}
                      allWorkflowRuns={workflowData || []}
                      reviewedTestingWorkflows={new Set()}
                      onToggleTestingWorkflowReviewed={() => {}}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No workflows found for this date
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 