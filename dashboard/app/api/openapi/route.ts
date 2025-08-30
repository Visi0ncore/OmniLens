import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const openapiPath = join(process.cwd(), 'public', 'openapi.yaml');
    const openapiContent = readFileSync(openapiPath, 'utf8');
    
    return new NextResponse(openapiContent, {
      headers: {
        'Content-Type': 'text/yaml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error reading OpenAPI spec:', error);
    return NextResponse.json(
      { error: 'OpenAPI specification not found' },
      { status: 404 }
    );
  }
}
