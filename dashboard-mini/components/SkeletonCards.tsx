import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SkeletonCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-6 w-12 bg-muted animate-pulse rounded" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 