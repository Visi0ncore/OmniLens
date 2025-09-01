"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format, isToday } from "date-fns";
import { DatePicker } from "@/components/DatePicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, Settings, BarChart3 } from "lucide-react";
import Link from "next/link";
import { removeEmojiFromWorkflowName } from "@/lib/utils";
import type { WorkflowRun } from "@/lib/github";
import WorkflowCard from "@/components/WorkflowCard";
import DailyMetrics from "@/components/DailyMetrics";


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
    <Card className="relative h-auto border-2 border-border animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm leading-tight truncate pr-2">
            <div className="h-4 bg-muted rounded w-32" />
          </h3>
          <div className="flex items-center gap-2">
            {/* Run count badge skeleton */}
            <div className="h-5 bg-muted rounded w-6" />
            {/* Status badge skeleton */}
            <div className="h-5 bg-muted rounded w-12" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Health Status Section Skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-20" />
        </div>
        
        {/* Duration and View Button Section Skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-16" />
          </div>
          <div className="h-8 bg-muted rounded w-16" />
        </div>
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
  const [groupedWorkflowRuns, setGroupedWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);

  // Initialize with today's date - static reference
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const selectedDateRef = useRef(selectedDate);

  // Helper function to compare workflow runs for changes
  const hasWorkflowRunsChanged = useCallback((oldRuns: WorkflowRun[], newRuns: WorkflowRun[]): boolean => {
    if (oldRuns.length !== newRuns.length) return true;
    
    // Create a simple hash of the runs for comparison
    const oldHash = oldRuns.map(run => `${run.id}-${run.status}-${run.conclusion}`).join('|');
    const newHash = newRuns.map(run => `${run.id}-${run.status}-${run.conclusion}`).join('|');
    
    return oldHash !== newHash;
  }, []);

  // Load workflow runs for the selected date (ungrouped for daily metrics)
  const loadWorkflowRuns = useCallback(async (date: Date, isPolling: boolean = false) => {
    // Only show loading state for initial loads, not polling
    if (!isPolling) {
      setIsLoadingRuns(true);
    }
    
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
        const newRuns = data.workflowRuns || [];
        
        // Only update state if data has actually changed
        if (!isPolling || hasWorkflowRunsChanged(workflowRuns, newRuns)) {
          setWorkflowRuns(newRuns);
          if (isPolling) {
            console.log(`🔄 Data updated: ${newRuns.length} workflow runs for ${dateStr}`);
          } else {
            console.log(`📊 Loaded ${newRuns.length} workflow runs for ${dateStr}`);
          }
        } else if (isPolling) {
          console.log(`🔄 No changes detected for ${dateStr}`);
        }
      } else {
        console.error('Failed to load workflow runs');
        if (!isPolling) {
          setWorkflowRuns([]);
        }
      }
    } catch (error) {
      console.error('Error loading workflow runs:', error);
      if (!isPolling) {
        setWorkflowRuns([]);
      }
    } finally {
      if (!isPolling) {
        setIsLoadingRuns(false);
      }
    }
  }, [repoSlug, hasWorkflowRunsChanged]);

  // Load grouped workflow runs for the selected date (for workflow cards)
  const loadGroupedWorkflowRuns = useCallback(async (date: Date, isPolling: boolean = false) => {
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const response = await fetch(`/api/workflow/${repoSlug}?date=${dateStr}&grouped=true`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (response.ok) {
        const data = await response.json();
        const newGroupedRuns = data.workflowRuns || [];
        
        // Only update state if data has actually changed
        if (!isPolling || hasWorkflowRunsChanged(groupedWorkflowRuns, newGroupedRuns)) {
          setGroupedWorkflowRuns(newGroupedRuns);
          if (isPolling) {
            console.log(`🔄 Grouped data updated: ${newGroupedRuns.length} workflow cards for ${dateStr}`);
          } else {
            console.log(`📊 Loaded ${newGroupedRuns.length} grouped workflow runs for ${dateStr}`);
          }
        } else if (isPolling) {
          console.log(`🔄 No changes detected in grouped data for ${dateStr}`);
        }
      } else {
        console.error('Failed to load grouped workflow runs');
        if (!isPolling) {
          setGroupedWorkflowRuns([]);
        }
      }
    } catch (error) {
      console.error('Error loading grouped workflow runs:', error);
      if (!isPolling) {
        setGroupedWorkflowRuns([]);
      }
    }
  }, [repoSlug, hasWorkflowRunsChanged]);

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
            // First, sort by state: active workflows first, then disabled
            const aIsDisabled = a.state === 'disabled_manually';
            const bIsDisabled = b.state === 'disabled_manually';
            
            if (aIsDisabled && !bIsDisabled) return 1; // a is disabled, b is active
            if (!aIsDisabled && bIsDisabled) return -1; // a is active, b is disabled
            
            // If both have the same state, sort by workflow name without emojis
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

  // Update ref when selectedDate changes
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // Load workflow runs when date changes and set up smart polling
  useEffect(() => {
    console.log(`📊 Dashboard mounted - loading workflow runs for ${format(selectedDate, "yyyy-MM-dd")}...`);
    
    // Initial load
    loadWorkflowRuns(selectedDate);
    loadGroupedWorkflowRuns(selectedDate);
    
    // Only poll if we're looking at today's data
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
    const isToday = selectedDateStr === todayStr;
    
    if (isToday) {
      console.log(`🔄 Setting up polling for today's data (${format(selectedDate, "yyyy-MM-dd")})`);
      
      // Set up polling interval (10s, same as main page)
      const intervalId = window.setInterval(() => {
        // Check if we're still looking at today's data using the ref
        const currentTodayStr = format(new Date(), "yyyy-MM-dd");
        const currentSelectedDateStr = format(selectedDateRef.current, "yyyy-MM-dd");
        const stillToday = currentSelectedDateStr === currentTodayStr;
        
        if (stillToday && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
          console.log(`🔄 Polling today's workflow runs (10s interval)...`);
          loadWorkflowRuns(selectedDateRef.current, true); // Pass isPolling=true
          loadGroupedWorkflowRuns(selectedDateRef.current, true); // Pass isPolling=true
        } else if (!stillToday) {
          console.log(`📊 Stopping polling - no longer looking at today's data`);
          window.clearInterval(intervalId);
        }
      }, 10000); // 10s
      
      return () => {
        console.log(`📊 Dashboard unmounting - clearing polling interval`);
        window.clearInterval(intervalId);
      };
    } else {
      console.log(`📊 No polling for historical data (${format(selectedDate, "yyyy-MM-dd")})`);
    }
  }, [selectedDate, loadWorkflowRuns, loadGroupedWorkflowRuns]);



  const selectedDateStr = format(selectedDate, "EEEE, MMMM d, yyyy");
  const isSelectedDateToday = isToday(selectedDate);

  // Handle setting date to today
  const handleSetToday = useCallback(() => {
    setSelectedDate(today);
  }, [today]);

  // Get workflow run data for a specific workflow (from grouped data for cards)
  const getWorkflowRunData = useCallback((workflowId: number): WorkflowRun | null => {
    return groupedWorkflowRuns.find(run => run.workflow_id === workflowId) || null;
  }, [groupedWorkflowRuns]);

  // Helper function to generate runs by hour data
  const generateRunsByHour = useCallback(() => {
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({ 
      hour, 
      passed: 0, 
      failed: 0,
      total: 0
    }));
    
    workflowRuns.forEach(run => {
      if (run.run_started_at) {
        const startDate = new Date(run.run_started_at);
        const hour = startDate.getHours();
        if (hour >= 0 && hour < 24) {
          hourlyData[hour].total++;
          if (run.conclusion === 'success') {
            hourlyData[hour].passed++;
          } else if (run.conclusion === 'failure') {
            hourlyData[hour].failed++;
          }
        }
      }
    });
    
    // Only return hours that have actual runs
    return hourlyData.filter(data => data.total > 0);
  }, [workflowRuns]);

  // Helper function to calculate overview metrics
  const calculateOverviewMetrics = useCallback(() => {
    const completedRuns = workflowRuns.filter(run => run.status === 'completed').length;
    const totalRuns = workflowRuns.length;
    
    // Calculate actual pass/fail rates from completed runs
    const completedWorkflowRuns = workflowRuns.filter(run => run.status === 'completed');
    const passedRuns = completedWorkflowRuns.filter(run => run.conclusion === 'success').length;
    const failedRuns = completedWorkflowRuns.filter(run => run.conclusion === 'failure').length;
    const passRate = completedWorkflowRuns.length > 0 ? Math.round((passedRuns / completedWorkflowRuns.length) * 100) : 0;
    
    // Legacy success rate (completed vs total)
    const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
    
    // Calculate total runtime
    const totalRuntimeMs = workflowRuns.reduce((total, run) => {
      if (run.run_started_at && run.updated_at) {
        const start = new Date(run.run_started_at);
        const end = new Date(run.updated_at);
        return total + (end.getTime() - start.getTime());
      }
      return total;
    }, 0);
    
    const hours = Math.floor(totalRuntimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalRuntimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((totalRuntimeMs % (1000 * 60)) / 1000);
    const totalRuntime = `${hours}h ${minutes}m ${seconds}s`;
    
    // Calculate runs per hour stats
    const runsByHour = generateRunsByHour();
    const counts = runsByHour.map(r => r.total);
    const avgRunsPerHour = counts.length > 0 ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length * 10) / 10 : 0;
    const minRunsPerHour = Math.min(...counts);
    const maxRunsPerHour = Math.max(...counts);
    
    return {
      successRate,
      passRate,
      passedRuns,
      failedRuns,
      completedRuns,
      totalRuntime,
      didntRunCount: totalRuns - completedRuns,
      avgRunsPerHour,
      minRunsPerHour,
      maxRunsPerHour
    };
  }, [workflowRuns]);



  // Helper function to get workflow runs for a specific date
  const getWorkflowRunsForDate = useCallback(async (date: Date, repoSlug: string) => {
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
        return data.workflowRuns || [];
      }
      return [];
    } catch (error) {
      console.error('Error loading workflow runs for date:', error);
      return [];
    }
  }, []);

  // State to store yesterday's workflow runs
  const [yesterdayWorkflowRuns, setYesterdayWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [isLoadingYesterday, setIsLoadingYesterday] = useState(false);

  // Load yesterday's data when component mounts or date changes
  useEffect(() => {
    const loadYesterdayData = async () => {
      setIsLoadingYesterday(true);
      try {
        const yesterday = new Date(selectedDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayRuns = await getWorkflowRunsForDate(yesterday, repoSlug);
        setYesterdayWorkflowRuns(yesterdayRuns);
      } catch (error) {
        console.error('Error loading yesterday data:', error);
        setYesterdayWorkflowRuns([]);
      } finally {
        setIsLoadingYesterday(false);
      }
    };

    loadYesterdayData();
  }, [selectedDate, repoSlug, getWorkflowRunsForDate]);

  // Helper function to get the last run result for a workflow
  const getLastRunResult = useCallback((workflowId: number, runs: WorkflowRun[]): 'success' | 'failure' | null => {
    const workflowRuns = runs.filter(run => run.workflow_id === workflowId);
    if (workflowRuns.length === 0) return null;
    
    // Sort by run_started_at descending and get the most recent
    const sortedRuns = workflowRuns.sort((a, b) => 
      new Date(b.run_started_at).getTime() - new Date(a.run_started_at).getTime()
    );
    
    const lastRun = sortedRuns[0];
    return lastRun.conclusion === 'success' ? 'success' : 'failure';
  }, []);

  // Helper function to classify workflow health status with proper yesterday comparison
  const classifyWorkflowHealth = useCallback((workflowId: number): 'consistent' | 'improved' | 'regressed' | 'still_failing' => {
    const todayRuns = workflowRuns.filter(run => run.workflow_id === workflowId);
    
    if (todayRuns.length === 0) {
      return 'still_failing'; // No runs today, consider it failing
    }
    
    // Check if all runs today were successful
    const allSuccessfulToday = todayRuns.every(run => run.conclusion === 'success');
    const allFailedToday = todayRuns.every(run => run.conclusion === 'failure');
    
    // Get yesterday's last run result
    const yesterdayLastResult = getLastRunResult(workflowId, yesterdayWorkflowRuns);
    
    if (allSuccessfulToday) {
      // All runs today were successful
      if (yesterdayLastResult === 'failure') {
        return 'improved'; // Was failing yesterday, now all passing
      } else {
        return 'consistent'; // Was passing yesterday, still passing
      }
    } else if (allFailedToday) {
      // All runs today failed
      if (yesterdayLastResult === 'success') {
        return 'regressed'; // Was passing yesterday, now all failing
      } else {
        return 'still_failing'; // Was failing yesterday, still failing
      }
    } else {
      // Mixed results today - need to compare with yesterday's last result
      const todayLastResult = getLastRunResult(workflowId, todayRuns);
      
      if (yesterdayLastResult === null) {
        // No yesterday data, use majority rule as fallback
        const successCount = todayRuns.filter(run => run.conclusion === 'success').length;
        const failureCount = todayRuns.filter(run => run.conclusion === 'failure').length;
        return successCount > failureCount ? 'improved' : 'regressed';
      }
      
      if (yesterdayLastResult === 'failure' && todayLastResult === 'success') {
        return 'improved'; // Was failing yesterday, last run today passed
      } else if (yesterdayLastResult === 'success' && todayLastResult === 'failure') {
        return 'regressed'; // Was passing yesterday, last run today failed
      } else {
        // Same result as yesterday - determine based on majority
        const successCount = todayRuns.filter(run => run.conclusion === 'success').length;
        const failureCount = todayRuns.filter(run => run.conclusion === 'failure').length;
        
        if (yesterdayLastResult === 'success') {
          return successCount > failureCount ? 'consistent' : 'regressed';
        } else {
          return successCount > failureCount ? 'improved' : 'still_failing';
        }
      }
    }
  }, [workflowRuns, yesterdayWorkflowRuns, getLastRunResult]);

  // Helper function to get workflow health metrics (simplified for now)
  const getWorkflowHealthMetrics = useCallback((workflowId: number) => {
    const healthStatus = classifyWorkflowHealth(workflowId);
    const todayRuns = workflowRuns.filter(run => run.workflow_id === workflowId);
    
    return {
      status: healthStatus,
      totalRuns: todayRuns.length,
      successfulRuns: todayRuns.filter(run => run.conclusion === 'success').length,
      failedRuns: todayRuns.filter(run => run.conclusion === 'failure').length
    };
  }, [workflowRuns]);

  // Helper function to calculate health metrics from workflow health data
  const calculateHealthMetrics = useCallback(() => {
    // Get all active workflows
    const activeWorkflows = workflows.filter((w: any) => w.state !== 'disabled_manually');
    
    // Count workflows by health status
    let consistentCount = 0;
    let improvedCount = 0;
    let regressedCount = 0;
    let stillFailingCount = 0;
    
    activeWorkflows.forEach(workflow => {
      const healthStatus = classifyWorkflowHealth(workflow.id);
      switch (healthStatus) {
        case 'consistent':
          consistentCount++;
          break;
        case 'improved':
          improvedCount++;
          break;
        case 'regressed':
          regressedCount++;
          break;
        case 'still_failing':
          stillFailingCount++;
          break;
      }
    });
    
    return {
      consistentCount,
      improvedCount,
      regressedCount,
      stillFailingCount
    };
  }, [workflows, workflowRuns]);

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
            disabled
          >
            <BarChart3 className="h-4 w-4" />
            Report
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
              console.log('DatePicker onDateChange called with:', date);
              if (date) {
                console.log('Setting selected date to:', date);
                setSelectedDate(date);
                // Load workflow runs for the newly selected date
                loadWorkflowRuns(date);
              }
            }}
            placeholder="Select Date"
          />
        </div>
      </div>

      {/* Daily Metrics */}
      {isLoadingWorkflows || isLoadingRuns ? (
        // Daily Metrics Skeleton
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pass/Fail Rate Skeleton */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Pass/Fail Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="h-32 w-32 bg-muted rounded-full animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-6 w-8 bg-muted rounded animate-pulse" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-muted rounded-full animate-pulse" />
                    <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-muted rounded-full animate-pulse" />
                    <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overview Skeleton */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Health Skeleton */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Workflow Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Runs by hour Skeleton */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Runs by hour</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-36 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>
      ) : (() => {
        const overviewMetrics = calculateOverviewMetrics();
        const healthMetrics = calculateHealthMetrics();
        
        return (
          <>
            <DailyMetrics
              successRate={overviewMetrics.successRate}
              passRate={overviewMetrics.passRate}
              passedRuns={overviewMetrics.passedRuns}
              failedRuns={overviewMetrics.failedRuns}
              completedRuns={overviewMetrics.completedRuns}
              totalRuntime={overviewMetrics.totalRuntime}
              didntRunCount={overviewMetrics.didntRunCount}
              activeWorkflows={workflows.filter((w: any) => w.state !== 'disabled_manually').length}
              consistentCount={healthMetrics.consistentCount}
              improvedCount={healthMetrics.improvedCount}
              regressedCount={healthMetrics.regressedCount}
              stillFailingCount={healthMetrics.stillFailingCount}
              avgRunsPerHour={overviewMetrics.avgRunsPerHour}
              minRunsPerHour={overviewMetrics.minRunsPerHour}
              maxRunsPerHour={overviewMetrics.maxRunsPerHour}
              runsByHour={generateRunsByHour()}
              selectedDate={selectedDate}
            />
            

          </>
        );
      })()}



      {/* Show workflows or loading skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Workflows
          </h2>
        </div>
        {/* Active Workflows */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {isLoadingWorkflows || isLoadingRuns ? (
            // Show skeleton cards for active workflows (6 cards)
            Array.from({ length: 6 }).map((_, index) => (
              <WorkflowCardSkeleton key={index} />
            ))
          ) : (
            workflows
              .filter((workflow: any) => workflow.state !== 'disabled_manually')
              .map((workflow: any) => {
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

                const healthData = getWorkflowHealthMetrics(workflow.id);
                return (
                  <WorkflowCard
                    key={workflow.id}
                    run={runData || mockRun}
                    workflowState={workflow.state}
                    repoSlug={repoSlug}
                    healthStatus={healthData.status}
                    healthMetrics={healthData}
                  />
                );
              })
          )}
        </div>

        {/* Disabled Workflows */}
        {(isLoadingWorkflows || isLoadingRuns) ? (
          // Show skeleton section for disabled workflows during loading
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-6 bg-muted rounded w-32" />
              <div className="h-5 bg-muted rounded w-8" />
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <WorkflowCardSkeleton key={`disabled-${index}`} />
              ))}
            </div>
          </div>
        ) : workflows.filter((w: any) => w.state === 'disabled_manually').length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">Disabled Workflows</h3>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {workflows
                .filter((workflow: any) => workflow.state === 'disabled_manually')
                .map((workflow: any) => {
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
                      workflowState={workflow.state}
                      repoSlug={repoSlug}
                    />
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 