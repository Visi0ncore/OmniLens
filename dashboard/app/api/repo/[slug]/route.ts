import { NextRequest, NextResponse } from 'next/server';
import { getUserRepo, removeUserRepo } from '@/lib/db-storage';

// GET /api/repo/{slug} - Get a specific repository
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    
    if (!slug) {
      return NextResponse.json({ error: 'Repository slug is required' }, { status: 400 });
    }

    const repo = await getUserRepo(slug);

    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      repo
    });

  } catch (error) {
    console.error('Get repo API Error:', error);
    return NextResponse.json({ error: 'Failed to get repository' }, { status: 500 });
  }
}

// DELETE /api/repo/{slug} - Delete a specific repository
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    
    if (!slug) {
      return NextResponse.json({ error: 'Repository slug is required' }, { status: 400 });
    }

    const deletedRepo = await removeUserRepo(slug);

    if (!deletedRepo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Repository removed from dashboard successfully',
      deletedRepo
    });

  } catch (error) {
    console.error('Delete repo API Error:', error);
    return NextResponse.json({ error: 'Failed to delete repository' }, { status: 500 });
  }
}
