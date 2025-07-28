import { format, startOfDay, endOfDay } from "date-fns";
import { removeEmojiFromWorkflowName, cleanWorkflowName, filterWorkflowsByCategories, calculateMissingWorkflows } from "./utils";

export interface WorkflowRun {
  id: number;
  name: string;
  workflow_id: number;
  workflow_name: string;
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

// Helper function to get only the latest run of each workflow
// This prevents displaying multiple runs when a workflow is triggered multiple times in a day
function getLatestWorkflowRuns(workflowRuns: WorkflowRun[]): WorkflowRun[] {
  const latestRuns = new Map<number, WorkflowRun>();
  const duplicateCount = new Map<number, number>();
  const allRunsForWorkflow = new Map<number, Array<{
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

  // Keep only the latest run for each workflow_id, but collect all runs
  sortedRuns.forEach(run => {
    if (!latestRuns.has(run.workflow_id)) {
      latestRuns.set(run.workflow_id, run);
      duplicateCount.set(run.workflow_id, 1);
      allRunsForWorkflow.set(run.workflow_id, [{
        id: run.id,
        conclusion: run.conclusion,
        status: run.status,
        html_url: run.html_url,
        run_started_at: run.run_started_at
      }]);
    } else {
      // Count duplicates for logging
      duplicateCount.set(run.workflow_id, (duplicateCount.get(run.workflow_id) || 0) + 1);
      // Add this run to the collection
      const existingRuns = allRunsForWorkflow.get(run.workflow_id) || [];
      existingRuns.push({
        id: run.id,
        conclusion: run.conclusion,
        status: run.status,
        html_url: run.html_url,
        run_started_at: run.run_started_at
      });
      allRunsForWorkflow.set(run.workflow_id, existingRuns);
    }
  });

  // Log workflows that had multiple runs
  duplicateCount.forEach((count, workflowId) => {
    if (count > 1) {
      const workflow = latestRuns.get(workflowId);
      const cleanName = cleanWorkflowName(workflow?.workflow_name || workflow?.name || 'Unknown');
      // console.log(`Workflow "${cleanName}" (ID: ${workflowId}) had ${count} runs - using latest`);
    }
  });

  // Add run count and all runs to each workflow run
  const result = Array.from(latestRuns.values()).map(run => ({
    ...run,
    run_count: duplicateCount.get(run.workflow_id) || 1,
    all_runs: allRunsForWorkflow.get(run.workflow_id) || []
  }));

  return result;
}

// Get workflow runs for a specific date
export async function getWorkflowRunsForDate(date: Date): Promise<WorkflowRun[]> {
  try {
    const { token, repo } = getEnvVars();

    // Format date to ISO string for GitHub API
    const dateStr = format(date, "yyyy-MM-dd");

    const res = await fetch(
      `${API_BASE}/repos/${repo}/actions/runs?created=${dateStr}&per_page=100`,
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
    const allRuns = json.workflow_runs as WorkflowRun[];

    // console.log(`\nFetched ${allRuns.length} total workflow runs for ${dateStr}`);

    // Return only the latest run of each workflow to avoid duplicates
    // when workflows are triggered multiple times throughout the day
    const latestRuns = getLatestWorkflowRuns(allRuns);

    // console.log(`After deduplication: ${latestRuns.length} unique workflows\n`);

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