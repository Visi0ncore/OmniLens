import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAvailableRepositories, getRepoNameFromEnv } from '@/lib/github';
import { getRepoConfig } from '@/lib/utils';
import { loadUserAddedRepos } from '@/lib/db-storage';

export const dynamic = 'force-dynamic';

// Zod schema for repository response
const repositorySchema = z.object({
  slug: z.string(),
  displayName: z.string(),
  hasConfig: z.boolean()
});

const repositoriesResponseSchema = z.object({
  repositories: z.array(repositorySchema)
});

export async function GET() {
  try {
    const availableRepos = getAvailableRepositories();
    const userAddedRepos = await loadUserAddedRepos();
    
    // Enhance env-configured repos with config data
    const reposWithConfig = availableRepos.map(repo => {
      const config = getRepoConfig(repo.slug);
      return {
        ...repo,
        displayName: getRepoNameFromEnv(repo.slug), // Use repo name from env vars
        hasConfig: !!config
      };
    });

    // Convert user-added repos to the expected format
    const userReposFormatted = userAddedRepos.map((repo: any) => ({
      slug: repo.slug,
      displayName: repo.displayName,
      hasConfig: false // User-added repos don't have config files initially
    }));

    // Combine both types of repositories
    const allRepos = [...reposWithConfig, ...userReposFormatted];

    // Validate response with Zod
    const responseData = { repositories: allRepos };
    repositoriesResponseSchema.parse(responseData);

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.error('Validation Error: Response data structure is invalid');
      return NextResponse.json(
        { error: 'Invalid response data structure' },
        { status: 500 }
      );
    }
    
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}