import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Circle, TrendingUp, TrendingDown, ArrowDown } from "lucide-react";
import type { WorkflowRun } from "@/lib/github";
import workflowConfig from "@/config/workflows.json";

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
    const status = run.conclusion === 'success' ? 'passed' : 'failed';
    yesterdayMap.set(run.workflow_id, status);
  });

  todayRuns.forEach(run => {
    const todayStatus = run.conclusion === 'success' ? 'passed' : 'failed';
    const yesterdayStatus = yesterdayMap.get(run.workflow_id) || 'unknown';

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
      <div className={`font-semibold flex-shrink-0 ${count === 0 ? 'text-muted-foreground' : color}`}>
        {count}
      </div>
    </div>
  );

  // Pie chart component
  const MetricsPieChart = () => {
    const radius = 25;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;

    // Calculate percentages and offsets for each metric
    const consistentPercent = totalWorkflows > 0 ? (metrics.consistent.length / totalWorkflows) * 100 : 0;
    const improvedPercent = totalWorkflows > 0 ? (metrics.improved.length / totalWorkflows) * 100 : 0;
    const regressedPercent = totalWorkflows > 0 ? (metrics.regressed.length / totalWorkflows) * 100 : 0;
    const regressingPercent = totalWorkflows > 0 ? (metrics.regressing.length / totalWorkflows) * 100 : 0;

    return (
      <div className="flex items-center gap-3">
        <div className="relative">
          <svg width="60" height="60" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="30"
              cy="30"
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="6"
            />
            
            {/* Consistent (Green) */}
            {metrics.consistent.length > 0 && (
              <circle
                cx="30"
                cy="30"
                r={radius}
                fill="none"
                stroke="rgb(34, 197, 94)"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (consistentPercent / 100) * circumference}
                strokeLinecap="round"
                transform={`rotate(${currentOffset} 30 30)`}
              />
            )}
            {currentOffset += (consistentPercent / 100) * 360}

            {/* Improved (Blue) */}
            {metrics.improved.length > 0 && (
              <circle
                cx="30"
                cy="30"
                r={radius}
                fill="none"
                stroke="rgb(59, 130, 246)"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (improvedPercent / 100) * circumference}
                strokeLinecap="round"
                transform={`rotate(${currentOffset} 30 30)`}
              />
            )}
            {currentOffset += (improvedPercent / 100) * 360}

            {/* Regressed (Orange) */}
            {metrics.regressed.length > 0 && (
              <circle
                cx="30"
                cy="30"
                r={radius}
                fill="none"
                stroke="rgb(249, 115, 22)"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (regressedPercent / 100) * circumference}
                strokeLinecap="round"
                transform={`rotate(${currentOffset} 30 30)`}
              />
            )}
            {currentOffset += (regressedPercent / 100) * 360}

            {/* Regressing (Red) */}
            {metrics.regressing.length > 0 && (
              <circle
                cx="30"
                cy="30"
                r={radius}
                fill="none"
                stroke="rgb(239, 68, 68)"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (regressingPercent / 100) * circumference}
                strokeLinecap="round"
                transform={`rotate(${currentOffset} 30 30)`}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold">
              {Math.round(consistentPercent)}%
            </span>
          </div>
        </div>
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
          {/* Pie Chart - Top/Left Side */}
          <div className="flex-shrink-0 flex justify-center lg:justify-start">
            <MetricsPieChart />
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