// Simple in-memory storage for server-side operations
// This will be replaced with a proper database later

interface Repository {
  slug: string;
  repoPath: string;
  displayName: string;
  htmlUrl: string;
  defaultBranch: string;
  addedAt: string;
}

// In-memory storage (will be replaced with database)
let userRepos: Repository[] = [];

export function loadUserAddedRepos(): Repository[] {
  return [...userRepos]; // Return a copy to prevent direct mutation
}

export function saveUserAddedRepos(repos: Repository[]): void {
  userRepos = [...repos]; // Store a copy
}

export function addUserRepo(repo: Repository): boolean {
  // Check if repo already exists
  if (userRepos.some(r => r.slug === repo.slug)) {
    return false;
  }
  
  userRepos.push(repo);
  return true;
}

export function removeUserRepo(slug: string): Repository | null {
  const index = userRepos.findIndex(r => r.slug === slug);
  if (index === -1) {
    return null;
  }
  
  const removed = userRepos.splice(index, 1)[0];
  return removed;
}

export function getUserRepo(slug: string): Repository | null {
  return userRepos.find(r => r.slug === slug) || null;
}

// Clear all repos (useful for testing)
export function clearAllRepos(): void {
  userRepos = [];
}
