import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Səhifə başlığı: hər bölmədə eyni ölçü, eyni boşluq, eyni düymə düzülüşü.
 * Masaüstündə başlıq solda, əməliyyatlar sağda (alt xəttə hizalı);
 * mobildə əməliyyatlar başlığın altına keçir.
 * Əməliyyat düymələri standart ölçüdə (`size` verilmədən) yazılmalıdır.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight md:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground md:text-base">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
