import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-10">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">Failed to load workflow runs.</p>
        <p className="text-sm text-muted-foreground">
          Please check your GitHub token and repository settings.
        </p>
      </CardContent>
    </Card>
  );
} 