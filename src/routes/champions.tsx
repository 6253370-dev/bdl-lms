import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/champions")({
  component: () => (
    <ProtectedRoute>
      <div className="p-6 lg:p-10 max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-2">Champions</h1>
        <p className="text-muted-foreground mb-8">Top 5 performers per course.</p>
        <Card className="p-12 text-center border-dashed">
          <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Coming in next iteration</h3>
          <p className="text-sm text-muted-foreground mt-1">Course leaderboards will appear here once exam results exist.</p>
        </Card>
      </div>
    </ProtectedRoute>
  ),
});
