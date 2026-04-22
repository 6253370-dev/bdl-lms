import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export const Route = createFileRoute("/quiz")({
  component: () => (
    <ProtectedRoute>
      <div className="p-6 lg:p-10 max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-2">Quizzes</h1>
        <p className="text-muted-foreground mb-8">Standalone quizzes with timed questions.</p>
        <Card className="p-12 text-center border-dashed">
          <FileQuestion className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Coming in next iteration</h3>
          <p className="text-sm text-muted-foreground mt-1">Quiz player and admin builder will appear here.</p>
        </Card>
      </div>
    </ProtectedRoute>
  ),
});
