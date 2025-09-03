"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Plus,
  Trash2,
  Package,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CompactMetricsOverview from "@/components/CompactMetricsOverview";


// Helper function to format repository name for display (same as dashboard)
function formatRepoDisplayName(repoName: string): string {
  // Extract just the repo name part (after the last slash)
  const repoNamePart = repoName.split('/').pop() || repoName;
  
  // Convert kebab-case or snake_case to Title Case
  return repoNamePart
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
    .trim();
}

interface RepositoryCardProps {
  repoSlug: string;
  repoPath: string;
  displayName: string;
  avatarUrl?: string;
  htmlUrl?: string;
  hasError: boolean;
  errorMessage?: string;
  hasWorkflows?: boolean;
  metrics?: {
    totalWorkflows: number;
    passedRuns: number;
    failedRuns: number;
    inProgressRuns: number;
    successRate: number;
    hasActivity: boolean;
  } | null;
  isUserRepo?: boolean;
  onRequestDelete?: () => void;
}

function RepositoryCard({ repoSlug, repoPath, displayName, avatarUrl, htmlUrl, hasError, errorMessage, hasWorkflows, metrics, isUserRepo = false, onRequestDelete }: RepositoryCardProps) {
  // Get avatar URL from the repository data if available, otherwise fallback to GitHub API
  const owner = (repoPath || displayName || '').split('/')[0] || '';
  const cardContent = (
    <Card className={`relative h-full transition-all duration-200 ${
      hasError 
        ? 'border-red-500 bg-card hover:border-red-400' 
        : 'border-border bg-card hover:border-border/80 hover:shadow-md'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {avatarUrl && (
              <Image
                src={avatarUrl}
                alt={`${owner} avatar`}
                className="h-6 w-6 rounded-full border border-border"
                width={24}
                height={24}
                unoptimized
              />
            )}
            <CardTitle className="text-lg font-semibold">
              {formatRepoDisplayName(displayName)}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {hasError && <AlertCircle className="h-5 w-5 text-red-500" />}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(htmlUrl || `https://github.com/${repoPath}`, '_blank', 'noopener,noreferrer');
              }}
              title="View on GitHub"
              aria-label="View on GitHub"
            >
              <Github className="h-4 w-4" />
            </Button>
            {isUserRepo && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRequestDelete?.();
                }}
                title="Remove repository"
                aria-label="Remove repository"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasError ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600">
              {errorMessage || "Unable to access repository"}
            </p>
          </div>
        ) : hasWorkflows && metrics ? (
          <CompactMetricsOverview
            totalWorkflows={metrics.totalWorkflows}
            passedRuns={metrics.passedRuns}
            failedRuns={metrics.failedRuns}
            inProgressRuns={metrics.inProgressRuns}
            successRate={metrics.successRate}
            hasActivity={metrics.hasActivity}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              No workflows configured
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );

  if (hasError) {
    return (
      <div className="opacity-75">
        {cardContent}
      </div>
    );
  }

  return (
    <div className="block transition-all duration-200 hover:scale-[1.02] cursor-pointer" onClick={() => window.location.href = `/dashboard/${repoSlug}`}>
      {cardContent}
    </div>
  );
}


