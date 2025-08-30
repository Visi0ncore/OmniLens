import { format, startOfDay, endOfDay } from "date-fns";
import { filterWorkflowsByCategories, calculateMissingWorkflows, getAllConfiguredWorkflows } from "./utils";

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

// Helper function to get environment variables for a specific repo
function getEnvVars(repoSlug: string) {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN environment variable");
  }

  // Map repo slug to environment variable
  const repoEnvMap: Record<string, string> = {
    'repo1': 'GITHUB_REPO_1',
    'repo2': 'GITHUB_REPO_2', 
    'repo3': 'GITHUB_REPO_3'
  };
  
  const repoEnvKey = repoEnvMap[repoSlug];
  if (!repoEnvKey) {
    throw new Error(`Invalid repo slug: ${repoSlug}. Must be one of: ${Object.keys(repoEnvMap).join(', ')}`);
  }
  
  const repo = process.env[repoEnvKey];
  if (!repo) {
    throw new Error(`Missing ${repoEnvKey} environment variable for repo: ${repoSlug}`);
  }

  return { token, repo };
}





// Helper function to find which configured workflow file a run corresponds to
function getConfiguredWorkflowFile(run: WorkflowRun, repoSlug: string): string | null {
  const configuredWorkflows = getAllConfiguredWorkflows(repoSlug);

  // Extract just the filename from the run path (e.g., ".github/workflows/build-workflow.yml" -> "build-workflow.yml")
  const workflowPath = run.path || run.workflow_name;
  if (!workflowPath) return null;

  const filename = workflowPath.split('/').pop();
  if (!filename) return null;

  // Only return exact matches from workflows.json - no partial matching
  return configuredWorkflows.includes(filename) ? filename : null;
}

