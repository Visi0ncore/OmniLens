#!/usr/bin/env node

import { deleteWorkflows } from './lib/db-storage.ts';

async function nukeCache(repoSlug) {
  try {
    await deleteWorkflows(repoSlug);
    console.log(`✅ Nuked cache for ${repoSlug}`);
  } catch (error) {
    console.error('Error nuking cache:', error);
    process.exit(1);
  }
}

const repoSlug = process.argv[2] || 'central-testing';
nukeCache(repoSlug);
