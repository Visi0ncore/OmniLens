import { CheckCircle, Clock, XCircle, TrendingUp, TrendingDown, AlertTriangle, Workflow } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';


interface DailyMetricsProps {
  successRate: number;
  passRate: number;
  passedRuns: number;
  failedRuns: number;
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
  runsByHour?: Array<{ hour: number; count: number }>;
  selectedDate: Date;
}

// Pass/Fail Pie Chart Component
function PassFailPieChart({ passed, failed }: { passed: number; failed: number }) {
  const total = passed + failed;
  if (total === 0) return null;

  const passedPercentage = (passed / total) * 100;
  const failedPercentage = (failed / total) * 100;

  // SVG pie chart with simple arcs - increased size
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const passedOffset = circumference - (passedPercentage / 100) * circumference;

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <svg width="120" height="120" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
          />
          {/* Passed portion */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="rgb(34, 197, 94)"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={passedOffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold">
            {Math.round(passedPercentage)}%
          </span>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
          <span className="text-base">Pass: {passed}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
          <span className="text-base">Fail: {failed}</span>
        </div>
      </div>
    </div>
  );
}

export default function DailyMetrics({
  successRate,
  passRate,
  passedRuns,
  failedRuns,
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
  maxRunsPerHour,
  runsByHour,
  selectedDate
}: DailyMetricsProps) {

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Pass/Fail Section */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Pass/Fail Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex-1 flex items-center justify-center">
            <PassFailPieChart passed={passedRuns} failed={failedRuns} />
          </div>
        </CardContent>
      </Card>

      {/* Overview Section */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Workflow className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Workflows</span>
              </div>
              <span className="text-sm font-medium">{activeWorkflows}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Completed</span>
              </div>
              <span className="text-sm font-medium">{completedRuns}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Didn&apos;t run</span>
              </div>
              <span className="text-sm font-medium">{didntRunCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Total Runtime</span>
              </div>
              <span className="text-sm font-medium">{totalRuntime}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Section */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Consistent</span>
              </div>
              <span className="text-sm font-medium">{consistentCount}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Improved</span>
              </div>
              <span className="text-sm font-medium">{improvedCount}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Regressed</span>
              </div>
              <span className="text-sm font-medium">{regressedCount}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Still failing</span>
              </div>
              <span className="text-sm font-medium">{stillFailingCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Runs by hour Section */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Runs by hour</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Area Chart */}
          <div className="w-full h-28 bg-muted rounded p-3">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Smooth line chart */}
              {runsByHour && runsByHour.length > 0 && (
                <>
                  {/* Area fill */}
                  <path
                    d={(() => {
                      const maxCount = Math.max(...runsByHour.map(r => r.count), 1);
                      const points = runsByHour.map((run, index) => {
                        const x = (index / (runsByHour.length - 1)) * 100;
                        const y = 100 - (run.count / maxCount) * 80; // Leave 20% margin at bottom
                        return `${x},${y}`;
                      });
                      
                      // Create area path by adding baseline
                      const linePath = `M ${points.join(' L ')}`;
                      const areaPath = `${linePath} L ${points[points.length - 1].split(',')[0]},100 L 0,100 Z`;
                      return areaPath;
                    })()}
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity="0.2"
                  />
                  {/* Line stroke */}
                  <path
                    d={(() => {
                      const maxCount = Math.max(...runsByHour.map(r => r.count), 1);
                      const points = runsByHour.map((run, index) => {
                        const x = (index / (runsByHour.length - 1)) * 100;
                        const y = 100 - (run.count / maxCount) * 80; // Leave 20% margin at bottom
                        return `${x},${y}`;
                      });
                      
                      // Create smooth line path only
                      return `M ${points.join(' L ')}`;
                    })()}
                    fill="none"
                    stroke="hsl(var(--foreground))"
                    strokeWidth="0.5"
                  />
                </>
              )}
            </svg>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
