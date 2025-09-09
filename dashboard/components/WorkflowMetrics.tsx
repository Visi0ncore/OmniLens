import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Circle, TrendingUp, TrendingDown, ArrowDown } from "lucide-react";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { RadialBar, RadialBarChart } from "recharts";
import type { WorkflowRun } from "@/lib/github";

type MetricType = 'consistent' | 'improved' | 'regressed' | 'regressing';

interface WorkflowMetricsProps {
  todayRuns: WorkflowRun[];
  yesterdayRuns: WorkflowRun[];
  onMetricHover?: (metricType: MetricType, workflowIds: number[]) => void;
  onMetricLeave?: () => void;
}

interface MetricData {
  consistent: WorkflowRun[];
  improved: WorkflowRun[];
  regressed: WorkflowRun[];
  regressing: WorkflowRun[];
}

function compareWorkflows(todayRuns: WorkflowRun[], yesterdayRuns: WorkflowRun[]): MetricData {
  const metrics: MetricData = {
    consistent: [],
    improved: [],
    regressed: [],
    regressing: []
  };

  // Create a map of workflow IDs to their status for easier comparison
  // Using workflow_id as the primary key since it's more reliable than names
  const yesterdayMap = new Map<number, string>();
  yesterdayRuns.forEach(run => {
    const status = run.conclusion === 'success' ? 'passed' : 
                   run.conclusion === null && run.status === 'in_progress' ? 'running' : 'failed';
    yesterdayMap.set(run.workflow_id, status);
  });

  todayRuns.forEach(run => {
    const todayStatus = run.conclusion === 'success' ? 'passed' : 
                       run.conclusion === null && run.status === 'in_progress' ? 'running' : 'failed';
    const yesterdayStatus = yesterdayMap.get(run.workflow_id) || 'unknown';

    // Skip workflows that are currently running (don't include them in daily metrics)
    if (todayStatus === 'running') {
      // Don't add to any metrics - running workflows shouldn't be compared
      return;
    }

    if (todayStatus === 'passed' && yesterdayStatus === 'passed') {
      metrics.consistent.push(run);
    } else if (todayStatus === 'passed' && yesterdayStatus === 'failed') {
      metrics.improved.push(run);
    } else if (todayStatus === 'failed' && yesterdayStatus === 'passed') {
      metrics.regressed.push(run);
    } else if (todayStatus === 'failed' && yesterdayStatus === 'failed') {
      metrics.regressing.push(run);
    }
  });

  return metrics;
}

export default function WorkflowMetrics({ todayRuns, yesterdayRuns, onMetricHover, onMetricLeave }: WorkflowMetricsProps) {
  const metrics = compareWorkflows(todayRuns, yesterdayRuns);

  // Calculate total workflows for pie chart
  const totalWorkflows = metrics.consistent.length + metrics.improved.length + metrics.regressed.length + metrics.regressing.length;

  const MetricRow = ({ 
    icon, 
    label, 
    count, 
    color, 
    workflows,
    metricType
  }: { 
    icon: React.ReactNode; 
    label: string; 
    count: number; 
    color: string;
    workflows: WorkflowRun[];
    metricType: MetricType;
  }) => (
    <div 
      className="flex items-center gap-3 cursor-pointer"
      onMouseEnter={() => onMetricHover?.(metricType, workflows.map(w => w.id))}
      onMouseLeave={() => onMetricLeave?.()}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={`${color} flex-shrink-0`}>{icon}</div>
        <span className="text-sm truncate">{label}</span>
      </div>
      <div className={`font-semibold flex-shrink-0 ${count === 0 ? 'text-muted-foreground' : 'text-white'}`}>
        {count}
      </div>
    </div>
  );

  // Prepare data for the radial bar chart
  const chartData = [
    {
      name: "Consistent",
      value: metrics.consistent.length,
      fill: "hsl(var(--chart-1))"
    },
    {
      name: "Improved",
      value: metrics.improved.length,
      fill: "hsl(var(--chart-2))"
    },
    {
      name: "Regressed",
      value: metrics.regressed.length,
      fill: "hsl(var(--chart-3))"
    },
    {
      name: "Regressing",
      value: metrics.regressing.length,
      fill: "hsl(var(--chart-4))"
    }
  ];

  const chartConfig = {
    Consistent: {
      label: "Consistent",
    },
    Improved: {
      label: "Improved",
    },
    Regressed: {
      label: "Regressed",
    },
    Regressing: {
      label: "Regressing",
    },
  };

  // Radial chart component
  const MetricsRadialChart = () => {
    return (
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
              fill="var(--color-Consistent)"
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs">{metrics.consistent.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-xs">{metrics.improved.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <span className="text-xs">{metrics.regressed.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-xs">{metrics.regressing.length}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card onMouseLeave={() => onMetricLeave?.()}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Daily Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Radial Chart - Top/Left Side */}
          <div className="flex-shrink-0 flex justify-center lg:justify-start">
            <MetricsRadialChart />
          </div>

          {/* Metrics Grid - Bottom/Right Side */}
          <div className="flex-1 grid grid-cols-2 gap-4">
            {/* Consistent */}
            <MetricRow
              icon={<Circle className="h-4 w-4 fill-current" />}
              label="Consistent"
              count={metrics.consistent.length}
              color="text-green-600"
              workflows={metrics.consistent}
              metricType="consistent"
            />

            {/* Improved */}
            <MetricRow
              icon={<TrendingUp className="h-4 w-4" />}
              label="Improved"
              count={metrics.improved.length}
              color="text-blue-600"
              workflows={metrics.improved}
              metricType="improved"
            />

            {/* Still Failing */}
            <MetricRow
              icon={<ArrowDown className="h-4 w-4" />}
              label="Still Failing"
              count={metrics.regressing.length}
              color="text-red-600"
              workflows={metrics.regressing}
              metricType="regressing"
            />

            {/* Regressed */}
            <MetricRow
              icon={<TrendingDown className="h-4 w-4" />}
              label="Regressed"
              count={metrics.regressed.length}
              color="text-orange-600"
              workflows={metrics.regressed}
              metricType="regressed"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 