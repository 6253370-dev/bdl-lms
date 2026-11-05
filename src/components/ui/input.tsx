import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-base shadow-xs transition-[border-color,box-shadow] duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--gray-500)] focus-visible:outline-none focus-visible:border-brand-500 focus-visible:shadow-[0_0_0_4px_rgba(41,112,255,0.24)] aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_0_0_4px_rgba(240,68,56,0.24)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
