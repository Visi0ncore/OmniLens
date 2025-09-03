import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Play, Pause, Clock, XCircle, Calendar } from "lucide-react";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

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

  // Prepare data for the radial bar chart
  const chartData = [
    {
      name: "Passed",
      value: data.passedRuns,
      fill: "hsl(var(--chart-1))"
    },
    {
      name: "Failed", 
      value: data.failedRuns,
      fill: "hsl(var(--chart-2))"
    }
  ];

  const chartConfig = {
    Passed: {
      label: "Passed",
    },
    Failed: {
      label: "Failed",
    },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Daily Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Pass/Fail Summary with Radial Chart - Top/Left Side */}
          <div className="flex-shrink-0 flex justify-center lg:justify-start">
            <div className="flex items-center gap-3">
              <ChartContainer
                config={chartConfig}
                className="h-16 w-16"
              >
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
                  data={chartData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={4}
                    fill="var(--color-Passed)"
                  />
                </RadialBarChart>
              </ChartContainer>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className={`text-xs ${data.passedRuns === 0 ? 'text-muted-foreground' : 'text-white'}`}>{data.passedRuns}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className={`text-xs ${data.failedRuns === 0 ? 'text-muted-foreground' : 'text-white'}`}>{data.failedRuns}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Other Metrics - Bottom/Right Side in responsive grid */}
          <div className="flex-1 grid grid-cols-2 gap-4">
            {/* In Progress */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Pause className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span className="text-sm truncate">In Progress</span>
              </div>
              <div className={`font-semibold flex-shrink-0 ${data.inProgressRuns === 0 ? 'text-muted-foreground' : 'text-white'}`}>
                {data.inProgressRuns}
              </div>
            </div>

            {/* Didn't Run (moved to this position) */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                <span className="text-sm truncate">Didn't Run</span>
              </div>
              <div className={`font-semibold flex-shrink-0 ${data.didntRunCount === 0 ? 'text-muted-foreground' : 'text-white'}`}>
                {data.didntRunCount}
              </div>
            </div>



            {/* Total Runtime */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Clock className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <span className="text-sm truncate">Total Runtime</span>
              </div>
              <div className={`font-semibold text-sm flex-shrink-0 ${data.totalRuntime === 0 ? 'text-muted-foreground' : 'text-white'}`}>
                {formatDuration(data.totalRuntime)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 