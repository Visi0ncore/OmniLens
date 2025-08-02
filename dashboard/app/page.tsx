"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
import { Zap, Target, TestTube, Calendar, Hammer } from "lucide-react";
import workflowConfig from "@/config/workflows.json";
import { removeEmojiFromWorkflowName, cleanWorkflowName, filterWorkflowsByCategories, calculateMissingWorkflows } from "@/lib/utils";

// Types for hover state management
type MetricType = 'consistent' | 'improved' | 'regressed' | 'regressing' | 'didnt_run';
interface HoverState {
  metricType: MetricType | null;
  workflowIds: Set<string | number>; // Support both string IDs (missing workflows) and number IDs (actual workflows)
}

function categorizeWorkflows(runs: any[], missingWorkflows: string[] = []) {
  // Debug: log the full structure of a workflow run
  if (runs.length > 0) {
    console.log("Full workflow run object:", runs[0]);
  }
  
  const categories: Record<string, any[]> = {};
  
  Object.entries(workflowConfig.categories).forEach(([key, config]) => {
    // Get actual workflow runs for this category
    const actualRuns = runs.filter(run => {
      // Try different possible fields that might contain the workflow file name
      const workflowFile = run.path || run.workflow_path || run.head_commit?.message || run.workflow_name;
      return config.workflows.some(configWorkflow => 
        workflowFile && workflowFile.includes(configWorkflow)
      );
    });
    
    // Create mock workflow runs for missing workflows in this category
    const missingInCategory = missingWorkflows.filter(workflow => 
      config.workflows.includes(workflow)
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
const fetchWorkflowData = async (date: Date) => {
  const dateStr = format(date, "yyyy-MM-dd");
  const response = await fetch(`/api/workflows?date=${dateStr}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch workflow data');
  }
  
  return response.json();
};

export default function DashboardPage() {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [reviewedWorkflows, setReviewedWorkflows] = useState<Record<number, boolean>>({});
  const [reviewedTestingWorkflows, setReviewedTestingWorkflows] = useState<Record<string, Set<string>>>({});
  const [hoverState, setHoverState] = useState<HoverState>({ metricType: null, workflowIds: new Set() });
  
  // Initialize with today's date explicitly
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Helper functions for localStorage
  const getStorageKey = (date: Date) => {
    return `reviewedWorkflows-${format(date, "yyyy-MM-dd")}`;
  };

  const getCollapsedCategoriesKey = (date: Date) => {
    return `collapsedCategories-${format(date, "yyyy-MM-dd")}`;
  };

  const getTestingWorkflowsKey = (date: Date) => {
    return `reviewedTestingWorkflows-${format(date, "yyyy-MM-dd")}`;
  };

  const loadReviewedWorkflows = (date: Date) => {
    try {
      const stored = localStorage.getItem(getStorageKey(date));
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load reviewed workflows from localStorage:', error);
    }
    return {};
  };

  const loadCollapsedCategories = (date: Date) => {
    try {
      const stored = localStorage.getItem(getCollapsedCategoriesKey(date));
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load collapsed categories from localStorage:', error);
    }
    return {};
  };

  const loadReviewedTestingWorkflows = (date: Date) => {
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
  };

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
  }, [selectedDate]);
  
  // Single query for today's data
  const { data: todayData, isLoading: todayLoading, isError: todayError } = useQuery({
    queryKey: ["workflowData", format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      return await fetchWorkflowData(selectedDate);
    },
  });

  // Also fetch yesterday's data for comparison
  const yesterday = new Date(selectedDate);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: yesterdayData } = useQuery({
    queryKey: ["workflowData", format(yesterday, "yyyy-MM-dd")],
    queryFn: async () => {
      return await fetchWorkflowData(yesterday);
    },
  });

  // Extract data from the single response
  const workflowData = todayData?.workflowRuns;
  const overviewData = todayData?.overviewData;
  const yesterdayWorkflowData = yesterdayData?.workflowRuns;

  const selectedDateStr = format(selectedDate, "EEEE, MMMM d, yyyy");
  const isSelectedDateToday = isToday(selectedDate);

  const missingWorkflows = workflowData ? calculateMissingWorkflows(workflowData) : [];
  const categories = workflowData ? categorizeWorkflows(workflowData, missingWorkflows) : null;

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

  const toggleReviewed = (workflowId: number) => {
    setReviewedWorkflows(prev => {
      const newState = {
        ...prev,
        [workflowId]: !prev[workflowId]
      };
      
      // Save to localStorage
      saveReviewedWorkflows(selectedDate, newState);
      
      // Simple rule: Check if we need to auto-collapse any categories
      if (categories) {
        Object.entries(categories).forEach(([categoryKey, workflows]) => {
          const allReviewed = workflows.every(workflow => newState[workflow.id]);
          
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
        });
      }
      
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
      
      // Check if we need to unmark the trigger workflow as reviewed
      // If we're removing a testing workflow from reviewed, and the trigger is currently reviewed,
      // then unmark the trigger as reviewed
      if (!newSet.has(testingWorkflowName) && reviewedWorkflows[triggerWorkflowId]) {
        setReviewedWorkflows(prev => {
          const newReviewedState = {
            ...prev,
            [triggerWorkflowId]: false
          };
          saveReviewedWorkflows(selectedDate, newReviewedState);
          return newReviewedState;
        });
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

  return (
    <div className="container mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">👁️ OmniLens</h1>
            <p className="text-muted-foreground">
              Workflow runs for {selectedDateStr}
            </p>
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
          </div>
        </div>
      </header>

      {todayLoading && <SkeletonCards />}
      {todayError && <ErrorState />}
      
      {/* Compact Overview Row */}
      {workflowData && overviewData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-8">
          <OverviewMetrics 
            data={overviewData} 
            onMetricHover={handleMetricHover}
            onMetricLeave={handleMetricLeave}
          />
          <WorkflowMetrics 
            todayRuns={filterWorkflowsByCategories(workflowData || [])} 
            yesterdayRuns={filterWorkflowsByCategories(yesterdayWorkflowData || [])} 
            onMetricHover={handleMetricHover}
            onMetricLeave={handleMetricLeave}
          />
        </div>
      )}
      
      {categories && (
        <div className="space-y-12">
          {Object.entries(workflowConfig.categories).map(([key, config]) => {
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
                      {config.name}
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
    </div>
  );
} 