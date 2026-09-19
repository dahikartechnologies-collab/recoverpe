import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function AgentLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
