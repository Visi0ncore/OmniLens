import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addUserRepo } from '@/lib/storage';

// Zod schema for adding a repository
const addRepoSchema = z.object({
  repoPath: z.string().min(1, 'Repository path is required'),
  displayName: z.string().min(1, 'Display name is required'),
  htmlUrl: z.string().url('Valid HTML URL is required'),
  defaultBranch: z.string().min(1, 'Default branch is required')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body with Zod
    const { repoPath, displayName, htmlUrl, defaultBranch } = addRepoSchema.parse(body);

    // Generate slug from repoPath
    const slug = repoPath.replace(/\//g, '-');

    // Create new repo object
    const newRepo = {
      slug,
      repoPath,
      displayName,
      htmlUrl,
      defaultBranch,
      addedAt: new Date().toISOString()
    };

    // Add to storage
    const success = addUserRepo(newRepo);
    if (!success) {
      return NextResponse.json({ 
        error: 'Repository already exists in dashboard',
        slug 
      }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      repo: newRepo,
      message: 'Repository added to dashboard successfully'
    });

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data',
        details: error.issues.map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`)
      }, { status: 400 });
    }
    
    console.error('Add repo API Error:', error);
    return NextResponse.json({ error: 'Failed to add repository to dashboard' }, { status: 500 });
  }
}
