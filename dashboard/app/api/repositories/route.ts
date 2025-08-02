import { NextResponse } from 'next/server';
import { getAvailableRepositories, getRepoNameFromEnv } from '@/lib/github';
import { getRepoConfig } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const availableRepos = getAvailableRepositories();
    
    // Enhance with config data
    const reposWithConfig = availableRepos.map(repo => {
      const config = getRepoConfig(repo.slug);
      return {
        ...repo,
        displayName: getRepoNameFromEnv(repo.slug), // Use repo name from env vars
        hasConfig: !!config
      };
    });

    return NextResponse.json({
      repositories: reposWithConfig
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}