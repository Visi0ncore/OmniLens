"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Plus,
  Trash2,
  Package,
  CheckCircle,
  X,
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

function RepositoryCard({ repoSlug, repoPath, displayName, avatarUrl, hasError, errorMessage, hasWorkflows, metrics, isUserRepo = false, onRequestDelete }: RepositoryCardProps) {
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
              <img
                src={avatarUrl}
                alt={`${owner} avatar`}
                className="h-6 w-6 rounded-full border border-border"
                width={24}
                height={24}
                loading="lazy"
                decoding="async"
              />
            )}
            <CardTitle className="text-lg font-semibold">
              {formatRepoDisplayName(displayName)}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {hasError && <AlertCircle className="h-5 w-5 text-red-500" />}
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
    <Link href={`/dashboard/${repoSlug}`} className="block transition-all duration-200 hover:scale-[1.02]">
      {cardContent}
    </Link>
  );
}


function NoRepositoriesFound({
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
          <h2 className="text-2xl font-semibold tracking-tight">No repositories yet</h2>
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
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [newRepoUrl, setNewRepoUrl] = React.useState("");
  const [addError, setAddError] = React.useState<string | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const [repoToDelete, setRepoToDelete] = React.useState<{
    slug: string;
    displayName: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);





  // Remove all locally persisted state for a given repo slug
  const clearRepoLocalState = React.useCallback((repoSlug: string) => {
    try {
      // Remove repo-specific config
      localStorage.removeItem(`localRepoConfig-${repoSlug}`);

      // Remove per-date UI state (reviewed, collapsed, testing-reviewed)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.startsWith(`reviewedWorkflows-${repoSlug}-`) ||
          key.startsWith(`collapsedCategories-${repoSlug}-`) ||
          key.startsWith(`reviewedTestingWorkflows-${repoSlug}-`)
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}

    // Clear any in-memory trigger map cache for this repo
    try {
      const cache = (globalThis as any).__triggerMaps as Record<string, any> | undefined;
      if (cache && cache[repoSlug]) {
        delete cache[repoSlug];
      }
    } catch {}
  }, []);

  // Build repositories list from API (includes both env-configured and user-added repos)
  const hydrateUserRepos = React.useCallback(async () => {
    try {
      // Fetch all repositories from the API
      const response = await fetch('/api/repo', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }
      
      const data = await response.json();
      const allRepos = data.repositories || [];
      
      // Map to the expected format
      const mappedRepos = allRepos.map((r: any) => ({
        slug: r.slug,
        repoPath: r.repoPath || r.slug.replace(/-/g, '/'), // Convert slug back to repoPath if needed
        envKey: r.envKey || 'LOCAL',
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        hasConfig: r.hasConfig || false,
        hasWorkflows: false,
        metrics: null,
      }));

      const todayStr = new Date().toISOString().slice(0, 10);

      const enhanced = await Promise.all(
        mappedRepos.map(async (repo: any) => {
          try {
            const raw = localStorage.getItem(`localRepoConfig-${repo.slug}`);
            const localCfg = raw ? JSON.parse(raw) : null;
            const configuredFiles: string[] = localCfg
              ? Object.values(localCfg.categories || {}).flatMap((c: any) => c?.workflows || [])
              : [];

            const hasLocalWorkflows = configuredFiles.length > 0;
            if (!hasLocalWorkflows || !repo.repoPath) {
              return { ...repo, hasWorkflows: hasLocalWorkflows, metrics: hasLocalWorkflows ? { totalWorkflows: configuredFiles.length, passedRuns: 0, failedRuns: 0, inProgressRuns: 0, successRate: 0, hasActivity: false } : { totalWorkflows: 0, passedRuns: 0, failedRuns: 0, inProgressRuns: 0, successRate: 0, hasActivity: false } };
            }

            const resRuns = await fetch(`/api/repositories/workflow-runs?repoPath=${encodeURIComponent(repo.repoPath)}&date=${encodeURIComponent(todayStr)}`, { cache: 'no-store' });
            if (!resRuns.ok) {
              return { ...repo, hasWorkflows: hasLocalWorkflows, metrics: { totalWorkflows: configuredFiles.length, passedRuns: 0, failedRuns: 0, inProgressRuns: 0, successRate: 0, hasActivity: false } };
            }
            const json = await resRuns.json();
            const runs = (json.workflow_runs || []).filter((r: any) => {
              const file = (r.path || r.workflow_path || r.workflow_name || '').split('/').pop();
              return file && configuredFiles.some((cfg) => file.includes(cfg));
            });
            const completedRuns = runs.filter((r: any) => r.status === 'completed').length;
            const inProgressRuns = runs.filter((r: any) => r.status === 'in_progress' || r.status === 'queued').length;
            const passedRuns = runs.filter((r: any) => r.conclusion === 'success').length;
            const failedRuns = runs.filter((r: any) => r.conclusion === 'failure').length;
            const successRate = completedRuns > 0 ? Math.round((passedRuns / completedRuns) * 100) : 0;
            const hasActivity = completedRuns > 0 || inProgressRuns > 0;
            return { ...repo, hasWorkflows: true, metrics: { totalWorkflows: configuredFiles.length, passedRuns, failedRuns, inProgressRuns, successRate, hasActivity } };
          } catch {
            return repo;
          }
        })
      );

      setAvailableRepos(enhanced);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    hydrateUserRepos();
  }, [hydrateUserRepos]);

  // Poll in the background to reflect new runs without manual refresh
  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        hydrateUserRepos();
      }
    }, 10000); // 10s
    return () => window.clearInterval(intervalId);
  }, [hydrateUserRepos]);

  async function handleAddRepo(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const input = newRepoUrl.trim();
    if (!input) {
      setAddError('Please enter a GitHub repository URL or owner/repo');
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
      setShowAddForm(false);
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
              Loading repositories...
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
          <NoRepositoriesFound
            newRepoUrl={newRepoUrl}
            isValidating={isValidating}
            addError={addError}
            onUrlChange={(v) => setNewRepoUrl(v)}
            onSubmit={handleAddRepo}
          />
          {/* Confirmation Modal (hidden when no repo) */}
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
      <div className="p-6 space-y-8">
        <div className="flex justify-end mb-6">
          <div className="flex items-center gap-2">
            {showAddForm && (
              <form onSubmit={handleAddRepo} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  placeholder="owner/repo or GitHub URL"
                  className={`w-80 px-3 py-2 rounded-md bg-background border text-sm outline-none focus:ring-2 focus:ring-primary ${
                    addError ? 'border-red-500' : 'border-input'
                  }`}
                  autoFocus
                  onFocus={() => {
                    if (addError) {
                      setAddError(null);
                      setNewRepoUrl("");
                    }
                  }}
                  onBlur={() => {
                    if (!isValidating) {
                      setShowAddForm(false);
                      setAddError(null);
                      setNewRepoUrl("");
                    }
                  }}
                />
                <Button type="submit" size="sm" disabled={isValidating} onMouseDown={(e) => e.preventDefault()}>
                  <Plus className="h-4 w-4 mr-2" />
                  {isValidating ? 'Validating…' : 'Add Repo'}
                </Button>
              </form>
            )}
            {!showAddForm && (
              <Button variant="default" size="sm" onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Repo
              </Button>
            )}
          </div>
          
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repositoryData.map((repo) => (
            <RepositoryCard
              key={repo.slug}
              repoSlug={repo.slug}
              repoPath={repo.repoPath}
              displayName={repo.displayName}
              avatarUrl={repo.avatarUrl}
              hasError={repo.hasError}
              errorMessage={repo.errorMessage}
              hasWorkflows={repo.hasWorkflows}
              metrics={repo.metrics}
              isUserRepo={repo.envKey === 'LOCAL' || repo.slug.startsWith('local-')}
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