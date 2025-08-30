import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Types for the new database-driven config structure
interface RepositoryConfig {
  slug: string;
  categories: Record<string, { name: string; workflows: string[] }>;
  trigger_mappings: Record<string, string[]>;
}

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

// Get repository config by slug - now database-driven
export function getRepoConfig(repoSlug: string): RepositoryConfig | null {
  // For now, return a default config for any repository
  // This can be enhanced later to store config in the database
  return {
    slug: repoSlug,
    categories: {
      build: {
        name: "Build Workflows",
        workflows: []
      },
      testing: {
        name: "Testing Workflows", 
        workflows: []
      },
      trigger: {
        name: "Trigger Workflows",
        workflows: []
      },
      utility: {
        name: "Utility Workflows",
        workflows: []
      }
    },
    trigger_mappings: {}
  };
}

// Get all available repository slugs from database
export async function getAvailableRepoSlugs(): Promise<string[]> {
  try {
    const response = await fetch('/api/repo');
    if (response.ok) {
      const repos = await response.json();
      return repos.map((repo: any) => repo.slug);
    }
  } catch (error) {
    console.error('Failed to fetch repository slugs:', error);
  }
  return [];
}

// Check if a repo slug exists in database
export async function isValidRepoSlugInConfig(repoSlug: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/repo/${repoSlug}`);
    return response.ok;
  } catch (error) {
    return false;
  }
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

// Filter workflow runs to only include those configured in workflow categories for a specific repo
export function filterWorkflowsByCategories(runs: any[], repoSlug: string): any[] {
  // For now, return all runs since we don't have category configuration
  // This can be enhanced later to filter based on database-stored categories
  return runs;
}

// Calculate which configured workflows didn't run for a specific repo
export function calculateMissingWorkflows(runs: any[], repoSlug: string): string[] {
  // For now, return empty array since we don't have category configuration
  // This can be enhanced later to calculate missing workflows based on database-stored categories
  return [];
}

// Get testing workflows for a given trigger workflow in a specific repo
export function getTestingWorkflowsForTrigger(triggerWorkflowName: string, repoSlug: string): string[] {
  // For now, return empty array since we don't have trigger mappings
  // This can be enhanced later to use database-stored trigger mappings
  return [];
}

// Get trigger workflow for a given testing workflow in a specific repo
export function getTriggerWorkflowForTesting(testingWorkflowName: string, repoSlug: string): string | null {
  // For now, return null since we don't have trigger mappings
  // This can be enhanced later to use database-stored trigger mappings
  return null;
}

// Check if a workflow is a trigger workflow in a specific repo
export function isTriggerWorkflow(workflowName: string, repoSlug: string): boolean {
  // For now, return false since we don't have trigger mappings
  // This can be enhanced later to use database-stored trigger mappings
  return false;
}
