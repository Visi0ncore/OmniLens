"use client";

import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect, useCallback } from "react";
import { format, isToday } from "date-fns";

import WorkflowCard from "@/components/WorkflowCard";
import SkeletonCards from "@/components/SkeletonCards";
import ErrorState from "@/components/ErrorState";
import WorkflowMetrics from "@/components/WorkflowMetrics";
import OverviewMetrics from "@/components/OverviewMetrics";
import { DatePicker } from "@/components/DatePicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Target, TestTube, Calendar, Hammer, RefreshCw, ArrowLeft, AlertCircle, Plus, Trash2, Settings } from "lucide-react";
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

function NoWorkflowsConfigured({ repoName }: { repoName: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
      <div className="rounded-full bg-muted p-6">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          No workflows configured
        </h2>
        <p className="text-muted-foreground max-w-md">
          The repository <code className="bg-muted px-2 py-1 rounded text-sm">{repoName}</code> has no workflows configured in the dashboard.
        </p>
        <p className="text-sm text-muted-foreground">
          Add workflow files to the categories in <code className="bg-muted px-2 py-1 rounded text-sm">workflows.json</code> to start monitoring.
        </p>
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

function categorizeWorkflows(runs: any[], missingWorkflows: string[] = [], repoSlug: string) {
  const repoConfig = getRepoConfig(repoSlug);
  if (!repoConfig) return {};

  const categories: Record<string, any[]> = {};

  Object.entries(repoConfig.categories).forEach(([key, categoryConfig]) => {
    // Get actual workflow runs for this category
    const actualRuns = runs.filter(run => {
      // Try different possible fields that might contain the workflow file name
      const workflowFile = run.path || run.workflow_path || run.head_commit?.message || run.workflow_name;
      return categoryConfig.workflows.some(configWorkflow =>
        workflowFile && workflowFile.includes(configWorkflow)
      );
    });

    // Create mock workflow runs for missing workflows in this category
    const missingInCategory = missingWorkflows.filter(workflow =>
      categoryConfig.workflows.includes(workflow)
    );

    const mockMissingRuns = missingInCategory.map(workflowFile => ({
      id: `missing-${workflowFile}`, // Unique ID for missing workflows
      name: workflowFile.replace('.yml', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      workflow_id: `missing-${workflowFile}`,
      workflow_name: workflowFile.replace('.yml', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      conclusion: 'didnt_run', // Special conclusion for missing workflows
      status: 'didnt_run',
      html_url: '#',
      run_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isMissing: true // Flag to identify mock workflows
    }));

    // Combine actual and missing runs
    const allRuns = [...actualRuns, ...mockMissingRuns];

    categories[key] = allRuns.sort((a, b) => {
      // Sort alphabetically by cleaned workflow names (without emojis and trigger prefix)
      const cleanNameA = cleanWorkflowName(a.name);
      const cleanNameB = cleanWorkflowName(b.name);
      return cleanNameA.localeCompare(cleanNameB);
    });
  });

  return categories;
}

// Helper function to fetch data from API
const fetchWorkflowData = async (date: Date, repoSlug: string) => {
  const dateStr = format(date, "yyyy-MM-dd");
  const timestamp = new Date().toLocaleTimeString();
  
  console.log(`🔄 [${timestamp}] Fetching data for ${dateStr} from repo ${repoSlug}...`);
  
  const response = await fetch(`/api/workflows?date=${dateStr}&repo=${repoSlug}&_t=${Date.now()}`, {
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
  const isLocalRepo = repoSlug.startsWith('local-');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [reviewedWorkflows, setReviewedWorkflows] = useState<Record<number, boolean>>({});
  const [reviewedTestingWorkflows, setReviewedTestingWorkflows] = useState<Record<string, Set<string>>>({});
  const [hoverState, setHoverState] = useState<HoverState>({ metricType: null, workflowIds: new Set() });

  // Initialize with today's date explicitly  
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Helper functions for localStorage with repo context
  const getStorageKey = useCallback((date: Date) => {
    return `reviewedWorkflows-${repoSlug}-${format(date, "yyyy-MM-dd")}`;
  }, [repoSlug]);

  const getCollapsedCategoriesKey = useCallback((date: Date) => {
    return `collapsedCategories-${repoSlug}-${format(date, "yyyy-MM-dd")}`;
  }, [repoSlug]);

  const getTestingWorkflowsKey = useCallback((date: Date) => {
    return `reviewedTestingWorkflows-${repoSlug}-${format(date, "yyyy-MM-dd")}`;
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

  const loadCollapsedCategories = useCallback((date: Date) => {
    try {
      const stored = localStorage.getItem(getCollapsedCategoriesKey(date));
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load collapsed categories from localStorage:', error);
    }
    return {};
  }, [getCollapsedCategoriesKey]);

  const loadReviewedTestingWorkflows = useCallback((date: Date) => {
    try {
      const stored = localStorage.getItem(getTestingWorkflowsKey(date));
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert back to Map-like structure
        const result: Record<string, Set<string>> = {};
        Object.entries(parsed).forEach(([key, value]) => {
          result[key] = new Set(value as string[]);
        });
        return result;
      }
    } catch (error) {
      console.error('Failed to load reviewed testing workflows from localStorage:', error);
    }
    return {};
  }, [getTestingWorkflowsKey]);

  const saveReviewedWorkflows = (date: Date, reviewedState: Record<number, boolean>) => {
    try {
      localStorage.setItem(getStorageKey(date), JSON.stringify(reviewedState));
    } catch (error) {
      console.error('Failed to save reviewed workflows to localStorage:', error);
    }
  };

  const saveCollapsedCategories = (date: Date, collapsedState: Record<string, boolean>) => {
    try {
      localStorage.setItem(getCollapsedCategoriesKey(date), JSON.stringify(collapsedState));
    } catch (error) {
      console.error('Failed to save collapsed categories to localStorage:', error);
    }
  };

  const saveReviewedTestingWorkflows = (date: Date, reviewedState: Record<string, Set<string>>) => {
    try {
      // Convert Sets to arrays for JSON serialization
      const serializableState: Record<string, string[]> = {};
      Object.entries(reviewedState).forEach(([key, value]) => {
        serializableState[key] = Array.from(value);
      });
      localStorage.setItem(getTestingWorkflowsKey(date), JSON.stringify(serializableState));
    } catch (error) {
      console.error('Failed to save reviewed testing workflows to localStorage:', error);
    }
  };

  // Load reviewed workflows and collapsed categories when date changes
  useEffect(() => {
    const storedReviewed = loadReviewedWorkflows(selectedDate);
    const storedCollapsed = loadCollapsedCategories(selectedDate);
    const storedTestingWorkflows = loadReviewedTestingWorkflows(selectedDate);

    setReviewedWorkflows(storedReviewed);
    setCollapsedCategories(storedCollapsed);
    setReviewedTestingWorkflows(storedTestingWorkflows);
  }, [selectedDate, loadReviewedWorkflows, loadCollapsedCategories, loadReviewedTestingWorkflows]);

  const selectedDateStr = format(selectedDate, "EEEE, MMMM d, yyyy");
  const isSelectedDateToday = isToday(selectedDate);

  // Determine repo config early for query enabling
  const repoConfig = getRepoConfig(repoSlug);

  // Single query for today's data with optimized real-time updates
  const { data: todayData, isLoading: todayLoading, isError: todayError, refetch: refetchToday } = useQuery({
    queryKey: ["workflowData", repoSlug, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      return await fetchWorkflowData(selectedDate, repoSlug);
    },
    enabled: !!repoConfig, // disable for local/unconfigured repos to avoid 400s
    staleTime: isSelectedDateToday ? 0 : 5 * 60 * 1000, // Historical data stays fresh longer
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchInterval: isSelectedDateToday ? 10000 : false, // Poll every 10s for today, no polling for historical
    refetchIntervalInBackground: isSelectedDateToday, // Only poll in background for today
    refetchOnWindowFocus: isSelectedDateToday, // Only refetch on focus for today
    refetchOnMount: true, // Always refetch when component mounts
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
    enabled: !!repoConfig, // disable for local/unconfigured repos
    staleTime: 5 * 60 * 1000, // Data is stale after 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus for historical data
    refetchOnMount: true, // Refetch when component mounts
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
      console.log(`   🎯 Workflow runs received: ${workflowData.length}`);
      workflowData.forEach((run: any, index: number) => {
        console.log(`     ${index + 1}. "${run.name}" - Run Count: ${run.run_count || 1}, All Runs: ${run.all_runs?.length || 0}`);
      });
      
      // Check for multiple runs
      const multipleRuns = workflowData.filter((run: any) => (run.run_count || 1) > 1);
      
      if (multipleRuns.length > 0) {
        console.log(`\n🔍 MULTIPLE RUNS DETECTED:`);
        console.log(`   📅 ${format(selectedDate, "yyyy-MM-dd")}: ${multipleRuns.length} workflows with multiple runs`);
        multipleRuns.forEach((run: any) => {
          console.log(`     - "${run.name}": ${run.run_count} runs`);
        });
      }
    }

    // Log yesterday data for Daily Metrics
    if (yesterdayWorkflowData) {
      const yesterday = new Date(selectedDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, "yyyy-MM-dd");
      
      console.log(`\n📈 === YESTERDAY DATA FOR ${yesterdayStr} ===`);
      console.log(`   🎯 Yesterday workflow runs: ${yesterdayWorkflowData.length}`);
      console.log(`   📊 Daily Metrics comparison data available`);
    }
  }, [workflowData, yesterdayWorkflowData, selectedDate]);

  const missingWorkflows = workflowData ? calculateMissingWorkflows(workflowData, repoSlug) : [];
  const categories = workflowData ? categorizeWorkflows(workflowData, missingWorkflows, repoSlug) : null;

  const toggleCategory = (categoryKey: string) => {
    setCollapsedCategories(prev => {
      const newState = {
        ...prev,
        [categoryKey]: !prev[categoryKey]
      };

      // Save to localStorage
      saveCollapsedCategories(selectedDate, newState);

      return newState;
    });
  };

  // Helper function to check and auto-collapse a category if all workflows are reviewed
  const checkAndAutoCollapseCategory = (workflowId: number, reviewedState: Record<number, boolean>) => {
    if (categories) {
      // Find which category contains the workflow that was just reviewed
      const categoryWithWorkflow = Object.entries(categories).find(([_, workflows]) =>
        workflows.some(workflow => workflow.id === workflowId)
      );

      if (categoryWithWorkflow) {
        const [categoryKey, workflows] = categoryWithWorkflow;
        const allReviewed = workflows.every(workflow => reviewedState[workflow.id]);

        if (allReviewed && workflows.length > 0) {
          setCollapsedCategories(prevCollapsed => {
            const newCollapsedState = {
              ...prevCollapsed,
              [categoryKey]: true
            };

            // Save to localStorage
            saveCollapsedCategories(selectedDate, newCollapsedState);

            return newCollapsedState;
          });
        }
      }
    }
  };

  const toggleReviewed = (workflowId: number) => {
    setReviewedWorkflows(prev => {
      const newState = {
        ...prev,
        [workflowId]: !prev[workflowId]
      };

      // Save to localStorage
      saveReviewedWorkflows(selectedDate, newState);

      // Check if we need to auto-collapse the category containing this workflow
      checkAndAutoCollapseCategory(workflowId, newState);

      return newState;
    });
  };

  const toggleTestingWorkflowReviewed = (triggerWorkflowId: number, testingWorkflowName: string) => {
    setReviewedTestingWorkflows(prev => {
      const triggerKey = triggerWorkflowId.toString();
      const currentSet = prev[triggerKey] || new Set();
      const newSet = new Set(currentSet);

      if (newSet.has(testingWorkflowName)) {
        newSet.delete(testingWorkflowName);
      } else {
        newSet.add(testingWorkflowName);
      }

      const newState = {
        ...prev,
        [triggerKey]: newSet
      };

      // Save to localStorage
      saveReviewedTestingWorkflows(selectedDate, newState);

      // Find the trigger workflow to get its testing workflows
      const triggerWorkflow = workflowData?.find((run: any) => run.id === triggerWorkflowId);
      if (triggerWorkflow) {
        const testingWorkflowFiles = getTestingWorkflowsForTrigger(triggerWorkflow.name, repoSlug) || getTestingWorkflowsForTrigger(triggerWorkflow.workflow_name || '', repoSlug);
        const testingWorkflowNames = testingWorkflowFiles.map((file: string) => 
          file.replace('.yml', '').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
        );

        // Check if all testing workflows are now reviewed
        const allTestingWorkflowsReviewed = testingWorkflowNames.length > 0 && 
          testingWorkflowNames.every((name: string) => newSet.has(name));

        // If all testing workflows are reviewed, automatically mark the trigger as reviewed
        if (allTestingWorkflowsReviewed && !reviewedWorkflows[triggerWorkflowId]) {
          setReviewedWorkflows(prev => {
            const newReviewedState = {
              ...prev,
              [triggerWorkflowId]: true
            };
            saveReviewedWorkflows(selectedDate, newReviewedState);
            
            // Check if we need to auto-collapse the category containing this workflow
            checkAndAutoCollapseCategory(triggerWorkflowId, newReviewedState);
            
            return newReviewedState;
          });
        }
        // If we're removing a testing workflow from reviewed, and the trigger is currently reviewed,
        // then unmark the trigger as reviewed
        else if (!newSet.has(testingWorkflowName) && reviewedWorkflows[triggerWorkflowId]) {
          setReviewedWorkflows(prev => {
            const newReviewedState = {
              ...prev,
              [triggerWorkflowId]: false
            };
            saveReviewedWorkflows(selectedDate, newReviewedState);
            return newReviewedState;
          });
        }
      }

      return newState;
    });
  };

  // Handlers for metric hover
  const handleMetricHover = (metricType: MetricType, workflowIds: (number | string)[]) => {
    setHoverState({
      metricType,
      workflowIds: new Set(workflowIds)
    });
  };

  const handleMetricLeave = () => {
    setHoverState({ metricType: null, workflowIds: new Set() });
  };

  // Get border color based on metric type
  const getBorderColorForMetric = (metricType: MetricType): string => {
    switch (metricType) {
      case 'consistent': return 'border-green-600';
      case 'improved': return 'border-blue-600';
      case 'regressed': return 'border-orange-600';
      case 'regressing': return 'border-red-600';
      case 'didnt_run': return 'border-red-600';
      default: return '';
    }
  };

  // Auto-collapse category when all workflows are reviewed
  const checkAndAutoCollapse = (categoryKey: string, workflows: any[]) => {
    const allReviewed = workflows.every(workflow => reviewedWorkflows[workflow.id]);
    if (allReviewed && workflows.length > 0) {
      setCollapsedCategories(prev => ({
        ...prev,
        [categoryKey]: true
      }));
    }
  };

  // Quick date selection
  const handleSetToday = () => {
    setSelectedDate(new Date());
    // Clear hover state when changing dates
    setHoverState({ metricType: null, workflowIds: new Set() });
  };

  // Get repo config for display (already computed above)
  const [localConfig, setLocalConfig] = useState<any | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState<Array<{ id: number; name: string; path: string; state: string; html_url: string; }>>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Get repository name from API
  const [repoDisplayName, setRepoDisplayName] = React.useState<string>(repoSlug);
  
  React.useEffect(() => {
    const fetchRepoName = async () => {
      try {
        const response = await fetch('/api/repositories');
        if (response.ok) {
          const data = await response.json();
          const repo = data.repositories.find((r: any) => r.slug === repoSlug);
          if (repo) {
            setRepoDisplayName(repo.displayName);
            return;
          }
        }
        // Fallback for local repos: read from localStorage
        if (isLocalRepo) {
          try {
            const stored = localStorage.getItem('userAddedRepos');
            if (stored) {
              const parsed = JSON.parse(stored) as Array<any>;
              const found = parsed.find(r => r.slug === repoSlug);
              if (found?.displayName) setRepoDisplayName(found.displayName);
            }
          } catch {}
        }
      } catch (error) {
        console.error('Failed to fetch repository name:', error);
      }
    };
    
    fetchRepoName();
  }, [repoSlug]);

  // Local configuration helpers
  useEffect(() => {
    if (!isLocalRepo) return;
    try {
      const key = `localRepoConfig-${repoSlug}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        setLocalConfig(JSON.parse(stored));
      } else {
        // Initialize with empty categories
        const initial = {
          slug: repoSlug,
          categories: {
            build: { name: 'Build Workflows', workflows: [] as string[] },
            trigger: { name: 'Trigger Workflows', workflows: [] as string[] },
            testing: { name: 'Testing Workflows', workflows: [] as string[] },
            utility: { name: 'Utility Workflows', workflows: [] as string[] },
          },
          trigger_mappings: {} as Record<string, string[]>,
        };
        setLocalConfig(initial);
        localStorage.setItem(key, JSON.stringify(initial));
      }
    } catch (e) {
      console.error('Failed to load local repo config', e);
    }
  }, [isLocalRepo, repoSlug]);

  const saveLocalConfig = useCallback((next: any) => {
    try {
      localStorage.setItem(`localRepoConfig-${repoSlug}`, JSON.stringify(next));
    } catch {}
  }, [repoSlug]);

  // Open Configure Workflows modal and load available workflows
  const openConfigureModal = useCallback(async () => {
    setConfigError(null);
    setShowConfigModal(true);
    setIsLoadingWorkflows(true);
    try {
      // Determine repoPath from local storage entry
      let repoPath: string | null = null;
      try {
        const stored = localStorage.getItem('userAddedRepos');
        if (stored) {
          const parsed = JSON.parse(stored) as Array<any>;
          const found = parsed.find(r => r.slug === repoSlug);
          repoPath = found?.repoPath || null;
        }
      } catch {}
      const res = await fetch(`/api/repositories/workflows?repoPath=${encodeURIComponent(repoPath || '')}`);
      const json = await res.json();
      if (!res.ok) {
        setConfigError(json?.error || 'Failed to fetch workflows');
        setAvailableWorkflows([]);
      } else {
        setAvailableWorkflows(json.workflows || []);
      }
    } catch (e) {
      setConfigError('Failed to fetch workflows');
    } finally {
      setIsLoadingWorkflows(false);
    }
  }, [repoSlug]);

  const addLocalWorkflowFile = useCallback(async (categoryKey: string, file: string) => {
    if (!localConfig) return;
    const existing = new Set(localConfig.categories[categoryKey].workflows);
    if (existing.has(file)) return;
    const next = {
      ...localConfig,
      categories: {
        ...localConfig.categories,
        [categoryKey]: {
          ...localConfig.categories[categoryKey],
          workflows: [...localConfig.categories[categoryKey].workflows, file],
        }
      }
    };
    setLocalConfig(next);
    saveLocalConfig(next);

    // After adding, fetch latest runs and refresh dashboard state by reloading page data via existing queries
    try {
      // Determine repoPath from local storage entry
      let repoPath: string | null = null;
      try {
        const stored = localStorage.getItem('userAddedRepos');
        if (stored) {
          const parsed = JSON.parse(stored) as Array<any>;
          const found = parsed.find(r => r.slug === repoSlug);
          repoPath = found?.repoPath || null;
        }
      } catch {}

      if (repoPath) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        await fetch(`/api/repositories/workflow-runs?repoPath=${encodeURIComponent(repoPath)}&date=${encodeURIComponent(dateStr)}`, {
          cache: 'no-store'
        });
      }

      // Re-run existing queries to repopulate UI with new cards/metrics
      await Promise.all([refetchToday(), refetchYesterday()]);
    } catch (e) {
      console.error('Failed to fetch runs after configuration', e);
    }
  }, [localConfig, saveLocalConfig, repoSlug, selectedDate, refetchToday, refetchYesterday]);

  const handleRemoveLocalWorkflow = useCallback((categoryKey: string, file: string) => {
    if (!localConfig) return;
    const next = {
      ...localConfig,
      categories: {
        ...localConfig.categories,
        [categoryKey]: {
          ...localConfig.categories[categoryKey],
          workflows: localConfig.categories[categoryKey].workflows.filter((w: string) => w !== file),
        }
      }
    };
    setLocalConfig(next);
    saveLocalConfig(next);
  }, [localConfig, saveLocalConfig]);

  // Local repo configuration UI
  if (!repoConfig && isLocalRepo) {
    const configuredFiles: string[] = localConfig ? Object.values(localConfig.categories).flatMap((c: any) => c.workflows) : [];
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
                <p className="text-muted-foreground">Configure workflows to track</p>
              </div>
            </div>
            {localConfig && Object.values(localConfig.categories).some((c: any) => c.workflows.length > 0) && (
              <div className="w-full sm:w-auto">
                <div className="flex justify-end">
                  <Button variant="default" size="sm" onClick={openConfigureModal}>
                    <Settings className="h-4 w-4" />
                    Configure Workflows
                  </Button>
                </div>
              </div>
            )}
          </div>
        </header>

        {localConfig && !Object.values(localConfig.categories).some((c: any) => c.workflows.length > 0) ? (
          // Empty state when there are no configured workflows yet
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="w-full max-w-xl">
              <div className="border rounded-lg bg-card/60 backdrop-blur-sm p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Settings className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">No workflows configured</h2>
                <p className="mt-2 text-sm text-muted-foreground">Configure workflows to start tracking runs and metrics.</p>
                <div className="mt-6 flex items-center justify-center">
                  <Button variant="default" size="sm" onClick={openConfigureModal} className="gap-2">
                    <Settings className="h-4 w-4" />
                    Configure Workflows
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {localConfig && Object.entries(localConfig.categories).map(([key, categoryConfig]: any) => (
              categoryConfig.workflows.length > 0 && (
                <div key={key} className="space-y-4">
                  <div className="flex items-center gap-2">
                    {key === 'utility' ? <Zap className="h-6 w-6" /> : key === 'trigger' ? <Target className="h-6 w-6" /> : key === 'testing' ? <TestTube className="h-6 w-6" /> : key === 'build' ? <Hammer className="h-6 w-6" /> : null}
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{categoryConfig.name}</h2>
                  </div>
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryConfig.workflows.map((file: string) => {
                      const mockRun: any = {
                        id: `local-${key}-${file}`,
                        name: file.replace('.yml', '').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                        workflow_id: `local-${file}`,
                        workflow_name: file,
                        conclusion: null,
                        status: 'didnt_run',
                        html_url: '#',
                        run_started_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        isMissing: true,
                      };
                      return (
                        <div key={file} className="relative">
                          <WorkflowCard
                            run={mockRun}
                            isReviewed={false}
                            onToggleReviewed={() => {}}
                            repoSlug={repoSlug}
                            neutral
                            rightAction={(
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRemoveLocalWorkflow(key, file)}
                                title="Remove workflow"
                                aria-label="Remove workflow"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-3xl rounded-lg border border-border bg-background shadow-lg">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold">Configure Workflows</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowConfigModal(false)}>Close</Button>
              </div>
              <div className="p-4 space-y-3">
                {configError && <p className="text-sm text-red-500">{configError}</p>}
                {isLoadingWorkflows ? (
                  <p className="text-sm text-muted-foreground">Loading workflows…</p>
                ) : availableWorkflows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No workflows found in the repository.</p>
                ) : (
                  <div
                    className={`space-y-2 ${availableWorkflows.length > 10 ? 'pr-3' : ''}`}
                    style={
                      availableWorkflows.length > 10
                        ? {
                            maxHeight: 56 * 10 + 8 * 9,
                            overflowY: 'auto',
                          }
                        : undefined
                    }
                  >
                    {availableWorkflows
                      .slice()
                      .sort((a, b) => {
                        const fa = (a.path?.split('/')?.pop() || a.name || '').toLowerCase();
                        const fb = (b.path?.split('/')?.pop() || b.name || '').toLowerCase();
                        return fa.localeCompare(fb);
                      })
                      .map((wf) => {
                      const file = wf.path?.split('/').pop() || wf.name;
                      const isConfigured = configuredFiles.includes(file);
                      return (
                        <div key={wf.id} className="flex items-center justify-between border border-border rounded-md p-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{wf.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{wf.path}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isConfigured ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="success">Configured</Badge>
                                <Button size="sm" variant="outline" onClick={() => {
                                  // remove from whichever category it exists in
                                  if (!localConfig) return;
                                  const entry = Object.entries(localConfig.categories).find(([_, c]: any) => c.workflows.includes(file));
                                  if (entry) {
                                    const [categoryKey] = entry as [string, any];
                                    handleRemoveLocalWorkflow(categoryKey, file);
                                  }
                                }}>Unconfigure</Button>
                              </div>
                            ) : (
                              <>
                                {[
                                  { key: 'build', label: 'Build', icon: <Hammer className="h-3 w-3" /> },
                                  { key: 'testing', label: 'Testing', icon: <TestTube className="h-3 w-3" /> },
                                  { key: 'trigger', label: 'Trigger', icon: <Target className="h-3 w-3" /> },
                                  { key: 'utility', label: 'Utility', icon: <Zap className="h-3 w-3" /> },
                                ]
                                  .sort((a, b) => a.label.localeCompare(b.label))
                                  .map(cat => (
                                    <Button key={cat.key} size="sm" variant="outline" onClick={() => addLocalWorkflowFile(cat.key, file)} className="flex items-center gap-1">
                                      {cat.icon}
                                      {cat.label}
                                    </Button>
                                  ))}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-border flex justify-end">
                <Button variant="default" size="sm" onClick={() => setShowConfigModal(false)}>Done</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
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
              <p className="text-muted-foreground">
                Workflow runs for {selectedDateStr}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log('🔄 Manual refresh triggered');
                refetchToday();
                refetchYesterday();
              }}
              disabled={todayLoading || yesterdayLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${(todayLoading || yesterdayLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {(todayLoading || yesterdayLoading) && <SkeletonCards />}
      {todayError && <ErrorState />}

      {/* When no workflows are configured, don't render the placeholder component */}
      {!todayLoading && !todayError && repoConfig && (() => {
        const totalWorkflows = Object.values(repoConfig.categories).reduce((total, category) => 
          total + category.workflows.length, 0
        );
        return null;
      })()}

      {/* Only show dashboard content if workflows are configured */}
      {!todayLoading && !todayError && repoConfig && (() => {
        const totalWorkflows = Object.values(repoConfig.categories).reduce((total, category) => 
          total + category.workflows.length, 0
        );
        
        if (totalWorkflows > 0) {
          return (
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
                    todayRuns={filterWorkflowsByCategories(workflowData || [], repoSlug)}
                    yesterdayRuns={filterWorkflowsByCategories(yesterdayWorkflowData || [], repoSlug)}
                    onMetricHover={handleMetricHover}
                    onMetricLeave={handleMetricLeave}
                  />
                </div>
              )}

              {categories && (
                <div className="space-y-12">
                  {Object.entries(repoConfig.categories).map(([key, categoryConfig]) => {
                    const getIcon = (categoryKey: string) => {
                      switch (categoryKey) {
                        case 'utility': return <Zap className="h-6 w-6" />;
                        case 'trigger': return <Target className="h-6 w-6" />;
                        case 'testing': return <TestTube className="h-6 w-6" />;
                        case 'build': return <Hammer className="h-6 w-6" />;
                        default: return null;
                      }
                    };

                    const isCollapsed = collapsedCategories[key];
                    const workflowCount = categories[key]?.length || 0;
                    const reviewedCount = categories[key]?.filter(workflow => reviewedWorkflows[workflow.id]).length || 0;
                    const allReviewed = workflowCount > 0 && reviewedCount === workflowCount;

                    // Determine badge variant based on review state
                    let badgeVariant = "secondary";
                    if (allReviewed) {
                      badgeVariant = "success"; // Green when all workflows are reviewed
                    }
                    // If no workflows are reviewed or some workflows are reviewed, keep as secondary (grey)

                    return (
                      <div key={key} className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-2">
                            {getIcon(key)}
                            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                              {categoryConfig.name}
                            </h2>
                          </div>
                          <div className="hidden sm:block flex-1 h-px bg-border"></div>
                          <Badge
                            variant={badgeVariant as any}
                            className="text-xs cursor-pointer hover:opacity-80 transition-opacity self-start sm:self-auto"
                            onClick={() => toggleCategory(key)}
                          >
                            {reviewedCount} / {workflowCount} workflows
                          </Badge>
                        </div>

                        {!isCollapsed && (
                          <>
                            {categories[key] && categories[key].length > 0 ? (
                              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {categories[key].map((run) => {
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
                                      reviewedTestingWorkflows={reviewedTestingWorkflows[run.id.toString()] || new Set()}
                                      onToggleTestingWorkflowReviewed={(testingWorkflowName) =>
                                        toggleTestingWorkflowReviewed(run.id, testingWorkflowName)
                                      }
                                    />
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <p className="text-muted-foreground">
                                  No workflows found for this category
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          );
        }
        return null;
      })()}
    </div>
  );
} 