import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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
