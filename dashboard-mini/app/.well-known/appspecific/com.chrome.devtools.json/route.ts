import { NextResponse } from 'next/server';

export async function GET() {
  // Return an empty JSON object to satisfy Chrome DevTools
  return NextResponse.json({}, { status: 200 });
}
