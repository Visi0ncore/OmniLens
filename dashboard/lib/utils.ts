import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import workflowConfig from "@/config/workflows.json";

// Types for the new multi-repo config structure
interface RepositoryConfig {
  slug: string;
  categories: Record<string, { name: string; workflows: string[] }>;
  trigger_mappings: Record<string, string[]>;
}

interface MultiRepoWorkflowConfig {
  repositories: Record<string, RepositoryConfig>;
}

const config = workflowConfig as MultiRepoWorkflowConfig;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function removeEmojiFromWorkflowName(name: string): string {
  // Remove emojis and extra whitespace from the beginning of a workflow name
  // E.g., "⏱️ Thresholds" becomes "Thresholds"
  if (!name) return '';
  return name.replace(/^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}\s]+/gu, '').trim();
}

export function cleanWorkflowName(name: string): string {
  // Remove emojis first, then remove "Trigger" prefix if present
  if (!name) return '';
  const withoutEmoji = removeEmojiFromWorkflowName(name);
  // Remove "Trigger" prefix and clean up any extra spaces
  return withoutEmoji.replace(/^Trigger\s+/i, '').trim();
}

// Get all configured workflow files from all categories for a specific repo
export function getAllConfiguredWorkflows(repoSlug: string): string[] {
  const repoConfig = getRepoConfig(repoSlug);
  if (!repoConfig) return [];
  
  const configuredWorkflows: string[] = [];
  
  Object.values(repoConfig.categories).forEach(categoryConfig => {
    categoryConfig.workflows.forEach(workflow => {
      configuredWorkflows.push(workflow);
    });
  });
  
  return configuredWorkflows;
}

// Get repository config by slug
export function getRepoConfig(repoSlug: string): RepositoryConfig | null {
  return config.repositories[repoSlug] || null;
}

// Get all available repository slugs
export function getAvailableRepoSlugs(): string[] {
  return Object.keys(config.repositories);
}

// Check if a repo slug exists in config
export function isValidRepoSlugInConfig(repoSlug: string): boolean {
  return repoSlug in config.repositories;
}

// Filter workflow runs to only include those configured in workflow categories for a specific repo
export function filterWorkflowsByCategories(runs: any[], repoSlug: string): any[] {
  const configuredWorkflows = new Set(getAllConfiguredWorkflows(repoSlug));
  
  return runs.filter(run => {
    // Try different possible fields that might contain the workflow file name
    const workflowFile = run.path || run.workflow_path || run.head_commit?.message || run.workflow_name;
    
    return Array.from(configuredWorkflows).some(configWorkflow => 
      workflowFile && workflowFile.includes(configWorkflow)
    );
  });
}

// Calculate which configured workflows didn't run for a specific repo
export function calculateMissingWorkflows(runs: any[], repoSlug: string): string[] {
  const configuredWorkflows = getAllConfiguredWorkflows(repoSlug);
  const ranWorkflows = new Set<string>();
  
  // Track which configured workflows actually ran
  runs.forEach(run => {
    const workflowFile = run.path || run.workflow_path || run.head_commit?.message || run.workflow_name;
    
    configuredWorkflows.forEach(configWorkflow => {
      if (workflowFile && workflowFile.includes(configWorkflow)) {
        ranWorkflows.add(configWorkflow);
      }
    });
  });
  
  // Return workflows that are configured but didn't run
  return configuredWorkflows.filter(workflow => !ranWorkflows.has(workflow));
}

