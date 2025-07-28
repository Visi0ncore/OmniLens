import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Play, Pause, Clock, XCircle, Calendar } from "lucide-react";

interface OverviewData {
  completedRuns: number;
  inProgressRuns: number;
  passedRuns: number;
  failedRuns: number;
  totalRuntime: number;
  didntRunCount: number;
  totalWorkflows: number;
  missingWorkflows: string[];
}

type MetricType = 'didnt_run';

interface OverviewMetricsProps {
  data: OverviewData;
  onMetricHover?: (metricType: MetricType, workflowIds: string[]) => void;
  onMetricLeave?: () => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export default function OverviewMetrics({ data, onMetricHover, onMetricLeave }: OverviewMetricsProps) {
  const passedPercentage = data.completedRuns > 0 ? Math.round((data.passedRuns / data.completedRuns) * 100) : 0;
  
  // Create missing workflow IDs for hover functionality
  const missingWorkflowIds = data.missingWorkflows.map(workflow => `missing-${workflow}`);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Daily Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 lg:gap-12">
          {/* Pass/Fail Summary with Pie Chart - Left Side */}
          <div className="flex-shrink-0">
            {data.completedRuns > 0 ? (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg width="60" height="60" className="transform -rotate-90">
                    {/* Background circle */}
                    <circle
                      cx="30"
                      cy="30"
                      r="25"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="6"
                    />
                    
                    {/* Passed (Green) */}
                    {data.passedRuns > 0 && (
                      <circle
                        cx="30"
                        cy="30"
                        r="25"
                        fill="none"
                        stroke="rgb(34, 197, 94)"
                        strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 25}
                        strokeDashoffset={2 * Math.PI * 25 - ((data.passedRuns / data.completedRuns) * 2 * Math.PI * 25)}
                        strokeLinecap="round"
                      />
                    )}
                    
                    {/* Failed (Red) */}
                    {data.failedRuns > 0 && (
                      <circle
                        cx="30"
                        cy="30"
                        r="25"
                        fill="none"
                        stroke="rgb(239, 68, 68)"
                        strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 25}
                        strokeDashoffset={2 * Math.PI * 25 - ((data.failedRuns / data.completedRuns) * 2 * Math.PI * 25)}
                        strokeLinecap="round"
                        transform={`rotate(${(data.passedRuns / data.completedRuns) * 360} 30 30)`}
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-semibold">
                      {Math.round((data.passedRuns / data.completedRuns) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs">{data.passedRuns}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs">{data.failedRuns}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No completed workflows</p>
            )}
          </div>

          {/* Other Metrics - Right Side in responsive grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left Column: In Progress and Total */}
            <div className="space-y-3">
              {/* In Progress */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 min-w-[8rem] sm:w-32">
                  <Pause className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">In Progress</span>
                </div>
                <div className={`font-semibold ${data.inProgressRuns === 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {data.inProgressRuns}
                </div>
              </div>

              {/* Total Workflows */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 min-w-[8rem] sm:w-32">
                  <Play className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Total Workflows</span>
                </div>
                <div className="font-semibold">{data.totalWorkflows}</div>
              </div>
            </div>

            {/* Right Column: Didn't Run and Runtime */}
            <div className="space-y-3">
              {/* Didn't Run */}
              <div 
                className="flex items-center gap-3 cursor-pointer"
                title={data.missingWorkflows.length > 0 ? `Missing workflows: ${data.missingWorkflows.join(', ')}` : 'All configured workflows ran'}
                onMouseEnter={() => onMetricHover?.('didnt_run', missingWorkflowIds)}
                onMouseLeave={() => onMetricLeave?.()}
              >
                <div className="flex items-center gap-2 min-w-[8rem] sm:w-32">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Didn't Run</span>
                </div>
                <div className={`font-semibold ${data.didntRunCount === 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {data.didntRunCount}
                </div>
              </div>

              {/* Runtime */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 min-w-[8rem] sm:w-32">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Runtime</span>
                </div>
                <div className="font-semibold text-sm">{formatDuration(data.totalRuntime)}</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 