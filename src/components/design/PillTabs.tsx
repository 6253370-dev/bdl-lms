import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/** Pill tab siyahısı (maddə 7). Mövcud `<Tabs>` içində `TabsList` əvəzinə işlənir. */
export const PillTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex flex-wrap items-center gap-2", className)}
    {...props}
  />
));
PillTabsList.displayName = "PillTabsList";

export const PillTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { count?: number | null }
>(({ className, count, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-semibold text-secondary-foreground",
      "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
      "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
      "data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
      className,
    )}
    {...props}
  >
    {children}
    {count != null && (
      <span className="tabular-nums text-muted-foreground group-data-[state=active]:text-primary-foreground/85">
        ({count.toLocaleString("az-AZ")})
      </span>
    )}
  </TabsPrimitive.Trigger>
));
PillTabsTrigger.displayName = "PillTabsTrigger";

/** Müstəqil pill tablar (filtr kimi): "Hamısı (244)", "Yeni (14)". */
export function PillTabs<T extends string>({
  items,
  value,
  onValueChange,
  ariaLabel,
  className,
}: {
  items: { value: T; label: React.ReactNode; count?: number | null }[];
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      activationMode="automatic"
    >
      <PillTabsList aria-label={ariaLabel} className={className}>
        {items.map((it) => (
          <PillTabsTrigger key={it.value} value={it.value} count={it.count}>
            {it.label}
          </PillTabsTrigger>
        ))}
      </PillTabsList>
    </TabsPrimitive.Root>
  );
}
