import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const docsPath = join(process.cwd(), 'public', 'api-docs.html');
    const docsContent = readFileSync(docsPath, 'utf8');
    
    return new NextResponse(docsContent, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error reading API docs:', error);
    return NextResponse.json(
      { error: 'API documentation not found' },
      { status: 404 }
    );
  }
}
