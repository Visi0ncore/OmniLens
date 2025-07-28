import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, CheckCircle, XCircle, Pause } from "lucide-react";
import type { WorkflowRun } from "@/lib/github";

interface MetricsOverviewProps {
  runs: WorkflowRun[];
}

function PieChart({ passed, failed }: { passed: number; failed: number }) {
  const total = passed + failed;
  if (total === 0) return null;
  
  const passedPercentage = (passed / total) * 100;
  const failedPercentage = (failed / total) * 100;
  
  // SVG pie chart with simple arcs
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const passedOffset = circumference - (passedPercentage / 100) * circumference;
  
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <svg width="100" height="100" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          {/* Passed portion */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgb(34, 197, 94)"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={passedOffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold">
            {Math.round(passedPercentage)}%
          </span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm">Pass: {passed}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-sm">Fail: {failed}</span>
        </div>
      </div>
    </div>
  );
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

export default function MetricsOverview({ runs }: MetricsOverviewProps) {
  const completedRuns = runs.filter(run => run.conclusion);
  const inProgressRuns = runs.filter(run => !run.conclusion && run.status === 'in_progress');
  const passedRuns = completedRuns.filter(run => run.conclusion === 'success');
  const failedRuns = completedRuns.filter(run => run.conclusion === 'failure');
  
  // Calculate total runtime for completed workflows
  const totalRuntime = completedRuns.reduce((total, run) => {
    const start = new Date(run.run_started_at).getTime();
    const end = new Date(run.updated_at).getTime();
    return total + Math.floor((end - start) / 1000);
  }, 0);
  
  // This component is legacy - it doesn't have access to missing workflows calculation
  // It should use the new OverviewMetrics component instead
  const didntRunCount = 0; // Legacy component - use OverviewMetrics for accurate count

  return (
    <div className="grid grid-cols-5 gap-4 mb-8">
      {/* Pass/Fail Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4" />
            Pass/Fail
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {completedRuns.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg width="60" height="60" className="transform -rotate-90">
                  <circle
                    cx="30"
                    cy="30"
                    r="25"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="6"
                  />
                  <circle
                    cx="30"
                    cy="30"
                    r="25"
                    fill="none"
                    stroke="rgb(34, 197, 94)"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 25}
                    strokeDashoffset={2 * Math.PI * 25 - ((passedRuns.length / completedRuns.length) * 2 * Math.PI * 25)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-semibold">
                    {Math.round((passedRuns.length / completedRuns.length) * 100)}%
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs">{passedRuns.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs">{failedRuns.length}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No completed workflows</p>
          )}
        </CardContent>
      </Card>

      {/* In Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Pause className="h-4 w-4" />
            In Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={`text-2xl font-bold ${inProgressRuns.length === 0 ? 'text-green-500' : 'text-red-500'}`}>
            {inProgressRuns.length}
          </div>
          <p className="text-xs text-muted-foreground">running</p>
        </CardContent>
      </Card>

      {/* Didn't Run */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <XCircle className="h-4 w-4" />
            Didn't Run
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={`text-2xl font-bold ${didntRunCount === 0 ? 'text-green-500' : 'text-red-500'}`}>
            {didntRunCount}
          </div>
          <p className="text-xs text-muted-foreground">expected</p>
        </CardContent>
      </Card>

      {/* Total Workflows */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Play className="h-4 w-4" />
            Total
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold">{runs.length}</div>
          <p className="text-xs text-muted-foreground">workflows</p>
        </CardContent>
      </Card>

      {/* Total Runtime */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            Runtime
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-lg font-bold">{formatDuration(totalRuntime)}</div>
          <p className="text-xs text-muted-foreground">total time</p>
        </CardContent>
      </Card>
    </div>
  );
} 