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
import { Zap, Target, TestTube, Calendar, Hammer, ArrowLeft, AlertCircle, Plus, Trash2, Settings, CheckCircle, Loader2 } from "lucide-react";
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

function categorizeWorkflows(runs: any[], _missingWorkflowsIgnored: string[] = [], repoSlug: string) {
  const repoConfig = getRepoConfig(repoSlug);
  if (!repoConfig) return {};

  const categories: Record<string, any[]> = {};

  Object.entries(repoConfig.categories).forEach(([key, categoryConfig]) => {
    // Only real runs that match configured files for this category
    const actualRuns = runs.filter(run => {
      const workflowFile = run.path || run.workflow_path || run.workflow_name || '';
      return categoryConfig.workflows.some((cfg: string) => workflowFile.includes(cfg));
    });

    categories[key] = actualRuns.sort((a, b) => {
      const cleanNameA = cleanWorkflowName(a.name || '');
      const cleanNameB = cleanWorkflowName(b.name || '');
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
  const isLocalRepo = repoSlug.startsWith('local-');
  const [addedRepoPath, setAddedRepoPath] = useState<string | null>(null);
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
    enabled: !!repoConfig || !!addedRepoPath,
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
    enabled: !!repoConfig || !!addedRepoPath,
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
  // Only derive categories when using env-configured repos; for local repos keep null
  const categories = (workflowData && repoConfig) ? categorizeWorkflows(workflowData, [], repoSlug) : null;

  // Lightweight polling to keep today's data fresh even if focus events are missed
  useEffect(() => {
    if (!isSelectedDateToday) return;
    const id = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        refetchToday();
      }
    }, 10000);
    return () => window.clearInterval(id);
  }, [isSelectedDateToday, refetchToday, repoSlug]);

  // Preload trigger map on load (env repos by slug; local repos by repoPath from storage)
  useEffect(() => {
    (async () => {
      try {
        let url: string | null = null;
        if (isLocalRepo) {
          let rp: string | null = addedRepoPath;
          if (!rp) {
            try {
              const stored = localStorage.getItem('userAddedRepos');
              if (stored) {
                const parsed = JSON.parse(stored) as Array<any>;
                const found = parsed.find(r => r.slug === repoSlug);
                rp = found?.repoPath || null;
              }
            } catch {}
          }
          if (rp) url = `/api/repositories/trigger-map?repoPath=${encodeURIComponent(rp)}`;
        } else {
          url = `/api/repositories/trigger-map?repo=${encodeURIComponent(repoSlug)}`;
        }
        if (!url) return;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const trig = await res.json();
          const cache = ((globalThis as any).__triggerMaps ||= {});
          cache[repoSlug] = trig;
        }
      } catch {}
    })();
  }, [repoSlug, isLocalRepo, addedRepoPath]);

  // (deferred skeleton render placed just before final return to avoid hook order issues)

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
    // Path 1: env-configured repos using computed categories
    if (categories) {
      const categoryWithWorkflow = Object.entries(categories).find(([_, workflows]) =>
        workflows.some(workflow => workflow.id === workflowId)
      );

      if (categoryWithWorkflow) {
        const [categoryKey, workflows] = categoryWithWorkflow;
        const allReviewed = workflows.every(workflow => reviewedState[workflow.id]);

        if (allReviewed && workflows.length > 0) {
          setCollapsedCategories(prevCollapsed => {
            const newCollapsedState = { ...prevCollapsed, [categoryKey]: true };
            saveCollapsedCategories(selectedDate, newCollapsedState);
            return newCollapsedState;
          });
        }
      }
      return;
    }

    // Path 2: local repos using localConfig + workflowData
    if (!categories && isLocalRepo && localConfig && Array.isArray(workflowData)) {
      const entries: Array<[string, { name: string; workflows: string[] }]> = Object.entries(localConfig.categories || {});
      for (const [categoryKey, catConfig] of entries) {
        const configuredFiles = new Set<string>(catConfig.workflows || []);
        const runsInCategory = (workflowData || []).filter((r: any) => {
          const wf = (r.path || r.workflow_path || r.workflow_name || '').toLowerCase();
          return Array.from(configuredFiles).some((f) => wf.includes(f.toLowerCase()));
        });
        const containsWorkflow = runsInCategory.some((r: any) => r.id === workflowId);
        if (!containsWorkflow) continue;

        const allReviewed = runsInCategory.length > 0 && runsInCategory.every((r: any) => reviewedState[r.id]);
        if (allReviewed) {
          setCollapsedCategories(prevCollapsed => {
            const newCollapsedState = { ...prevCollapsed, [categoryKey]: true };
            saveCollapsedCategories(selectedDate, newCollapsedState);
            return newCollapsedState;
          });
        }
        break;
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

  // Auto-collapse pass: when review state changes, verify all categories
  useEffect(() => {
    let changed = false;
    setCollapsedCategories(prev => {
      const next = { ...prev } as Record<string, boolean>;

      if (categories) {
        Object.entries(categories).forEach(([key, workflows]) => {
          if (workflows.length > 0 && workflows.every((w: any) => reviewedWorkflows[w.id])) {
            if (!next[key]) {
              next[key] = true;
              changed = true;
            }
          }
        });
      } else if (isLocalRepo && localConfig && Array.isArray(workflowData)) {
        Object.entries(localConfig.categories || {}).forEach(([key, cat]: any) => {
          const configuredFiles = new Set<string>((cat?.workflows as string[]) || []);
          const runsInCategory = (workflowData || []).filter((r: any) => {
            const wf = (r.path || r.workflow_path || r.workflow_name || '').toLowerCase();
            return Array.from(configuredFiles).some((f) => wf.includes(f.toLowerCase()));
          });
          if (runsInCategory.length > 0 && runsInCategory.every((r: any) => reviewedWorkflows[r.id])) {
            if (!next[key]) {
              next[key] = true;
              changed = true;
            }
          }
        });
      }

      if (changed) {
        try { saveCollapsedCategories(selectedDate, next); } catch {}
      }
      return next;
    });
  }, [reviewedWorkflows, categories, /* localConfig below is declared later; keep effect after mount */ workflowData, isLocalRepo, selectedDate]);

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
  const [isPreparingTriggers, setIsPreparingTriggers] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [localToday, setLocalToday] = useState<{ workflowRuns: any[]; overviewData: any } | null>(null);
  const [localYesterday, setLocalYesterday] = useState<{ workflowRuns: any[]; overviewData: any } | null>(null);
  
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
  type FetchPhase = 'idle' | 'loading' | 'success' | 'error';
  const [fetchStatus, setFetchStatus] = useState<{ today: FetchPhase; yesterday: FetchPhase }>({ today: 'idle', yesterday: 'idle' });

  // Ensure trigger map is loaded for current repo before opening modal
  const ensureTriggerMapLoaded = useCallback(async () => {
    try {
      setIsPreparingTriggers(true);
      let url: string | null = null;
      let repoPathForMap: string | null = null;
      if (isLocalRepo) {
        repoPathForMap = addedRepoPath;
        if (!repoPathForMap) {
          try {
            const stored = localStorage.getItem('userAddedRepos');
            if (stored) {
              const parsed = JSON.parse(stored) as Array<any>;
              const found = parsed.find(r => r.slug === repoSlug);
              repoPathForMap = found?.repoPath || null;
            }
          } catch {}
        }
        if (repoPathForMap) url = `/api/repositories/trigger-map?repoPath=${encodeURIComponent(repoPathForMap)}`;
      } else {
        url = `/api/repositories/trigger-map?repo=${encodeURIComponent(repoSlug)}`;
      }

      const cache = (globalThis as any).__triggerMaps as Record<string, any> | undefined;
      if (cache && cache[repoSlug]) return;

      if (!url) { setIsPreparingTriggers(false); return; }
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const trig = await res.json();
        const c = ((globalThis as any).__triggerMaps ||= {});
        c[repoSlug] = trig;
      }
    } catch {}
    finally { setIsPreparingTriggers(false); }
  }, [repoSlug, isLocalRepo, addedRepoPath]);

  const openConfigureModal = useCallback(async () => {
    setConfigError(null);
    setIsLoadingWorkflows(true);
    try {
      // Prepare trigger map first so grouping is ready on open
      await ensureTriggerMapLoaded();
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

      setIsLoadingWorkflows(false);
      setShowConfigModal(true);

      // Preload today's and yesterday's workflow data into React Query cache (run after list is visible)
      const selectedStr = format(selectedDate, "yyyy-MM-dd");
      const y = new Date(selectedDate);
      y.setDate(y.getDate() - 1);
      const yesterdayStr = format(y, "yyyy-MM-dd");

      setFetchStatus({ today: 'loading', yesterday: 'loading' });
      // Prefer repoPath if available (added repos)
      const repoPathForFetch = (() => {
        try {
          const stored = localStorage.getItem('userAddedRepos');
          if (!stored) return null;
          const parsed = JSON.parse(stored) as Array<any>;
          const found = parsed.find(r => r.slug === repoSlug);
          return found?.repoPath || null;
        } catch { return null; }
      })();

      const todayUrl = repoPathForFetch
        ? `/api/workflows?date=${encodeURIComponent(selectedStr)}&repoPath=${encodeURIComponent(repoPathForFetch)}&_t=${Date.now()}`
        : `/api/workflows?date=${encodeURIComponent(selectedStr)}&repo=${encodeURIComponent(repoSlug)}&_t=${Date.now()}`;
      const yUrl = repoPathForFetch
        ? `/api/workflows?date=${encodeURIComponent(yesterdayStr)}&repoPath=${encodeURIComponent(repoPathForFetch)}&_t=${Date.now()}`
        : `/api/workflows?date=${encodeURIComponent(yesterdayStr)}&repo=${encodeURIComponent(repoSlug)}&_t=${Date.now()}`;

      const [todayRes, yRes] = await Promise.all([
        fetch(todayUrl, { cache: 'no-store' }),
        fetch(yUrl, { cache: 'no-store' })
      ]);

      if (todayRes.ok) {
        const todayJson = await todayRes.json();
        queryClient.setQueryData(["workflowData", repoSlug, selectedStr], todayJson);
        setFetchStatus(prev => ({ ...prev, today: 'success' }));
      } else {
        setFetchStatus(prev => ({ ...prev, today: 'error' }));
      }
      if (yRes.ok) {
        const yJson = await yRes.json();
        // Keep key aligned with page query key which uses selected date
        queryClient.setQueryData(["yesterdayWorkflowData", repoSlug, selectedStr], yJson);
        setFetchStatus(prev => ({ ...prev, yesterday: 'success' }));
      } else {
        setFetchStatus(prev => ({ ...prev, yesterday: 'error' }));
      }

      // If this repo isn't recognized by server config, fetch via repoPath and compute metrics for UI
      if (!repoConfig) {
        const repoPath = (() => {
          try {
            const stored = localStorage.getItem('userAddedRepos');
            if (!stored) return null;
            const parsed = JSON.parse(stored) as Array<any>;
            const found = parsed.find(r => r.slug === repoSlug);
            return found?.repoPath || null;
          } catch { return null; }
        })();
        const configuredFiles: string[] = localConfig ? Object.values(localConfig.categories).flatMap((c: any) => c.workflows) : [];
        if (repoPath && configuredFiles.length > 0) {
          const filterToConfigured = (runs: any[]) => runs.filter((r: any) => {
            const file = (r.path || r.workflow_path || r.workflow_name || '').split('/').pop();
            return file && configuredFiles.some(cfg => file.includes(cfg));
          });
            const computeOverview = (runs: any[]) => {
            const completedRuns = runs.filter((r: any) => r.status === 'completed').length;
            const inProgressRuns = runs.filter((r: any) => r.status === 'in_progress' || r.status === 'queued').length;
            const passedRuns = runs.filter((r: any) => r.conclusion === 'success').length;
            const failedRuns = runs.filter((r: any) => r.conclusion === 'failure').length;
            const totalRuntime = runs.reduce((total: number, r: any) => {
              if (r.status === 'completed') {
                const start = new Date(r.run_started_at).getTime();
                const end = new Date(r.updated_at).getTime();
                return total + Math.max(0, Math.floor((end - start) / 1000));
              }
              return total;
            }, 0);
              // Total configured workflows should reflect user configuration, not runs-length
              const totalWorkflows = configuredFiles.length;
              const ran = new Set<string>();
              runs.forEach((r: any) => {
                const file = (r.path || r.workflow_path || r.workflow_name || '').split('/').pop();
                if (!file) return;
                configuredFiles.forEach(cfg => { if (file.includes(cfg)) ran.add(cfg); });
              });
              const missingWorkflows = Array.from(configuredFiles).filter(f => !ran.has(f));
              return { completedRuns, inProgressRuns, passedRuns, failedRuns, totalRuntime, didntRunCount: missingWorkflows.length, totalWorkflows, missingWorkflows };
          };
          const [tRes2, yRes2] = await Promise.all([
            fetch(`/api/repositories/workflow-runs?repoPath=${encodeURIComponent(repoPath)}&date=${encodeURIComponent(selectedStr)}`, { cache: 'no-store' }),
            fetch(`/api/repositories/workflow-runs?repoPath=${encodeURIComponent(repoPath)}&date=${encodeURIComponent(yesterdayStr)}`, { cache: 'no-store' })
          ]);
          if (tRes2.ok) {
            const tJson = await tRes2.json();
            const tRuns = filterToConfigured(tJson.workflow_runs || []);
            const tOverview = computeOverview(tRuns);
            setLocalToday({ workflowRuns: tRuns, overviewData: tOverview });
            queryClient.setQueryData(["workflowData", repoSlug, selectedStr], { workflowRuns: tRuns, overviewData: tOverview });
          }
          if (yRes2.ok) {
            const yJ = await yRes2.json();
            const yRuns = filterToConfigured(yJ.workflow_runs || []);
            const yOverview = computeOverview(yRuns);
            setLocalYesterday({ workflowRuns: yRuns, overviewData: yOverview });
            queryClient.setQueryData(["yesterdayWorkflowData", repoSlug, selectedStr], { workflowRuns: yRuns, overviewData: yOverview });
          }
        }
      }
    } catch (e) {
      setConfigError('Failed to fetch workflows');
      setFetchStatus({ today: 'error', yesterday: 'error' });
      setIsLoadingWorkflows(false);
    }
  }, [repoSlug, selectedDate, queryClient, ensureTriggerMapLoaded]);

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
                    setHoverState({ metricType: null, workflowIds: new Set() });
                  }
                }}
                placeholder="Select Date"
              />
              {/* Removed manual refresh; auto-refresh is handled via polling and focus events */}
              {localConfig && Object.values(localConfig.categories).some((c: any) => c.workflows.length > 0) && (
                <Button variant="default" size="sm" onClick={openConfigureModal} className="gap-2">
                  {(isPreparingTriggers || isLoadingWorkflows) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  Configure Workflows
                </Button>
              )}
            </div>
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
                    {(isPreparingTriggers || isLoadingWorkflows) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Settings className="h-4 w-4" />
                    )}
                    Configure Workflows
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Metrics row */}
            {workflowData && overviewData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-8">
                <OverviewMetrics
                  data={(() => {
                    if (!repoConfig && isLocalRepo && localConfig) {
                      // Build configured set and filter today's runs to configured
                      const configuredFiles: string[] = Object.values(localConfig.categories).flatMap((c: any) => c.workflows);
                      const configuredSet = new Set<string>(configuredFiles);
                      const runs = (workflowData || []).filter((r: any) => {
                        const file = (r.path || r.workflow_path || r.workflow_name || '').split('/').pop();
                        return file && Array.from(configuredSet).some((cfg) => (file as string).includes(cfg));
                      });

                      // Compute overview strictly from configured runs
                      const completedRuns = runs.filter((r: any) => r.status === 'completed').length;
                      const inProgressRuns = runs.filter((r: any) => r.status === 'in_progress' || r.status === 'queued').length;
                      const passedRuns = runs.filter((r: any) => r.conclusion === 'success').length;
                      const failedRuns = runs.filter((r: any) => r.conclusion === 'failure').length;
                      const totalRuntime = runs.reduce((total: number, r: any) => {
                        if (r.status === 'completed') {
                          const start = new Date(r.run_started_at).getTime();
                          const end = new Date(r.updated_at).getTime();
                          return total + Math.max(0, Math.floor((end - start) / 1000));
                        }
                        return total;
                      }, 0);

                      // Determine configured-but-did-not-run
                      const ran = new Set<string>();
                      runs.forEach((r: any) => {
                        const file = (r.path || r.workflow_path || r.workflow_name || '').split('/').pop();
                        if (!file) return;
                        configuredFiles.forEach(cfg => { if ((file as string).includes(cfg)) ran.add(cfg); });
                      });
                      const missingWorkflows = configuredFiles.filter(f => !ran.has(f));

                      const reviewedPct = (() => {
                        const shownIds = runs.map((r: any) => r.id);
                        const reviewedCount = shownIds.filter((id: number) => reviewedWorkflows[id]).length;
                        return shownIds.length > 0 ? Math.round((reviewedCount / shownIds.length) * 100) : 0;
                      })();

                      return {
                        completedRuns,
                        inProgressRuns,
                        passedRuns,
                        failedRuns,
                        totalRuntime,
                        didntRunCount: missingWorkflows.length,
                        totalWorkflows: configuredFiles.length,
                        missingWorkflows,
                        reviewedPercentage: reviewedPct,
                      } as any;
                    }
                    return overviewData;
                  })()}
                  reviewedPercentage={(() => {
                    if (!repoConfig && isLocalRepo && localConfig) {
                      const configuredFiles: string[] = Object.values(localConfig.categories).flatMap((c: any) => c.workflows);
                      const configuredSet = new Set<string>(configuredFiles);
                      const runs = (workflowData || []).filter((r: any) => {
                        const file = (r.path || r.workflow_path || r.workflow_name || '').split('/').pop();
                        return file && Array.from(configuredSet).some((cfg) => (file as string).includes(cfg));
                      });
                      const shownIds = runs.map((r: any) => r.id);
                      const reviewedCount = shownIds.filter((id: number) => reviewedWorkflows[id]).length;
                      return shownIds.length > 0 ? Math.round((reviewedCount / shownIds.length) * 100) : 0;
                    }
                    return 0;
                  })()}
                  onMetricHover={handleMetricHover}
                  onMetricLeave={handleMetricLeave}
                />
                {(() => {
                  const configured = new Set<string>(
                    localConfig ? Object.values(localConfig.categories).flatMap((c: any) => c.workflows) : []
                  );
                  const filterToConfigured = (runs: any[]) => runs.filter((r: any) => {
                    const file = (r.path || r.workflow_path || r.workflow_name || '').split('/').pop();
                    return file && Array.from(configured).some(cfg => file.includes(cfg));
                  });
                  // Use only configured runs for Daily Metrics as well
                  const todayConfigured = filterToConfigured(workflowData || []);
                  const yConfigured = filterToConfigured(yesterdayWorkflowData || []);
                  return (
                    <WorkflowMetrics
                      todayRuns={todayConfigured}
                      yesterdayRuns={yConfigured}
                      onMetricHover={handleMetricHover}
                      onMetricLeave={handleMetricLeave}
                    />
                  );
                })()}
              </div>
            )}

            <div className="space-y-12">
              {localConfig && Object.entries(localConfig.categories).map(([key, categoryConfig]: any) => (
                categoryConfig.workflows.length > 0 && (
                  <div key={key} className="space-y-4">
                    {(() => {
                      // Build one item per configured workflow: latest run if present, otherwise a "didn't run" placeholder
                      const configuredFilesArr: string[] = categoryConfig.workflows || [];
                      const configuredFiles = new Set<string>(configuredFilesArr);
                      const todaysRuns = (workflowData || []).filter((r: any) => {
                        const wf = (r.path || r.workflow_path || r.workflow_name || '').toLowerCase();
                        return Array.from(configuredFiles).some(f => wf.includes(f.toLowerCase()));
                      });

                      // Map latest run per configured file
                      const latestByFile = new Map<string, any>();
                      for (const run of todaysRuns) {
                        const wf = (run.path || run.workflow_path || run.workflow_name || '').toLowerCase();
                        const match = configuredFilesArr.find(f => wf.includes(f.toLowerCase()));
                        if (!match) continue;
                        const prev = latestByFile.get(match);
                        if (!prev || new Date(run.run_started_at).getTime() > new Date(prev.run_started_at).getTime()) {
                          latestByFile.set(match, run);
                        }
                      }

                      // Build final list including placeholders for those that didn't run today
                      const runsInCategory = configuredFilesArr.map((file, idx) => {
                        const found = latestByFile.get(file);
                        if (found) return found;
                        // Create a placeholder run for UI rendering
                        return {
                          id: -(idx + 1),
                          name: file.replace(/\.ya?ml$/i, '').replace(/[-_]/g, ' '),
                          workflow_name: file,
                          path: `.github/workflows/${file}`,
                          conclusion: null,
                          status: 'missing',
                          html_url: '#',
                          run_started_at: selectedDate.toISOString(),
                          updated_at: selectedDate.toISOString(),
                          isMissing: true,
                        } as any;
                      }).sort((a: any, b: any) => new Date(b.run_started_at).getTime() - new Date(a.run_started_at).getTime());

                      const isCollapsed = collapsedCategories[key];
                      const workflowCount = runsInCategory.length;
                      const reviewedCount = runsInCategory.filter((wf: any) => reviewedWorkflows[wf.id]).length;
                      const allReviewed = workflowCount > 0 && reviewedCount === workflowCount;

                      // Determine badge variant based on review state
                      let badgeVariant: any = "secondary";
                      if (allReviewed) badgeVariant = "success";

                      return (
                        <>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                              {key === 'utility' ? <Zap className="h-6 w-6" /> : key === 'trigger' ? <Target className="h-6 w-6" /> : key === 'testing' ? <TestTube className="h-6 w-6" /> : key === 'build' ? <Hammer className="h-6 w-6" /> : null}
                              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{categoryConfig.name}</h2>
                            </div>
                            <div className="hidden sm:block flex-1 h-px bg-border" />
                            <Badge
                              variant={badgeVariant}
                              className="text-xs cursor-pointer hover:opacity-80 transition-opacity self-start sm:self-auto"
                              onClick={() => toggleCategory(key)}
                            >
                              {reviewedCount} / {workflowCount} workflows
                            </Badge>
                          </div>

                          {!isCollapsed && (
                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                              {runsInCategory.map((run: any) => (
                                <div key={run.id} className="relative">
                                  <WorkflowCard
                                    run={run}
                                    isReviewed={reviewedWorkflows[run.id] || false}
                                    onToggleReviewed={() => toggleReviewed(run.id)}
                                    repoSlug={repoSlug}
                                    allWorkflowRuns={workflowData || []}
                                    reviewedTestingWorkflows={reviewedTestingWorkflows[run.id.toString()] || new Set()}
                                    onToggleTestingWorkflowReviewed={(testingWorkflowName) =>
                                      toggleTestingWorkflowReviewed(run.id, testingWorkflowName)
                                    }
                                    rightAction={(
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleRemoveLocalWorkflow(key, run.workflow_name || run.path?.split('/').pop() || '')}
                                        title="Remove workflow"
                                        aria-label="Remove workflow"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )
              ))}
            </div>
          </>
        )}

        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-3xl rounded-lg border border-border bg-background shadow-lg">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">Configure Workflows</h2>
                  {(() => {
                    const configuredCount = localConfig ? Object.values(localConfig.categories).flatMap((c: any) => c.workflows).length : 0;
                    // Compute visible list count using the same trigger-filter/grouping rules as the list
                    const trig = ((globalThis as any).__triggerMaps || {})[repoSlug] as any | undefined;
                    const byFile: Record<string, string[]> = trig?.fileToTesting || {};
                    const byName: Record<string, string[]> = trig?.nameToTesting || {};
                    const normalize = (s: string | undefined | null) => (s ? String(s).toLowerCase().trim() : '');
                    const testingFileSet = new Set<string>();
                    Object.values(byFile).forEach((arr: any) => (arr || []).forEach((f: string) => testingFileSet.add(String(f).toLowerCase())));
                    Object.values(byName).forEach((arr: any) => (arr || []).forEach((f: string) => testingFileSet.add(String(f).toLowerCase())));

                    const visibleTotal = availableWorkflows
                      .slice()
                      .map((wf) => {
                        const file = wf.path?.split('/')?.pop() || wf.name;
                        const sortKey = (file || '').toLowerCase();
                        const fromFile = (byFile[sortKey] || []) as string[];
                        const fromName = byName[normalize(wf.name)] || [];
                        const testingBases = Array.from(new Set([...(fromFile || []), ...(fromName || [])]));
                        const isTriggerDetected = testingBases.length > 0;
                        const isTestingChild = testingFileSet.has(sortKey);
                        return { isTriggerDetected, isTestingChild };
                      })
                      .filter((row) => !(row.isTestingChild && !row.isTriggerDetected))
                      .length;

                    return (
                      <Badge variant="secondary" className="text-xs">{configuredCount} / {visibleTotal} configured</Badge>
                    );
                  })()}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowConfigModal(false)}>Close</Button>
              </div>
              <div className="p-4 space-y-3">
                {configError && <p className="text-sm text-red-500">{configError}</p>}
                {availableWorkflows.length === 0 ? (
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
                    {/* Group triggers to the top, keep alphabetical sorting within each group */}
                    {(() => {
                      const triggerMap = ((globalThis as any).__triggerMaps || {})[repoSlug] as any | undefined;
                      const byFile: Record<string, string[]> = triggerMap?.fileToTesting || {};
                      const byName: Record<string, string[]> = triggerMap?.nameToTesting || {};
                      const normalize = (s: string | undefined | null) => (s ? String(s).toLowerCase().trim() : '');
                      // Build quick lookup for workflow meta by base file name
                      const metaByBase: Record<string, { name: string; path: string } > = {};
                      for (const w of availableWorkflows) {
                        const b = (w.path?.split('/')?.pop() || w.name || '').toLowerCase();
                        metaByBase[b] = { name: w.name, path: w.path } as any;
                      }

                      // Build a set of all testing workflow basenames referenced by any trigger
                      const testingFileSet = new Set<string>();
                      Object.values(byFile).forEach((arr) => (arr || []).forEach((f) => testingFileSet.add(String(f).toLowerCase())));
                      Object.values(byName).forEach((arr) => (arr || []).forEach((f) => testingFileSet.add(String(f).toLowerCase())));

                      const enriched = availableWorkflows
                        .slice()
                        .map((wf) => {
                          const file = wf.path?.split('/')?.pop() || wf.name;
                          const sortKey = (file || '').toLowerCase();
                          // Collect testing files from both file-based and name-based mappings
                          const fromFile = (byFile[sortKey] || []) as string[];
                          const fromName = byName[normalize(wf.name)] || [];
                          const testingBases = Array.from(new Set([...(fromFile || []), ...(fromName || [])]));
                          const testingCount = testingBases.length;
                          const isTriggerDetected = testingCount > 0;
                          const testingDetails = testingBases.map((tb) => {
                            const meta = metaByBase[tb];
                            return {
                              base: tb,
                              name: meta?.name || tb.replace(/\.ya?ml$/i, '').replace(/[-_]/g, ' '),
                              path: meta?.path || `/.github/workflows/${tb}`,
                            };
                          });
                          const isTestingChild = testingFileSet.has(sortKey);
                          return { wf, file, sortKey, testingCount, isTriggerDetected, testingDetails, isTestingChild };
                        })
                        .sort((a, b) => {
                          if (a.isTriggerDetected !== b.isTriggerDetected) {
                            return a.isTriggerDetected ? -1 : 1;
                          }
                          return a.sortKey.localeCompare(b.sortKey);
                        })
                        // Hide testing workflows that are listed under a trigger (keep if they are also triggers)
                        .filter((row) => !(row.isTestingChild && !row.isTriggerDetected));

                      return enriched.map(({ wf, file, testingCount, isTriggerDetected, testingDetails }) => {
                        const isConfigured = configuredFiles.includes(file);
                        return (
                        <div key={wf.id} className="flex items-start justify-between border border-border rounded-md p-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{wf.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{wf.path}</div>
                            {isTriggerDetected && testingDetails.length > 0 && (
                              <div className="mt-2">
                                <div className="grid gap-1">
                                  {testingDetails
                                    .slice()
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((td) => (
                                      <div key={td.base} className="text-xs leading-tight truncate">{td.name}</div>
                                    ))}
                                </div>
                              </div>
                            )}
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
                                  { key: 'trigger', label: isTriggerDetected ? `Trigger (${testingCount})` : 'Trigger', icon: <Target className={`h-3 w-3 ${isTriggerDetected ? 'text-green-500' : ''}`} /> },
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
                      });
                    })()}
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

  // Show full dashboard skeleton while loading to avoid UI popping
  if (todayLoading || yesterdayLoading) {
    return <DashboardSkeleton />;
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
            {/* Removed manual refresh; auto-refresh is handled via polling and focus events */}
            {(() => {
              const hasConfiguredLocal = !!localConfig && Object.values(localConfig.categories).some((c: any) => c.workflows.length > 0);
              const hasConfiguredEnv = !!repoConfig && Object.values(repoConfig.categories).some((c: any) => (c as any).workflows?.length > 0);
              const showHeaderConfigure = hasConfiguredLocal || hasConfiguredEnv;
              if (!showHeaderConfigure) return null;
              return (
                <Button variant="default" size="sm" onClick={openConfigureModal} className="gap-2">
                  {(isPreparingTriggers || isLoadingWorkflows) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  Configure Workflows
                </Button>
              );
            })()}
          </div>
        </div>
      </header>

      {todayError && <ErrorState />}

      {/* When no workflows are configured, don't render the placeholder component */}
      {!todayLoading && !todayError && (() => {
        // For env repos, check config. For added repos, check local config or fetched runs
        if (repoConfig) {
          const totalWorkflows = Object.values(repoConfig.categories).reduce((total, category: any) => total + category.workflows.length, 0);
          if (totalWorkflows === 0) return null;
        } else {
          // For added repos, if we have no runs and no configured local files, do not render
          const hasLocalConfigured = localConfig && Object.values(localConfig.categories).some((c: any) => c.workflows.length > 0);
          if (!hasLocalConfigured && !(workflowData && workflowData.length > 0)) return null;
        }
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

              {categories && overviewData && (
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