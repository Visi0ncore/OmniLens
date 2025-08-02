import { format, startOfDay, endOfDay } from "date-fns";
import { removeEmojiFromWorkflowName, cleanWorkflowName, filterWorkflowsByCategories, calculateMissingWorkflows, getAllConfiguredWorkflows } from "./utils";

export interface WorkflowRun {
  id: number;
  name: string;
  workflow_id: number;
  workflow_name?: string; // Made optional since GitHub API doesn't provide this
  path?: string; // Added path field from GitHub API
  conclusion: string | null;
  status: string;
  html_url: string;
  run_started_at: string;
  updated_at: string;
  run_count?: number; // Number of times this workflow was run on this date
  all_runs?: Array<{
    id: number;
    conclusion: string | null;
    status: string;
    html_url: string;
    run_started_at: string;
  }>; // All runs for this workflow on this date
  isMissing?: boolean; // Flag to identify mock workflows
}

interface OverviewData {
  completedRuns: number;
  inProgressRuns: number;
  passedRuns: number;
  failedRuns: number;
  totalRuntime: number;
  didntRunCount: number;
  totalWorkflows: number;
  missingWorkflows: string[];
}

const API_BASE = "https://api.github.com";

// Helper function to get environment variables
function getEnvVars() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    throw new Error("Missing GITHUB_TOKEN or GITHUB_REPO env variables");
  }

  return { token, repo };
}

// Helper function to find which configured workflow file a run corresponds to
function getConfiguredWorkflowFile(run: WorkflowRun): string | null {
  const configuredWorkflows = getAllConfiguredWorkflows();
  
  // Extract just the filename from the run path (e.g., ".github/workflows/build-workflow.yml" -> "build-workflow.yml")
  const workflowPath = run.path || run.workflow_name;
  if (!workflowPath) return null;
  
  const filename = workflowPath.split('/').pop();
  if (!filename) return null;
  
  // Only return exact matches from workflows.json - no partial matching
  return configuredWorkflows.includes(filename) ? filename : null;
}

// Helper function to get only the latest run of each workflow
// This prevents displaying multiple runs when a workflow is triggered multiple times in a day
// Groups by configured workflow file name from workflows.json
function getLatestWorkflowRuns(workflowRuns: WorkflowRun[]): WorkflowRun[] {
  const latestRuns = new Map<string, WorkflowRun>();
  const duplicateCount = new Map<string, number>();
  const allRunsForWorkflow = new Map<string, Array<{
    id: number;
    conclusion: string | null;
    status: string;
    html_url: string;
    run_started_at: string;
  }>>();

  // Sort by run_started_at descending to get the most recent runs first
  const sortedRuns = workflowRuns.sort((a, b) =>
    new Date(b.run_started_at).getTime() - new Date(a.run_started_at).getTime()
  );

  // Keep only the latest run for each configured workflow file, but collect all runs
  // Use configured workflow file name as the key (from workflows.json)
  sortedRuns.forEach(run => {
    const configuredWorkflowFile = getConfiguredWorkflowFile(run);
    
    // Skip runs that don't match any configured workflow (should not happen after filtering)
    if (!configuredWorkflowFile) {
      // Silently skip unmatched runs - they're either not in workflows.json or from old workflow files
      return;
    }
    
    if (!latestRuns.has(configuredWorkflowFile)) {
      latestRuns.set(configuredWorkflowFile, run);
      duplicateCount.set(configuredWorkflowFile, 1);
      allRunsForWorkflow.set(configuredWorkflowFile, [{
        id: run.id,
        conclusion: run.conclusion,
        status: run.status,
        html_url: run.html_url,
        run_started_at: run.run_started_at
      }]);
    } else {
      // Count duplicates for logging
      duplicateCount.set(configuredWorkflowFile, (duplicateCount.get(configuredWorkflowFile) || 0) + 1);
      // Add this run to the collection
      const existingRuns = allRunsForWorkflow.get(configuredWorkflowFile) || [];
      existingRuns.push({
        id: run.id,
        conclusion: run.conclusion,
        status: run.status,
        html_url: run.html_url,
        run_started_at: run.run_started_at
      });
      allRunsForWorkflow.set(configuredWorkflowFile, existingRuns);
    }
  });

  // Log workflows that had multiple runs
  duplicateCount.forEach((count, configuredWorkflowFile) => {
    if (count > 1) {
      console.log(`Configured workflow "${configuredWorkflowFile}" had ${count} runs - using latest`);
    }
  });

  // Add run count and all runs to each workflow run
  const result = Array.from(latestRuns.values()).map(run => {
    const configuredWorkflowFile = getConfiguredWorkflowFile(run);
    return {
      ...run,
      run_count: duplicateCount.get(configuredWorkflowFile!) || 1,
      all_runs: allRunsForWorkflow.get(configuredWorkflowFile!) || []
    };
  });

  return result;
}

