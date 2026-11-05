import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconChip } from "./IconChip";

/**
 * Motivasiya zolağı (maddə 20). Açıq brend fonunda başlıq + mətn,
 * istəyə görə dekorativ şəkil (sağda) və ya ikon çipi.
 */
export function MotivationStrip({
  title,
  text,
  icon,
  image,
  action,
  className,
}: {
  title: ReactNode;
  text?: ReactNode;
  icon?: LucideIcon;
  image?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative isolate flex min-h-28 items-center gap-4 overflow-hidden rounded-xl border border-border bg-brand-25 p-5 sm:p-7 dark:bg-card",
        className,
      )}
    >
      {image && (
        <img
          src={image}
          alt=""
          loading="lazy"
          className="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-full object-cover object-right opacity-90 [mask-image:linear-gradient(to_right,transparent_15%,black_60%)] dark:opacity-40"
        />
      )}
      {icon && <IconChip icon={icon} />}
      <div className="min-w-0 max-w-[34rem]">
        <p className="font-display text-xl font-semibold leading-snug text-foreground">{title}</p>
        {text && <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </section>
  );
}