// Get testing workflows for a given trigger workflow in a specific repo
export function getTestingWorkflowsForTrigger(triggerWorkflowName: string, repoSlug: string): string[] {
  if (!triggerWorkflowName) return [];
  const normalize = (s: string | undefined | null) => (s ? String(s).toLowerCase().trim() : '');

  // Prefer dynamic trigger map (per-repo cache)
  try {
    const maps = (globalThis as any).__triggerMaps as Record<string, any> | undefined;
    const repoMap = maps?.[repoSlug];
    if (repoMap) {
      const key = normalize(triggerWorkflowName);
      const fromName = repoMap.nameToTesting?.[key];
      if (fromName && fromName.length > 0) return fromName as string[];

      // Try by matching workflow meta to find file base
      const workflowsMeta: Array<{ path?: string; name?: string }> = repoMap.workflows || [];
      const match = workflowsMeta.find((wf) => normalize(wf.name) === key || normalize(wf.path?.split('/').pop()) === key);
      if (match && match.path) {
        const base = match.path.split('/').pop()?.toLowerCase();
        const fromFile = base ? (repoMap.fileToTesting?.[base] as string[] | undefined) : undefined;
        if (fromFile && fromFile.length > 0) return fromFile;
      }
    }
  } catch {}

  // Fallback to static config mapping
  const repoConfig = getRepoConfig(repoSlug);
  if (!repoConfig) return [];
  const triggerWorkflows = repoConfig.categories.trigger?.workflows || [];
  const triggerMappings = repoConfig.trigger_mappings || {};
  const matchingTriggerFile = triggerWorkflows.find(triggerFile => {
    const triggerWorkflowNameFromFile = triggerFile.replace('.yml', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return triggerWorkflowName.toLowerCase().includes(triggerWorkflowNameFromFile.toLowerCase());
  });
  return matchingTriggerFile ? (triggerMappings[matchingTriggerFile] || []) : [];
}

// Get trigger workflow for a given testing workflow in a specific repo
export function getTriggerWorkflowForTesting(testingWorkflowName: string, repoSlug: string): string | null {
  const normalize = (s: string | undefined | null) => (s ? String(s).toLowerCase().trim() : '');

  // Try dynamic reverse mapping first
  try {
    const maps = (globalThis as any).__triggerMaps as Record<string, any> | undefined;
    const repoMap = maps?.[repoSlug];
    if (repoMap && repoMap.testingToTrigger) {
      const key = normalize(testingWorkflowName);
      // testingToTrigger maps testing base file -> array of trigger names/files (normalized)
      const list = repoMap.testingToTrigger[key] as string[] | undefined;
      if (list && list.length > 0) return list[0] || null;
    }
  } catch {}

  // Fallback to static config
  const repoConfig = getRepoConfig(repoSlug);
  if (!repoConfig) return null;
  const triggerMappings = repoConfig.trigger_mappings || {};
  for (const [triggerWorkflow, testingWorkflows] of Object.entries(triggerMappings)) {
    if (Array.isArray(testingWorkflows) && testingWorkflows.includes(testingWorkflowName)) {
      return triggerWorkflow;
    }
  }
  return null;
}

// Check if a workflow is a trigger workflow in a specific repo
export function isTriggerWorkflow(workflowName: string, repoSlug: string): boolean {
  if (!workflowName) return false;
  const normalize = (s: string | undefined | null) => (s ? String(s).toLowerCase().trim() : '');

  // Dynamic map first (per-repo)
  try {
    const maps = (globalThis as any).__triggerMaps as Record<string, any> | undefined;
    const repoMap = maps?.[repoSlug];
    if (repoMap) {
      const key = normalize(workflowName);
      if (repoMap.nameToTesting && Array.isArray(repoMap.nameToTesting[key]) && repoMap.nameToTesting[key].length > 0) return true;

      // Check via workflows meta + fileToTesting
      const workflowsMeta: Array<{ path?: string; name?: string; isTrigger?: boolean }> = repoMap.workflows || [];
      const match = workflowsMeta.find((wf) => normalize(wf.name) === key || normalize(wf.path?.split('/').pop()) === key);
      if (match) {
        if (match.isTrigger) return true;
        const base = match.path?.split('/')?.pop()?.toLowerCase();
        if (base && repoMap.fileToTesting && Array.isArray(repoMap.fileToTesting[base]) && repoMap.fileToTesting[base].length > 0) return true;
      }
    }
  } catch {}

  // Fallback to static config
  const repoConfig = getRepoConfig(repoSlug);
  if (!repoConfig) return false;
  const triggerWorkflows = repoConfig.categories.trigger?.workflows || [];
  return triggerWorkflows.some(triggerFile => {
    const triggerWorkflowName = triggerFile.replace('.yml', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return workflowName.toLowerCase().includes(triggerWorkflowName.toLowerCase());
  });
}
