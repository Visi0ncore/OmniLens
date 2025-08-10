"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Plus, Trash2, Package } from "lucide-react";
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

function RepositoryCard({ repoSlug, repoPath, displayName, hasError, errorMessage, hasWorkflows, metrics, isUserRepo = false, onRequestDelete }: RepositoryCardProps) {
  const cardContent = (
    <Card className={`relative h-full transition-all duration-200 ${
      hasError 
        ? 'border-red-500 bg-card hover:border-red-400' 
        : 'border-border bg-card hover:border-border/80 hover:shadow-md'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {formatRepoDisplayName(displayName)}
          </CardTitle>
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
        <p className="text-sm text-muted-foreground font-mono">
          {displayName}
        </p>
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

  const loadUserAddedRepos = React.useCallback(() => {
    try {
      const stored = localStorage.getItem('userAddedRepos');
      if (!stored) return [] as any[];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [] as any[];
      return parsed as Array<any>;
    } catch {
      return [] as any[];
    }
  }, []);

  const saveUserAddedRepos = React.useCallback((repos: any[]) => {
    try {
      localStorage.setItem('userAddedRepos', JSON.stringify(repos));
    } catch {
      // ignore storage failures
    }
  }, []);

  // Fetch repositories from API
  React.useEffect(() => {
    const fetchRepositories = async () => {
      try {
        const response = await fetch('/api/repositories/metrics');
        if (!response.ok) {
          throw new Error('Failed to fetch repository metrics');
        }
        const data = await response.json();
        // Merge server repositories with any user-added repos from localStorage
        const userRepos = loadUserAddedRepos();
        // Map user repos to expected shape
        const mappedUserRepos = userRepos.map((r: any) => ({
          slug: r.slug,
          repoPath: r.repoPath,
          envKey: 'LOCAL',
          displayName: r.displayName || r.repoPath,
          hasConfig: false,
          hasWorkflows: false,
          metrics: null,
        }));

        // Deduplicate by slug
        const combined: Record<string, any> = {};
        [...data.repositories, ...mappedUserRepos].forEach((repo: any) => {
          combined[repo.slug] = repo;
        });
        setAvailableRepos(Object.values(combined));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepositories();
  }, [loadUserAddedRepos]);

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
      const res = await fetch('/api/repositories/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: input }),
      });
      const json = await res.json();
      if (!res.ok || json.valid === false) {
        setAddError(json?.error || 'Repository validation failed');
        return;
      }

      const repoPath: string = json.repoPath;
      const displayName: string = json.displayName || repoPath;
      const slug = `local-${repoPath.replace(/\//g, '-')}`;

      const newRepo = {
        slug,
        repoPath,
        envKey: 'LOCAL',
        displayName,
        hasConfig: false,
        hasWorkflows: false,
        metrics: null,
      };

      setAvailableRepos(prev => {
        const exists = prev.some(r => r.slug === slug);
        const next = exists ? prev : [...prev, newRepo];
        // Persist minimal representation
        const stored = loadUserAddedRepos();
        const storedExists = stored.some((r: any) => r.slug === slug);
        const updatedStored = storedExists ? stored : [...stored, { slug, repoPath, displayName }];
        saveUserAddedRepos(updatedStored);
        return next;
      });

      setNewRepoUrl('');
      setShowAddForm(false);
    } catch (err) {
      setAddError('Network error validating repository');
    } finally {
      setIsValidating(false);
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D]">
        <div className="container mx-auto p-6">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">👁️ OmniLens</h1>
            <p className="text-muted-foreground">
              Loading repositories...
            </p>
          </header>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0D0D0D]">
        <div className="container mx-auto p-6">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">👁️ OmniLens</h1>
            <p className="text-muted-foreground text-red-600">
              Error: {error}
            </p>
          </header>
        </div>
      </div>
    );
  }
  
  if (availableRepos.length === 0) {
    return (
      <div className="min-h-screen bg-[#0D0D0D]">
        <div className="container mx-auto p-6 space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">👁️ OmniLens</h1>
          </header>
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
                        setAvailableRepos(prev => prev.filter(r => r.slug !== repoToDelete.slug));
                        const stored = loadUserAddedRepos();
                        const updated = stored.filter((r: any) => r.slug !== repoToDelete.slug);
                        saveUserAddedRepos(updated);
                        setRepoToDelete(null);
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
      <div className="container mx-auto p-6 space-y-8">
        <header className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold tracking-tight">👁️ OmniLens</h1>
            <div className="w-full sm:w-auto">
              {!showAddForm ? (
                <div className="flex justify-end">
                  <Button variant="default" size="sm" onClick={() => setShowAddForm(true)}>
                    <Plus className="h-4 w-4" />
                    Add Repo
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleAddRepo} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newRepoUrl}
                    onChange={(e) => setNewRepoUrl(e.target.value)}
                    placeholder="owner/repo or GitHub URL"
                    className="w-full sm:w-80 px-3 py-2 rounded-md bg-background border border-input text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={isValidating}>
                      {isValidating ? 'Validating…' : 'Add'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setShowAddForm(false); setAddError(null); }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
              {addError && (
                <p className="mt-2 text-sm text-red-500">{addError}</p>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repositoryData.map((repo) => (
            <RepositoryCard
              key={repo.slug}
              repoSlug={repo.slug}
              repoPath={repo.repoPath}
              displayName={repo.displayName}
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
                      setAvailableRepos(prev => prev.filter(r => r.slug !== repoToDelete.slug));
                      const stored = loadUserAddedRepos();
                      const updated = stored.filter((r: any) => r.slug !== repoToDelete.slug);
                      saveUserAddedRepos(updated);
                      setRepoToDelete(null);
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