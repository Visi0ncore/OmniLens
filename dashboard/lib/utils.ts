import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import workflowConfig from "@/config/workflows.json";

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

// Get all configured workflow files from all categories
export function getAllConfiguredWorkflows(): string[] {
  const configuredWorkflows: string[] = [];
  
  Object.values(workflowConfig.categories).forEach(config => {
    config.workflows.forEach(workflow => {
      configuredWorkflows.push(workflow);
    });
  });
  
  return configuredWorkflows;
}

// Filter workflow runs to only include those configured in workflow categories
export function filterWorkflowsByCategories(runs: any[]): any[] {
  const configuredWorkflows = new Set(getAllConfiguredWorkflows());
  
  return runs.filter(run => {
    // Try different possible fields that might contain the workflow file name
    const workflowFile = run.path || run.workflow_path || run.head_commit?.message || run.workflow_name;
    
    return Array.from(configuredWorkflows).some(configWorkflow => 
      workflowFile && workflowFile.includes(configWorkflow)
    );
  });
}

// Calculate which configured workflows didn't run
export function calculateMissingWorkflows(runs: any[]): string[] {
  const configuredWorkflows = getAllConfiguredWorkflows();
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

// Get testing workflows for a given trigger workflow
export function getTestingWorkflowsForTrigger(triggerWorkflowName: string): string[] {
  if (!triggerWorkflowName) return [];
  
  // Get trigger workflows from the config
  const triggerWorkflows = workflowConfig.categories.trigger.workflows;
  const triggerMappings = (workflowConfig as any).trigger_mappings || {};
  
  // Find which trigger workflow this matches
  const matchingTriggerFile = triggerWorkflows.find(triggerFile => {
    // Convert trigger file name to workflow name for comparison
    const triggerWorkflowNameFromFile = triggerFile.replace('.yml', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return triggerWorkflowName.toLowerCase().includes(triggerWorkflowNameFromFile.toLowerCase());
  });
  
  // Return the testing workflows for this trigger
  return matchingTriggerFile ? (triggerMappings[matchingTriggerFile] || []) : [];
}

// Get trigger workflow for a given testing workflow
export function getTriggerWorkflowForTesting(testingWorkflowName: string): string | null {
  const triggerMappings = (workflowConfig as any).trigger_mappings || {};
  for (const [triggerWorkflow, testingWorkflows] of Object.entries(triggerMappings)) {
    if (Array.isArray(testingWorkflows) && testingWorkflows.includes(testingWorkflowName)) {
      return triggerWorkflow;
    }
  }
  return null;
}

// Check if a workflow is a trigger workflow
export function isTriggerWorkflow(workflowName: string): boolean {
  if (!workflowName) return false;
  
  // Get trigger workflows from the config
  const triggerWorkflows = workflowConfig.categories.trigger.workflows;
  
  // Check if this workflow name matches any trigger workflow file
  return triggerWorkflows.some(triggerFile => {
    // Convert trigger file name to workflow name for comparison
    const triggerWorkflowName = triggerFile.replace('.yml', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return workflowName.toLowerCase().includes(triggerWorkflowName.toLowerCase());
  });
}
