"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Helper function to format repository name for display
function formatRepoDisplayName(repoName: string): string {
  const repoNamePart = repoName.split('/').pop() || repoName;
  return repoNamePart
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l: string) => l.toUpperCase())
    .trim();
}

interface PageProps {
  params: { slug: string };
}

export default function ReportPage({ params }: PageProps) {
  const repoSlug = params.slug;
  const repoDisplayName = formatRepoDisplayName(repoSlug);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/${repoSlug}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{repoDisplayName} Report</h1>
      </div>

      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Report functionality is being migrated to OpenAPI format.
        </p>
      </div>
    </div>
  );
}


