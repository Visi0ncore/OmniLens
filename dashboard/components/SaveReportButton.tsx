"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface SaveReportButtonProps {
  targetRef: React.RefObject<HTMLElement>;
  fileName: string;
  onBeforeSave?: () => Promise<void> | void;
}

export default function SaveReportButton({ targetRef, fileName, onBeforeSave }: SaveReportButtonProps) {
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (!targetRef.current || isSaving) return;
    setIsSaving(true);
    try {
      if (onBeforeSave) {
        await onBeforeSave();
        // Wait for the DOM to paint the updated timestamp before capture
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(targetRef.current as HTMLElement, {
        cacheBust: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          // Exclude any element explicitly marked to omit from capture
          if (node.dataset && node.dataset.omitFromCapture === "true") return false;
          return true;
        },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      link.click();
    } catch (err) {
      console.error("Failed to save report image", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleSave}
      className="gap-2"
      aria-label="Save report as PNG"
      disabled={isSaving}
      data-omit-from-capture="true"
    >
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Save
    </Button>
  );
}


