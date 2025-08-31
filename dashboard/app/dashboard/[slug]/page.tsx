"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { format, isToday } from "date-fns";
import { DatePicker } from "@/components/DatePicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, Settings, BarChart3, RefreshCw } from "lucide-react";
import Link from "next/link";
import { removeEmojiFromWorkflowName } from "@/lib/utils";
import type { WorkflowRun } from "@/lib/github";
import WorkflowCard from "@/components/WorkflowCard";

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

// Workflow Definition Card Component
function WorkflowDefinitionCard({ workflow }: { workflow: any }) {
  return (
    <Card className="relative h-full transition-all duration-200 border-border bg-card hover:border-border/80 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold">
              {workflow.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              -
            </Badge>
            <Badge variant={workflow.state === 'active' ? 'success' : 'secondary'}>
              {workflow.state === 'active' ? 'Active' : 'Disabled'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
      </CardContent>
    </Card>
  );
}

// Workflow Card Skeleton Component
function WorkflowCardSkeleton() {
  return (
    <Card className="relative h-full animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 bg-muted rounded w-32" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 bg-muted rounded w-8" />
            <div className="h-5 bg-muted rounded w-16" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
      </CardContent>
    </Card>
  );
}

interface PageProps {
  params: { slug: string };
}

export default function DashboardPage({ params }: PageProps) {
  const { slug: repoSlug } = params;
  const [addedRepoPath, setAddedRepoPath] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);

  // Initialize with today's date using useMemo to prevent re-creation on every render
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Load workflow runs for the selected date
  const loadWorkflowRuns = useCallback(async (date: Date) => {
    setIsLoadingRuns(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const response = await fetch(`/api/workflow/${repoSlug}?date=${dateStr}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkflowRuns(data.workflowRuns || []);
        console.log(`📊 Loaded ${data.workflowRuns?.length || 0} workflow runs for ${dateStr}`);
      } else {
        console.error('Failed to load workflow runs');
        setWorkflowRuns([]);
      }
    } catch (error) {
      console.error('Error loading workflow runs:', error);
      setWorkflowRuns([]);
    } finally {
      setIsLoadingRuns(false);
    }
  }, [repoSlug]);

  // Load workflows when component mounts
  useEffect(() => {
    const loadWorkflows = async () => {
      setIsLoadingWorkflows(true);
      try {
        const response = await fetch(`/api/workflow/${repoSlug}`, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        if (response.ok) {
          const data = await response.json();
          const sortedWorkflows = (data.workflows || []).sort((a: any, b: any) => {
            // Sort by workflow name without emojis
            const nameA = removeEmojiFromWorkflowName(a.name || '');
            const nameB = removeEmojiFromWorkflowName(b.name || '');
            return nameA.localeCompare(nameB);
          });
          setWorkflows(sortedWorkflows);
          console.log(`📋 Loaded ${sortedWorkflows.length} workflows`);
        } else {
          console.error('Failed to load workflows');
          setWorkflows([]);
        }
      } catch (error) {
        console.error('Error loading workflows:', error);
        setWorkflows([]);
      } finally {
        setIsLoadingWorkflows(false);
      }
    };

    loadWorkflows();
  }, [repoSlug]);

  // Load workflow runs when date changes
  useEffect(() => {
    loadWorkflowRuns(selectedDate);
  }, [selectedDate, loadWorkflowRuns]);

  // Refresh data when page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Page became visible, refreshing workflow runs...');
        loadWorkflowRuns(selectedDate);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedDate, loadWorkflowRuns]);

  const selectedDateStr = format(selectedDate, "EEEE, MMMM d, yyyy");
  const isSelectedDateToday = isToday(selectedDate);

  // Handle setting date to today
  const handleSetToday = useCallback(() => {
    setSelectedDate(today);
  }, [today]);

  // Get workflow run data for a specific workflow
  const getWorkflowRunData = useCallback((workflowId: number): WorkflowRun | null => {
    return workflowRuns.find(run => run.workflow_id === workflowId) || null;
  }, [workflowRuns]);

  // Format repository display name - use the same logic as the repo card
  const repoDisplayName = addedRepoPath ? formatRepoDisplayName(addedRepoPath) : formatRepoDisplayName(repoSlug);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{repoDisplayName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              loadWorkflowRuns(selectedDate);
            }}
            disabled={isLoadingRuns}
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingRuns ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            asChild
          >
            <Link href={`/dashboard/${repoSlug}/report`}>
              <BarChart3 className="h-4 w-4" />
              Report
            </Link>
          </Button>
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
              }
            }}
            placeholder="Select Date"
          />
        </div>
      </div>

      {/* Show workflows or loading skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Workflows
          </h2>
          {!isLoadingWorkflows && (
            <Badge variant="secondary" className="text-xs">
              {workflows.length}
            </Badge>
          )}
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {isLoadingWorkflows || isLoadingRuns ? (
            // Show 3 rows of skeleton cards (9 total)
            Array.from({ length: 9 }).map((_, index) => (
              <WorkflowCardSkeleton key={index} />
            ))
          ) : (
            workflows.map((workflow: any) => {
              const runData = getWorkflowRunData(workflow.id);
              
              // If no run data, create a mock run to show the workflow as idle
              const mockRun: WorkflowRun = {
                id: 0,
                name: workflow.name,
                workflow_id: workflow.id,
                path: workflow.path,
                conclusion: null,
                status: 'idle',
                html_url: '',
                run_started_at: '',
                updated_at: '',
                isMissing: true
              };

              return (
                <WorkflowCard
                  key={workflow.id}
                  run={runData || mockRun}
                  repoSlug={repoSlug}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
} 