"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertCircle } from "lucide-react";
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
}

function RepositoryCard({ repoSlug, repoPath, displayName, hasError, errorMessage, hasWorkflows, metrics }: RepositoryCardProps) {
  const cardContent = (
    <Card className={`h-full transition-all duration-200 ${
      hasError 
        ? 'border-red-500 bg-card hover:border-red-400' 
        : 'border-border bg-card hover:border-border/80 hover:shadow-md'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {formatRepoDisplayName(displayName)}
          </CardTitle>
          {hasError && <AlertCircle className="h-5 w-5 text-red-500" />}
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

  if (hasError || !hasWorkflows) {
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

function NoRepositoriesFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
      <div className="rounded-full bg-muted p-6">
        <Calendar className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          No repositories found
        </h2>
        <p className="text-muted-foreground max-w-md">
          Please configure <code className="bg-muted px-2 py-1 rounded text-sm">GITHUB_REPO_1</code>, 
          <code className="bg-muted px-2 py-1 rounded text-sm mx-1">GITHUB_REPO_2</code>, or 
          <code className="bg-muted px-2 py-1 rounded text-sm">GITHUB_REPO_3</code> environment variables.
        </p>
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

  // Fetch repositories from API
  React.useEffect(() => {
    const fetchRepositories = async () => {
      try {
        const response = await fetch('/api/repositories/metrics');
        if (!response.ok) {
          throw new Error('Failed to fetch repository metrics');
        }
        const data = await response.json();
        setAvailableRepos(data.repositories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepositories();
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">👁️ OmniLens</h1>
          </header>
          <NoRepositoriesFound />
        </div>
      </div>
    );
  }

  // Process each repository to check for errors and workflow configuration
  const repositoryData = availableRepos.map(repo => {
    let hasError = false;
    let errorMessage = '';

    if (!repo.hasConfig) {
      hasError = true;
      errorMessage = 'Repository not found in configuration';
    } else if (!repo.hasWorkflows) {
      hasError = true;
      errorMessage = 'No workflows configured';
    }

    return {
      ...repo,
      hasError,
      errorMessage
    };
  }).sort((a, b) => {
    // Sort alphabetically by repository name (not org/user)
    const repoNameA = formatRepoDisplayName(a.displayName);
    const repoNameB = formatRepoDisplayName(b.displayName);
    return repoNameA.localeCompare(repoNameB);
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">👁️ OmniLens</h1>
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
            />
          ))}
        </div>
      </div>
    </div>
  );
} 