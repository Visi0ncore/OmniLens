"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, isToday } from "date-fns";
import { DatePicker } from "@/components/DatePicker";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, Settings, BarChart3 } from "lucide-react";
import Link from "next/link";

// Helper function to format repository name for display
function formatRepoDisplayName(repoName: string): string {
  // Extract just the repo name part (after the last slash)
  const repoNamePart = repoName.split('/').pop() || repoName;
  
  // Convert kebab-case or snake_case to Title Case
  return repoNamePart
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
    .trim();
}

interface PageProps {
  params: { slug: string };
}

export default function DashboardPage({ params }: PageProps) {
  const { slug: repoSlug } = params;
  const [addedRepoPath, setAddedRepoPath] = useState<string | null>(null);

  // Initialize with today's date explicitly  
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Load workflows when component mounts
  useEffect(() => {
    // Since we removed localStorage, we'll set addedRepoPath to null
    // This will be handled by the API endpoints that check the database
    setAddedRepoPath(null);
  }, []);

  const selectedDateStr = format(selectedDate, "EEEE, MMMM d, yyyy");
  const isSelectedDateToday = isToday(selectedDate);

  // Handle setting date to today
  const handleSetToday = useCallback(() => {
    setSelectedDate(today);
  }, [today]);

  // Format repository display name - use the same logic as the repo card
  const repoDisplayName = addedRepoPath ? formatRepoDisplayName(addedRepoPath) : formatRepoDisplayName(repoSlug);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{repoDisplayName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            asChild
          >
            <Link href={`/dashboard/${repoSlug}/report`}>
              <BarChart3 className="h-4 w-4" />
              Report
            </Link>
          </Button>
          <Button
            variant={isSelectedDateToday ? "default" : "outline"}
            size="sm"
            onClick={handleSetToday}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Today
          </Button>
          <DatePicker
            date={selectedDate}
            onDateChange={(date) => {
              if (date) {
                setSelectedDate(date);
              }
            }}
            placeholder="Select Date"
          />
        </div>
      </div>

      {/* Show workflows or loading skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Available Workflows
          </h2>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Workflow functionality is being migrated to OpenAPI format.
          </p>
        </div>
      </div>
    </div>
  );
} 