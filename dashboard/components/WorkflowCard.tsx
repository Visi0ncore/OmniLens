import { Clock, ExternalLink, Check, Eye } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { WorkflowRun } from "@/lib/github";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cleanWorkflowName, isTriggerWorkflow, getTestingWorkflowsForTrigger } from "@/lib/utils";

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
  allWorkflowRuns?: WorkflowRun[]; // All workflow runs to find testing workflows
  reviewedTestingWorkflows?: Set<string>;
  onToggleTestingWorkflowReviewed?: (testingWorkflowName: string) => void;
  rightAction?: React.ReactNode; // Optional right-side action button (e.g., delete)
  triggerMapVersion?: number; // bump to recompute testing mappings when trigger map updates
}

export default function WorkflowCard({
  run,
  isReviewed,
  onToggleReviewed,
  repoSlug,
  isHighlighted = false,
  highlightColor = '',
  allWorkflowRuns = [],
  reviewedTestingWorkflows = new Set(),
  onToggleTestingWorkflowReviewed,
  rightAction
}: WorkflowCardProps) {
  const status = run.conclusion ?? run.status;
  const isMissing = (run as any).isMissing === true || status === 'missing';
  const isSuccess = !isMissing && status === "success";
  const isInProgress = !isMissing && (status === "in_progress" || status === 'queued');

  // Check if this is a trigger workflow - try both name and workflow_name
  const isTrigger = isTriggerWorkflow(run.name, repoSlug) || isTriggerWorkflow(run.workflow_name || '', repoSlug);

  // Get testing workflows for this trigger workflow - try both name and workflow_name
  const testingWorkflowFiles = isTrigger ?
    (getTestingWorkflowsForTrigger(run.name, repoSlug) || getTestingWorkflowsForTrigger(run.workflow_name || '', repoSlug)) : [];
  const testingWorkflows = testingWorkflowFiles.map(file => {
    const workflowName = file.replace('.yml', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    // Try to find the workflow run by matching the file name in the workflow name
    const matchingRun = allWorkflowRuns.find(r => {
      const runName = r.name.toLowerCase();
      const fileName = file.replace('.yml', '').toLowerCase();
      // Try multiple matching strategies
      return runName.includes(fileName) ||
        runName.includes(fileName.replace('-', ' ')) ||
        runName.includes(fileName.replace('-', '')) ||
        fileName.includes(runName.replace(/\s+/g, ''));
    });
    return {
      name: workflowName,
      file: file,
      run: matchingRun
    };
  })
  // Sort by workflow file basename (case-insensitive)
  .sort((a, b) => {
    const baseA = (a.file || '').toString().split('/').pop()?.toLowerCase() || '';
    const baseB = (b.file || '').toString().split('/').pop()?.toLowerCase() || '';
    return baseA.localeCompare(baseB);
  }); // Keep all testing workflows, even if a matching run isn't found

  // Check if all testing workflows are reviewed
  const allTestingWorkflowsReviewed = isTrigger && testingWorkflows.length > 0 &&
    testingWorkflows.every(wf => reviewedTestingWorkflows.has(wf.name));

  // Debug logging for trigger workflows
  if (isTrigger) {
    console.log('Trigger workflow:', run.name);
    console.log('Testing workflow files:', testingWorkflowFiles);
    console.log('Found testing workflows:', testingWorkflows);
    console.log('All reviewed:', allTestingWorkflowsReviewed);
  }

  // Determine border classes
  const getBorderClass = () => {
    if (isHighlighted && highlightColor) {
      return `${highlightColor} border-2 shadow-lg`;
    }
    return 'border-2 border-border'; // Use the default border color with consistent width
  };

  // Determine card height - trigger cards should only be taller when testing workflows are visible
  const shouldShowTestingWorkflows = isTrigger && testingWorkflows.length > 0 && !isReviewed;
  // Use a minimum height when testing workflows are shown to avoid layout jumps,
  // otherwise allow the card to size naturally instead of stretching to the tallest row peer.
  const cardHeightClass = shouldShowTestingWorkflows ? 'min-h-[200px]' : 'h-auto';

  // Removed animated collapse/expand to ensure immediate visibility of testing workflows

  // Prefer workflow file name when available; fall back to API-provided name
  const getDisplayName = (): string => {
    const source = (run.workflow_name || run.path || run.name || '').toString();
    const last = source.split('/').pop() || source;
    const noExt = last.replace(/\.ya?ml$/i, '');
    const cleaned = noExt.replace(/[-_]/g, ' ').trim();
    if (!cleaned) return cleanWorkflowName(run.name || '');
    return cleaned.replace(/\b\w/g, (l) => l.toUpperCase());
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


        {/* Testing workflows section for trigger workflows (no animation) */}
        {shouldShowTestingWorkflows && (
          <div className="mb-3 rounded-md">
            <div className="p-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Testing Workflows:</div>
              <div className="space-y-1">
                {testingWorkflows.map((testingWorkflow, index) => {
                  return (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <span className="truncate pr-2">
                        {testingWorkflow.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant={reviewedTestingWorkflows.has(testingWorkflow.name) ? "default" : "outline"}
                          size="sm"
                          className={`h-5 px-2 text-xs ${reviewedTestingWorkflows.has(testingWorkflow.name) ? "bg-green-600 hover:bg-green-700" : ""}`}
                          onClick={() => {
                            if (onToggleTestingWorkflowReviewed) {
                              onToggleTestingWorkflowReviewed(testingWorkflow.name);
                            }
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {reviewedTestingWorkflows.has(testingWorkflow.name) ? "" : "Review"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
              disabled={(!isMissing) && isTrigger && testingWorkflows.length > 0 && !allTestingWorkflowsReviewed}
              className={isReviewed ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <Check className={`h-3 w-3 ${!isReviewed ? "mr-1" : ""}`} />
              {!isReviewed && (isTrigger && testingWorkflows.length > 0 ? "Review All" : "Review")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 