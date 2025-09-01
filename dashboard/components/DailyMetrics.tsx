import { CheckCircle, Clock, XCircle, TrendingUp, TrendingDown, AlertCircle, Workflow, Circle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyMetricsProps {
  successRate: number;
  completedRuns: number;
  totalRuntime: string;
  didntRunCount: number;
  activeWorkflows: number;
  consistentCount: number;
  improvedCount: number;
  regressedCount: number;
  stillFailingCount: number;
  avgRunsPerHour: number;
  minRunsPerHour: number;
  maxRunsPerHour: number;
}

export default function DailyMetrics({
  successRate,
  completedRuns,
  totalRuntime,
  didntRunCount,
  activeWorkflows,
  consistentCount,
  improvedCount,
  regressedCount,
  stillFailingCount,
  avgRunsPerHour,
  minRunsPerHour,
  maxRunsPerHour
}: DailyMetricsProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Overview Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Overview</h3>
            <div className="flex items-start gap-4">
              {/* Daily Success Rate */}
              <div className="flex flex-col items-center space-y-2">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="35"
                      stroke="hsl(var(--muted))"
                      strokeWidth="6"
                      fill="none"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="35"
                      stroke={successRate >= 80 ? "hsl(142 76% 36%)" : successRate >= 60 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)"}
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 35}`}
                      strokeDashoffset={`${2 * Math.PI * 35 * (1 - successRate / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-semibold">{successRate}%</span>
                  </div>
                </div>
              </div>

              {/* Key Statistics */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Completed</span>
                  </div>
                  <span className="text-sm font-medium">{completedRuns}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Total Runtime</span>
                  </div>
                  <span className="text-sm font-medium">{totalRuntime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Didn't run</span>
                  </div>
                  <span className="text-sm font-medium">{didntRunCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Workflows</span>
                  </div>
                  <span className="text-sm font-medium">{activeWorkflows}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Health Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Health</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-24">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Consistent</span>
                </div>
                <div className="flex-1 bg-muted h-2 rounded-full">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(consistentCount / Math.max(completedRuns, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 ml-1">{consistentCount}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-24">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Improved</span>
                </div>
                <div className="flex-1 bg-muted h-2 rounded-full">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(improvedCount / Math.max(completedRuns, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 ml-1">{improvedCount}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-24">
                  <TrendingDown className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Regressed</span>
                </div>
                <div className="flex-1 bg-muted h-2 rounded-full">
                  <div 
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(regressedCount / Math.max(completedRuns, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 ml-1">{regressedCount}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-24">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Still failing</span>
                </div>
                <div className="flex-1 bg-muted h-2 rounded-full">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(stillFailingCount / Math.max(completedRuns, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 ml-1">{stillFailingCount}</span>
              </div>
            </div>
          </div>

          {/* Runs by hour Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Runs by hour</h3>
            {/* Placeholder for area chart */}
            <div className="w-full h-24 bg-muted rounded flex items-center justify-center">
              <span className="text-sm text-muted-foreground">Area Chart</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