// Get workflow runs for a specific date
export async function getWorkflowRunsForDate(date: Date): Promise<WorkflowRun[]> {
  try {
    const { token, repo } = getEnvVars();

    // Format date to ISO string for GitHub API
    const dateStr = format(date, "yyyy-MM-dd");

    // Try broader time range to capture all runs for the date
    const startOfDay = `${dateStr}T00:00:00Z`;
    const endOfDay = `${dateStr}T23:59:59Z`;
    
    // Fetch all workflow runs for the date, handling pagination
    let allRuns: WorkflowRun[] = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      const res = await fetch(
        `${API_BASE}/repos/${repo}/actions/runs?created=${startOfDay}..${endOfDay}&per_page=100&page=${page}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      const pageRuns = json.workflow_runs as WorkflowRun[];
      
      allRuns = allRuns.concat(pageRuns);
      
      // Check if we need to fetch more pages
      hasMorePages = pageRuns.length === 100; // If we got 100 results, there might be more
      page++;
      
      console.log(`Page ${page - 1}: ${pageRuns.length} runs, Total so far: ${allRuns.length}`);
      
      // Safety break to avoid infinite loops
      if (page > 10) {
        console.warn('Breaking pagination after 10 pages to avoid infinite loop');
        break;
      }
    }

    console.log(`GitHub API returned ${allRuns.length} total runs for ${dateStr}`);

    // Return only the latest run of each workflow to avoid duplicates
    // when workflows are triggered multiple times throughout the day
    const latestRuns = getLatestWorkflowRuns(allRuns);

    console.log(`After deduplication: ${latestRuns.length} unique workflows`);

    return latestRuns;

  } catch (error) {
    console.error("Error fetching workflow runs:", error);
    throw error;
  }
}

// Calculate overview data from workflow runs
export function calculateOverviewData(workflowRuns: WorkflowRun[]): OverviewData {
  // Filter to only include workflows that are configured in categories
  const filteredRuns = filterWorkflowsByCategories(workflowRuns);

  const completedRuns = filteredRuns.filter(run => run.status === 'completed').length;
  const inProgressRuns = filteredRuns.filter(run =>
    run.status === 'in_progress' || run.status === 'queued'
  ).length;
  const passedRuns = filteredRuns.filter(run => run.conclusion === 'success').length;
  const failedRuns = filteredRuns.filter(run => run.conclusion === 'failure').length;

  // Calculate total runtime (this is an approximation - GitHub doesn't provide exact runtime in the list API)
  const totalRuntime = filteredRuns.reduce((total, run) => {
    if (run.status === 'completed') {
      // Estimate runtime based on update time vs start time
      const start = new Date(run.run_started_at).getTime();
      const end = new Date(run.updated_at).getTime();
      return total + Math.floor((end - start) / 1000); // Convert to seconds
    }
    return total;
  }, 0);

  // Calculate how many configured workflows didn't run (using original workflowRuns, not filtered)
  const missingWorkflows = calculateMissingWorkflows(workflowRuns);
  const didntRunCount = missingWorkflows.length;
  const totalWorkflows = filteredRuns.length;

  return {
    completedRuns,
    inProgressRuns,
    passedRuns,
    failedRuns,
    totalRuntime,
    didntRunCount,
    totalWorkflows,
    missingWorkflows,
  };
}

// Get overview data for a specific date
export async function getOverviewDataForDate(date: Date): Promise<OverviewData> {
  const workflowRuns = await getWorkflowRunsForDate(date);
  return calculateOverviewData(workflowRuns);
}

// Legacy functions for backward compatibility
export async function getTodayWorkflowRuns(): Promise<WorkflowRun[]> {
  return getWorkflowRunsForDate(new Date());
}

export async function getYesterdayWorkflowRuns(): Promise<WorkflowRun[]> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getWorkflowRunsForDate(yesterday);
}

export async function getTodayOverviewData(): Promise<OverviewData> {
  return getOverviewDataForDate(new Date());
}

export async function getYesterdayOverviewData(): Promise<OverviewData> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getOverviewDataForDate(yesterday);
} 