function NoRepositoryFound({
  newRepoUrl,
  isValidating,
  addError,
  onUrlChange,
  onSubmit,
}: {
  newRepoUrl: string;
  isValidating: boolean;
  addError: string | null;
  onUrlChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-xl">
        <div className="border rounded-lg bg-card/60 backdrop-blur-sm p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">No repository configured</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a GitHub repository to start tracking workflows and metrics.
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <input
              type="text"
              value={newRepoUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="owner/repo or GitHub URL"
              className="w-full sm:w-80 px-3 py-2 rounded-md bg-background border border-input text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2 justify-center">
              <Button type="submit" size="sm" disabled={isValidating} className="gap-2">
                <Plus className="h-4 w-4" />
                {isValidating ? 'Validating…' : 'Add Repo'}
              </Button>
            </div>
          </form>

          {addError && (
            <p className="mt-2 text-sm text-red-500">{addError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [availableRepos, setAvailableRepos] = React.useState<Array<{
    slug: string;
    repoPath: string;
    envKey: string;
    displayName: string;
    avatarUrl?: string;
    htmlUrl?: string;
    hasConfig: boolean;
    hasWorkflows?: boolean;
    metrics?: {
      totalWorkflows: number;
      passedRuns: number;
      failedRuns: number;
      inProgressRuns: number;
      successRate: number;
      hasActivity: boolean;
    } | null;
  }>>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [newRepoUrl, setNewRepoUrl] = React.useState("");
  const [addError, setAddError] = React.useState<string | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const [repoToDelete, setRepoToDelete] = React.useState<{
    slug: string;
    displayName: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);





  // Clear any in-memory trigger map cache for this repo
  const clearRepoLocalState = React.useCallback((repoSlug: string) => {
    try {
      const cache = (globalThis as any).__triggerMaps as Record<string, any> | undefined;
      if (cache && cache[repoSlug]) {
        delete cache[repoSlug];
      }
    } catch {}
  }, []);

  // Build repositories list from API (single repository only)
  const hydrateUserRepos = async () => {
    try {
      console.log('📋 Fetching repository from API...');
      
      // Fetch all repositories from the API
      const response = await fetch('/api/repo', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch repository');
      }
      
      const data = await response.json();
      const allRepos = data.repositories || [];
      
      // Map to the expected format
      const mappedRepos = allRepos.map((r: any) => ({
        slug: r.slug,
        repoPath: r.repoPath || r.slug.replace(/-/g, '/'), // Convert slug back to repoPath if needed
        htmlUrl: r.htmlUrl,
        envKey: r.envKey || 'LOCAL',
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        hasConfig: r.hasConfig || false,
        hasWorkflows: false,
        metrics: null,
      }));

      // Only fetch workflow data if we have a repository
      if (mappedRepos.length === 0) {
        setAvailableRepos([]);
        return;
      }

      const todayStr = new Date().toISOString().slice(0, 10);

      // Fetch workflow data for the repository
      const enhanced = await Promise.all(
        mappedRepos.map(async (repo: any) => {
          try {
            // Fetch workflows for this repository
            const workflowResponse = await fetch(`/api/workflow/${repo.slug}`, { cache: 'no-store' });
            let hasWorkflows = false;
            let metrics = {
              totalWorkflows: 0,
              passedRuns: 0,
              failedRuns: 0,
              inProgressRuns: 0,
              successRate: 0,
              hasActivity: false
            };

            if (workflowResponse.ok) {
              const workflowData = await workflowResponse.json();
              hasWorkflows = workflowData.workflows && workflowData.workflows.length > 0;
              
              // Get total workflow count from all workflows (not just those that ran today)
              const totalWorkflows = workflowData.workflows ? workflowData.workflows.length : 0;
              
              if (hasWorkflows) {
                // Fetch today's workflow runs to calculate metrics
                const runsResponse = await fetch(`/api/workflow/${repo.slug}?date=${todayStr}`, { cache: 'no-store' });
                if (runsResponse.ok) {
                  const runsData = await runsResponse.json();
                  const overviewData = runsData.overviewData;
                  
                  metrics = {
                    totalWorkflows: totalWorkflows, // Use total workflows from all workflows
                    passedRuns: overviewData.passedRuns || 0,
                    failedRuns: overviewData.failedRuns || 0,
                    inProgressRuns: overviewData.inProgressRuns || 0,
                    successRate: overviewData.completedRuns > 0 
                      ? Math.round((overviewData.passedRuns / overviewData.completedRuns) * 100) 
                      : 0,
                    hasActivity: (overviewData.completedRuns > 0 || overviewData.inProgressRuns > 0)
                  };
                } else {
                  // If runs API fails, still show total workflow count
                  metrics = {
                    totalWorkflows: totalWorkflows,
                    passedRuns: 0,
                    failedRuns: 0,
                    inProgressRuns: 0,
                    successRate: 0,
                    hasActivity: false
                  };
                }
              } else {
                // No workflows found
                metrics = {
                  totalWorkflows: 0,
                  passedRuns: 0,
                  failedRuns: 0,
                  inProgressRuns: 0,
                  successRate: 0,
                  hasActivity: false
                };
              }
            }

            return { 
              ...repo, 
              hasWorkflows, 
              metrics 
            };
          } catch (error) {
            console.error(`Error fetching workflow data for ${repo.slug}:`, error);
            return { 
              ...repo, 
              hasWorkflows: false, 
              metrics: {
                totalWorkflows: 0,
                passedRuns: 0,
                failedRuns: 0,
                inProgressRuns: 0,
                successRate: 0,
                hasActivity: false
              }
            };
          }
        })
      );

      setAvailableRepos(enhanced);
      console.log(`✅ Loaded ${enhanced.length} repository with workflow data`);
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent Strict Mode double-invoke of effects in dev and set up polling
  const didInitRef = React.useRef(false);
  const pollRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (didInitRef.current) {
      return;
    }
    didInitRef.current = true;

    console.log('🏠 Home page mounted - loading repository...');

    // Initial load (one-time)
    hydrateUserRepos();

    // Start polling only once, delay first tick to avoid immediate back-to-back fetches
    const startPolling = () => {
      if (pollRef.current !== null) return;
      pollRef.current = window.setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          console.log('🔄 Polling repository (10s interval)...');
          hydrateUserRepos();
        }
      }, 10000); // 10s
    };

    // Delay starting the interval to avoid immediate re-fetch after initial hydrate
    const starter = window.setTimeout(startPolling, 5000);

    return () => {
      console.log('🏠 Home page unmounting - clearing interval');
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      window.clearTimeout(starter);
    };
  }, []);

  async function handleAddRepo(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const input = newRepoUrl.trim();
    if (!input) {
      setAddError('Please enter a GitHub repository URL or owner/repo');
      return;
    }

    // Check if we already have a repository
    if (availableRepos.length > 0) {
      setAddError('Dashboard-mini only supports one repository. Please remove the existing repository first.');
      return;
    }

    setIsValidating(true);
    try {
      // Step 1: Validate the repository
      const validateRes = await fetch('/api/repo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: input }),
      });
      const validateJson = await validateRes.json();
      
      if (!validateRes.ok || validateJson.valid === false) {
        setAddError(validateJson?.error || 'Repository validation failed');
        return;
      }

      // Step 2: Add the repository to dashboard
      const addRes = await fetch('/api/repo/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: validateJson.repoPath,
          displayName: validateJson.displayName,
          htmlUrl: validateJson.htmlUrl,
          defaultBranch: validateJson.defaultBranch,
          avatarUrl: validateJson.avatarUrl
        }),
      });
      const addJson = await addRes.json();
      
      if (!addRes.ok) {
        if (addRes.status === 409) {
          setAddError('Repository already exists in your dashboard');
        } else {
          setAddError(addJson?.error || 'Failed to add repository to dashboard');
        }
        return;
      }

      // Success! Refresh the repositories list
      await hydrateUserRepos();
      
      setNewRepoUrl('');
    } catch (err) {
      setAddError('Network error processing repository');
      setNewRepoUrl(''); // Clear input on error
    } finally {
      setIsValidating(false);
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D]">
        <div className="container mx-auto p-6">
          <div className="mb-8">
            <p className="text-muted-foreground">
              Loading repository...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0D0D0D]">
        <div className="container mx-auto p-6">
          <div className="mb-8">
            <p className="text-muted-foreground text-red-600">
              Error: {error}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (availableRepos.length === 0) {
    return (
      <div className="min-h-screen bg-[#0D0D0D]">
        <div className="container mx-auto p-6 space-y-8">
          <NoRepositoryFound
            newRepoUrl={newRepoUrl}
            isValidating={isValidating}
            addError={addError}
            onUrlChange={(v) => setNewRepoUrl(v)}
            onSubmit={handleAddRepo}
          />
        </div>
      </div>
    );
  }

  // Process each repository to check for errors and workflow configuration
  const repositoryData = availableRepos.map(repo => ({
    ...repo,
    // Keep neutral style and allow navigation even when not configured
    hasError: false,
    errorMessage: ''
  })).sort((a, b) => {
    // Sort alphabetically by repository name (not org/user)
    const repoNameA = formatRepoDisplayName(a.displayName);
    const repoNameB = formatRepoDisplayName(b.displayName);
    return repoNameA.localeCompare(repoNameB);
  });

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <div className="container mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repositoryData.map((repo) => (
            <RepositoryCard
              key={repo.slug}
              repoSlug={repo.slug}
              repoPath={repo.repoPath}
              displayName={repo.displayName}
              avatarUrl={repo.avatarUrl}
              htmlUrl={repo.htmlUrl}
              hasError={repo.hasError}
              errorMessage={repo.errorMessage}
              hasWorkflows={repo.hasWorkflows}
              metrics={repo.metrics}
              isUserRepo={true}
              onRequestDelete={() => setRepoToDelete({ slug: repo.slug, displayName: repo.displayName })}
            />
          ))}
        </div>

        {/* Confirmation Modal */}
        {repoToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-lg">
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Remove repository</h2>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to remove
                  {" "}
                  <span className="font-medium text-foreground">{formatRepoDisplayName(repoToDelete.displayName)}</span>?
                </p>
                <p className="text-xs text-muted-foreground">
                  You can add a different repository after removing this one.
                </p>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setRepoToDelete(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!repoToDelete) return;
                    setIsDeleting(true);
                    try {
                      // Delete from API
                      const response = await fetch(`/api/repo/${repoToDelete.slug}`, {
                        method: 'DELETE'
                      });
                      
                      if (response.ok) {
                        // Remove from local state
                        setAvailableRepos(prev => prev.filter(r => r.slug !== repoToDelete.slug));
                        clearRepoLocalState(repoToDelete.slug);
                        setRepoToDelete(null);
                      } else {
                        console.error('Failed to delete repository');
                      }
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Removing…' : 'Remove'}
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
} 