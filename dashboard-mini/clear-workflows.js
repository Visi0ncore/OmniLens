#!/usr/bin/env node

/**
 * Script to clear cached workflows for a repository
 * Usage: node clear-workflows.js <repo-slug>
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function clearWorkflows(repoSlug) {
  try {
    const result = await pool.query(
      'DELETE FROM workflows WHERE repo_slug = $1',
      [repoSlug]
    );
    console.log(`✅ Cleared ${result.rowCount} cached workflows for repo: ${repoSlug}`);
  } catch (error) {
    console.error('Error clearing workflows:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

const repoSlug = process.argv[2];
if (!repoSlug) {
  console.error('Usage: node clear-workflows.js <repo-slug>');
  process.exit(1);
}

clearWorkflows(repoSlug)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