// Helper function to get one card per workflow but collect all run data
// This shows one card per workflow (latest run) but the card displays total run count
// and clicking the count shows all individual runs
function getLatestWorkflowRuns(workflowRuns: WorkflowRun[], repoSlug: string): WorkflowRun[] {
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

  // Use configured workflow file name as the key (from workflows.json)
  sortedRuns.forEach(run => {
    const configuredWorkflowFile = getConfiguredWorkflowFile(run, repoSlug);

    // Skip runs that don't match any configured workflow (should not happen after filtering)
    if (!configuredWorkflowFile) {
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
      // Count duplicates for the total run count
      duplicateCount.set(configuredWorkflowFile, (duplicateCount.get(configuredWorkflowFile) || 0) + 1);
      // Add this run to the all_runs collection
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

  // Log workflows that had multiple runs (only if more than 1)
  const multipleRunsWorkflows = Array.from(duplicateCount.entries())
    .filter(([_, count]) => count > 1)
    .map(([workflow, count]) => `${workflow}(${count})`);
  
  if (multipleRunsWorkflows.length > 0) {
    console.log(`📊 Multiple runs: ${multipleRunsWorkflows.join(', ')}`);
  }

  // Add run count and all runs to each workflow run for the UI
  const result = Array.from(latestRuns.values()).map(run => {
    const configuredWorkflowFile = getConfiguredWorkflowFile(run, repoSlug);
    return {
      ...run,
      run_count: duplicateCount.get(configuredWorkflowFile!) || 1,
      all_runs: allRunsForWorkflow.get(configuredWorkflowFile!) || []
    };
  });

  return result;
}



// Get workflow runs for a specific date and repository
export async function getWorkflowRunsForDate(date: Date, repoSlug: string): Promise<WorkflowRun[]> {
  try {
    const { token, repo } = getEnvVars(repoSlug);

    // Format date to ISO string for GitHub API
    const dateStr = format(date, "yyyy-MM-dd");

        // Use broader time range to account for timezone differences (extend by 2 hours each side)
    const startOfDay = `${dateStr}T00:00:00Z`;
    const endOfDay = `${dateStr}T23:59:59Z`;
    
    // For debugging, let's also try a broader range
    const broaderStart = new Date(date);
    broaderStart.setDate(broaderStart.getDate() - 1);
    broaderStart.setHours(22, 0, 0, 0); // 10 PM previous day UTC
    
    const broaderEnd = new Date(date);
    broaderEnd.setDate(broaderEnd.getDate() + 1);
    broaderEnd.setHours(2, 0, 0, 0); // 2 AM next day UTC
    
    const broaderStartStr = broaderStart.toISOString();
    const broaderEndStr = broaderEnd.toISOString();
    
    // Add clear visual separator for this API call
    const timestamp = new Date().toISOString();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 NEW API CALL - ${timestamp}`);
    console.log(`${'='.repeat(80)}`);
    
    console.log(`🔍 GitHub API Query: ${API_BASE}/repos/${repo}/actions/runs?created=${broaderStartStr}..${broaderEndStr}&per_page=100&page=1`);
    console.log(`🔍 Broader date range: ${broaderStartStr} to ${broaderEndStr}`);
    console.log(`🔍 Original date range: ${startOfDay} to ${endOfDay}`);
    console.log(`🔍 Target date: ${dateStr} (${date.toISOString()})`);
    console.log(`⏰ API call timestamp: ${timestamp}`);
    
    // Fetch all workflow runs for the date, handling pagination
    let allRuns: WorkflowRun[] = [];
    let page = 1;
    let hasMorePages = true;
    let pagesFetched = 0;

    while (hasMorePages) {
          // Use broader time range to account for timezone differences
    const res = await fetch(
      `${API_BASE}/repos/${repo}/actions/runs?created=${broaderStartStr}..${broaderEndStr}&per_page=100&page=${page}&_t=${Date.now()}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          // Add conditional request headers to reduce unnecessary data transfer
          'If-None-Match': '', // Will be populated if we have a cached ETag
        },
      }
    );

      // Handle 304 Not Modified response
      if (res.status === 304) {
        console.log(`📄 Page ${page}: No changes detected (304 Not Modified)`);
        break; // No need to fetch more pages if data hasn't changed
      }

      if (!res.ok) {
        // Handle specific GitHub API errors gracefully
        if (res.status === 404) {
          console.log(`📄 Repository not found or no workflows exist: ${repo}`);
          return []; // Return empty array for repositories with no workflows
        }
        if (res.status === 403) {
          throw new Error(`GitHub API error: ${res.status} ${res.statusText} - Repository access denied`);
        }
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      const pageRuns = json.workflow_runs as WorkflowRun[];

      // Log summary of runs found on this page
      if (pageRuns.length > 0) {
        console.log(`📄 Page ${page}: ${pageRuns.length} runs found`);
      }

      allRuns = allRuns.concat(pageRuns);
      pagesFetched++;

      // Check if we need to fetch more pages
      hasMorePages = pageRuns.length === 100; // If we got 100 results, there might be more
      page++;

      // Safety break to avoid infinite loops
      if (page > 10) {
        console.warn('Breaking pagination after 10 pages to avoid infinite loop');
        break;
      }
    }

    // Filter to only include workflows that are configured in workflows.json
    const filteredRuns = filterWorkflowsByCategories(allRuns, repoSlug);

    // Group by workflow and collect all run data for the UI
    // This shows one card per workflow but includes run_count and all_runs data
    const latestRuns = getLatestWorkflowRuns(filteredRuns, repoSlug);

    console.log(`\n🔍 === WORKFLOW RUN ANALYSIS FOR ${dateStr} ===`);
    console.log(`📊 GitHub API returned ${allRuns.length} total runs`);
    console.log(`✅ After filtering by configured workflows: ${filteredRuns.length} runs`);
    console.log(`🎯 Final result: ${latestRuns.length} cards (representing ${filteredRuns.length} total runs)`);

    // Log final card data with run counts
    console.log('\n🃏 Cards created with run counts:');
    latestRuns.forEach((run, index) => {
      console.log(`  ${index + 1}. Card: "${run.name}", Run Count: ${run.run_count || 1}, All Runs: ${run.all_runs?.length || 0}`);
    });

    // Add closing separator
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ API CALL COMPLETED - ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}\n`);

    return latestRuns;

  } catch (error) {
    console.error("Error fetching workflow runs:", error);
    throw error;
  }
}

// Calculate overview data from workflow runs
export function calculateOverviewData(workflowRuns: WorkflowRun[], repoSlug: string): OverviewData {
  // Filter to only include workflows that are configured in categories
  const filteredRuns = filterWorkflowsByCategories(workflowRuns, repoSlug);

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
  const missingWorkflows = calculateMissingWorkflows(workflowRuns, repoSlug);
  const didntRunCount = missingWorkflows.length;
  // Total configured workflows should reflect configuration, not how many ran
  const totalWorkflows = getAllConfiguredWorkflows(repoSlug).length;

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

// Get overview data for a specific date and repository
export async function getOverviewDataForDate(date: Date, repoSlug: string): Promise<OverviewData> {
  const workflowRuns = await getWorkflowRunsForDate(date, repoSlug);
  return calculateOverviewData(workflowRuns, repoSlug);
}

// Legacy functions for backward compatibility - now require repo parameter
export async function getTodayWorkflowRuns(repoSlug: string): Promise<WorkflowRun[]> {
  return getWorkflowRunsForDate(new Date(), repoSlug);
}

export async function getYesterdayWorkflowRuns(repoSlug: string): Promise<WorkflowRun[]> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getWorkflowRunsForDate(yesterday, repoSlug);
}

export async function getTodayOverviewData(repoSlug: string): Promise<OverviewData> {
  return getOverviewDataForDate(new Date(), repoSlug);
}

export async function getYesterdayOverviewData(repoSlug: string): Promise<OverviewData> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getOverviewDataForDate(yesterday, repoSlug);
} 