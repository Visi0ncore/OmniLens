import pool from './db';

export interface Repository {
  id?: number;
  slug: string;
  repoPath: string;
  displayName: string;
  htmlUrl: string;
  defaultBranch: string;
  addedAt?: string;
  updatedAt?: string;
}

// Load all user-added repositories from database
export async function loadUserAddedRepos(): Promise<Repository[]> {
  try {
    const result = await pool.query(
      'SELECT id, slug, repo_path as "repoPath", display_name as "displayName", html_url as "htmlUrl", default_branch as "defaultBranch", added_at as "addedAt", updated_at as "updatedAt" FROM repositories ORDER BY added_at DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error loading repositories:', error);
    return [];
  }
}

// Add a new repository to the database
export async function addUserRepo(repo: Repository): Promise<boolean> {
  try {
    const result = await pool.query(
      'INSERT INTO repositories (slug, repo_path, display_name, html_url, default_branch) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (slug) DO NOTHING RETURNING id',
      [repo.slug, repo.repoPath, repo.displayName, repo.htmlUrl, repo.defaultBranch]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error adding repository:', error);
    return false;
  }
}

// Remove a repository from the database
export async function removeUserRepo(slug: string): Promise<Repository | null> {
  try {
    const result = await pool.query(
      'DELETE FROM repositories WHERE slug = $1 RETURNING id, slug, repo_path as "repoPath", display_name as "displayName", html_url as "htmlUrl", default_branch as "defaultBranch", added_at as "addedAt", updated_at as "updatedAt"',
      [slug]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error removing repository:', error);
    return null;
  }
}

// Get a specific repository by slug
export async function getUserRepo(slug: string): Promise<Repository | null> {
  try {
    const result = await pool.query(
      'SELECT id, slug, repo_path as "repoPath", display_name as "displayName", html_url as "htmlUrl", default_branch as "defaultBranch", added_at as "addedAt", updated_at as "updatedAt" FROM repositories WHERE slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting repository:', error);
    return null;
  }
}

// Clear all repositories (useful for testing)
export async function clearAllRepos(): Promise<void> {
  try {
    await pool.query('DELETE FROM repositories');
  } catch (error) {
    console.error('Error clearing repositories:', error);
  }
}
