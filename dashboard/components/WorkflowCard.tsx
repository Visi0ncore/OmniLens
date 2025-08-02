import { Clock, ExternalLink, Check, Eye } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  onToggleTestingWorkflowReviewed
}: WorkflowCardProps) {
  const status = run.conclusion ?? run.status;
  const isSuccess = status === "success";
  const isDidntRun = status === "didnt_run" || run.isMissing;

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
  }); // Remove the filter to see all testing workflows, even if not found

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
  const cardHeightClass = shouldShowTestingWorkflows ? 'min-h-[200px]' : 'h-full';

  return (
    <Card className={`${cardHeightClass} transition-all duration-200 ${getBorderClass()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm leading-tight truncate pr-2">
            {cleanWorkflowName(run.name)}
          </h3>
          <div className="flex items-center gap-2">
            {/* Show run count badge if workflow was run multiple times */}
            {run.run_count && run.run_count > 1 && (
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
                            <Badge
                              variant={
                                runDetail.conclusion === 'success' ? "success" :
                                  runDetail.conclusion === null && runDetail.status === 'in_progress' ? "destructive" :
                                    "destructive"
                              }
                              className={`text-xs justify-self-start ${runDetail.conclusion === null && runDetail.status === 'in_progress'
                                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                  : ''
                                }`}
                            >
                              {runDetail.conclusion === 'success' ? "Pass" :
                                runDetail.conclusion === null && runDetail.status === 'in_progress' ? "Running" :
                                  "Fail"}
                            </Badge>
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
              variant={
                isSuccess ? "success" :
                  isDidntRun ? "warning" :
                    status === "in_progress" ? "destructive" :
                      "destructive"
              }
              className={`shrink-0 ${status === "in_progress"
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : ''
                }`}
            >
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              {isSuccess ? "Pass" :
                isDidntRun ? "Didn't Run" :
                  status === "in_progress" ? "Running" :
                    "Fail"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">


        {/* Show testing workflows for trigger workflows only when not reviewed */}
        {isTrigger && testingWorkflows.length > 0 && !isReviewed && (
          <div className="mb-3 p-2 rounded-md">
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
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{isDidntRun ? "Not executed" : duration(run.run_started_at, run.updated_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isDidntRun ? (
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
              disabled={isTrigger && testingWorkflows.length > 0 && !allTestingWorkflowsReviewed}
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