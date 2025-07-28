import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowRunsForDate, calculateOverviewData } from '@/lib/github';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    const targetDate = new Date(date);
    
    // Validate date
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const workflowRuns = await getWorkflowRunsForDate(targetDate);
    const overviewData = calculateOverviewData(workflowRuns);

    return NextResponse.json({
      workflowRuns,
      overviewData
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow data' },
      { status: 500 }
    );
  }
} 