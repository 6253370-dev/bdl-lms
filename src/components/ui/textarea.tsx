import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-base shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--gray-500)] focus-visible:outline-none focus-visible:border-brand-500 focus-visible:shadow-[0_0_0_4px_rgba(41,112,255,0.24)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
