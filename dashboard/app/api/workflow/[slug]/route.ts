import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserRepo } from '@/lib/db-storage';

// Validation schema for the slug parameter
const slugSchema = z.string().min(1, 'Repository slug is required');

// GitHub API response types
interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'deleted';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

interface GitHubWorkflowsResponse {
  total_count: number;
  workflows: GitHubWorkflow[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Validate the slug parameter
    const validatedSlug = slugSchema.parse(params.slug);
    
    // Check if the repository exists in our database
    const repo = await getUserRepo(validatedSlug);
    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found in dashboard' },
        { status: 404 }
      );
    }
    
    // Extract owner and repo name from the repository path
    const [owner, repoName] = repo.repoPath.split('/');
    if (!owner || !repoName) {
      return NextResponse.json(
        { error: 'Invalid repository path format' },
        { status: 400 }
      );
    }
    
    // Get GitHub token from environment
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('GitHub token not configured');
      return NextResponse.json(
        { error: 'GitHub integration not configured' },
        { status: 500 }
      );
    }
    
    // Fetch workflows from GitHub API
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/actions/workflows`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OmniLens-Dashboard'
        }
      }
    );
    
    if (!githubResponse.ok) {
      if (githubResponse.status === 404) {
        return NextResponse.json(
          { error: 'Repository not found on GitHub' },
          { status: 404 }
        );
      } else if (githubResponse.status === 403) {
        return NextResponse.json(
          { error: 'Access denied to repository workflows' },
          { status: 403 }
        );
      } else {
        console.error('GitHub API error:', githubResponse.status, githubResponse.statusText);
        return NextResponse.json(
          { error: 'Failed to fetch workflows from GitHub' },
          { status: 500 }
        );
      }
    }
    
    const workflowsData: GitHubWorkflowsResponse = await githubResponse.json();
    
    // Transform the response to match our API format
    const workflows = workflowsData.workflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      path: workflow.path,
      state: workflow.state,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at,
      deletedAt: workflow.deleted_at
    }));
    
    return NextResponse.json({
      repository: {
        slug: validatedSlug,
        displayName: repo.displayName,
        repoPath: repo.repoPath
      },
      workflows: workflows,
      totalCount: workflowsData.total_count
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid repository slug', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
