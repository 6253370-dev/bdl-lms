import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number; // 0-5, may be fractional in display mode
  onChange?: (v: number) => void; // if provided, interactive
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-7 w-7" };

export function StarRating({ value, onChange, size = "md", className }: StarRatingProps) {
  const interactive = !!onChange;
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        const half = !filled && value >= i - 0.75;
        const star = (
          <span className="relative inline-block">
            <Star className={cn(sizes[size], "text-muted-foreground/40")} />
            {(filled || half) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: filled ? "100%" : "50%" }}
              >
                <Star className={cn(sizes[size], "fill-warning text-warning")} />
              </span>
            )}
          </span>
        );
        return interactive ? (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className="p-0.5 hover:scale-110 transition-transform"
            aria-label={`${i} ulduz`}
          >
            {star}
          </button>
        ) : (
          <span key={i}>{star}</span>
        );
      })}
    </div>
  );
}
