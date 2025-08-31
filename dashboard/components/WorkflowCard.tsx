import { Clock, ExternalLink, Check, Eye } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { WorkflowRun } from "@/lib/github";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cleanWorkflowName } from "@/lib/utils";

function duration(start: string, end: string): string {
  const startTime = new Date(start);
  const endTime = new Date(end);
  const diff = endTime.getTime() - startTime.getTime();

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatRunTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface WorkflowCardProps {
  run: WorkflowRun;
  isReviewed: boolean;
  onToggleReviewed: () => void;
  repoSlug: string; // Repository slug for config context
  isHighlighted?: boolean;
  highlightColor?: string;
  rightAction?: React.ReactNode; // Optional right-side action button (e.g., delete)
}

export default function WorkflowCard({
  run,
  isReviewed,
  onToggleReviewed,
  repoSlug,
  isHighlighted = false,
  highlightColor = '',
  rightAction
}: WorkflowCardProps) {
  const status = run.conclusion ?? run.status;
  const isMissing = (run as any).isMissing === true || status === 'missing';
  const isSuccess = !isMissing && status === "success";
  const isInProgress = !isMissing && (status === "in_progress" || status === 'queued');

  // Determine border classes
  const getBorderClass = () => {
    if (isHighlighted && highlightColor) {
      return `${highlightColor} border-2 shadow-lg`;
    }
    return 'border-2 border-border'; // Use the default border color with consistent width
  };

  // Determine card height - use natural sizing
  const cardHeightClass = 'h-auto';

  // Use workflow name directly, with fallback to cleaned name
  const getDisplayName = (): string => {
    // Use the workflow name directly from the API
    if (run.name) {
      return cleanWorkflowName(run.name);
    }
    
    // Fallback to workflow_name if available
    if ((run as any).workflow_name) {
      return cleanWorkflowName((run as any).workflow_name);
    }
    
    // Last resort: extract from path
    if (run.path) {
      const last = run.path.split('/').pop() || run.path;
      const noExt = last.replace(/\.ya?ml$/i, '');
      const cleaned = noExt.replace(/[-_]/g, ' ').trim();
      return cleaned.replace(/\b\w/g, (l) => l.toUpperCase());
    }
    
    return 'Unknown Workflow';
  };

  return (
    <Card className={`${cardHeightClass} ${getBorderClass()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm leading-tight truncate pr-2">
            {getDisplayName()}
          </h3>
          <div className="flex items-center gap-2">
            {/* Show run count badge if workflow was run multiple times */}
            {!isMissing && run.run_count && run.run_count > 1 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Badge variant="secondary" className="shrink-0 text-xs cursor-pointer hover:opacity-80">
                    {run.run_count}
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="bottom" align="end">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">All Runs</h4>
                    <div className="space-y-1">
                      {run.all_runs && run.all_runs.length > 0 ? (
                        run.all_runs.map((runDetail, index) => (
                          <div key={runDetail.id} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-16">
                              {formatRunTime(runDetail.run_started_at)}
                            </span>
                            <span className="font-mono w-24">
                              #{runDetail.id}
                            </span>
                            {(() => {
                              const isDetailRunning = (runDetail.status === 'in_progress' || runDetail.status === 'queued') && (runDetail.conclusion === null || runDetail.conclusion === undefined);
                              const isDetailSuccess = runDetail.conclusion === 'success';
                              const label = isDetailSuccess ? 'Pass' : isDetailRunning ? 'Running' : 'Fail';
                              const variant = isDetailSuccess ? 'success' : 'destructive';
                              const runningClass = isDetailRunning ? 'bg-orange-500 hover:bg-orange-600 text-white' : '';
                              return (
                                <Badge variant={variant} className={`text-xs justify-self-start ${runningClass}`}>
                                  {label}
                                </Badge>
                              );
                            })()}
                            <Button variant="ghost" size="sm" asChild className="h-6 px-1">
                              <Link href={runDetail.html_url} target="_blank">
                                <Eye className="h-3 w-3" />
                              </Link>
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground">No run details available</div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Badge
              variant={isMissing ? "secondary" : isSuccess ? "success" : isInProgress ? "destructive" : "destructive"}
              className={`shrink-0 ${isInProgress ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
            >
              {isMissing ? "Didn't Run" : isSuccess ? "Pass" : isInProgress ? "Running" : "Fail"}
            </Badge>
            {rightAction}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">




        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{isMissing ? "No runs" : isInProgress ? "Running" : (run.run_started_at && run.updated_at ? duration(run.run_started_at, run.updated_at) : "")}</span>
            </div>
          <div className="flex items-center gap-2">
            {!isInProgress && !isMissing ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={run.html_url} target="_blank">
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
            <Button
              variant={isReviewed ? "default" : "outline"}
              size="sm"
              onClick={onToggleReviewed}
              className={isReviewed ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <Check className={`h-3 w-3 ${!isReviewed ? "mr-1" : ""}`} />
              {!isReviewed && "Review"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 