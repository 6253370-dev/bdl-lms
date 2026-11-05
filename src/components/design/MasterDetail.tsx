import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Master-detal düzülüşü (maddə 16): solda siyahı, sağda detal paneli.
 * `aside` verilərsə 3 sütunlu variant (xl ekranda).
 * Mobil/planşetdə (lg-dən kiçik) detal açıqdırsa yalnız detal göstərilir, "Geri" düyməsi ilə siyahıya qayıdılır.
 */
export function MasterDetail({
  list,
  detail,
  aside,
  detailOpen,
  onBack,
  backLabel = "Siyahıya qayıt",
  className,
}: {
  list: ReactNode;
  detail: ReactNode;
  aside?: ReactNode;
  detailOpen: boolean;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]",
        aside && "xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.8fr)]",
        className,
      )}
    >
      <div className={cn("min-w-0", detailOpen && "hidden lg:block")}>{list}</div>
      <div className={cn("min-w-0", !detailOpen && "hidden lg:block")}>
        {detailOpen && onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 lg:hidden">
            <ArrowLeft /> {backLabel}
          </Button>
        )}
        {detail}
      </div>
      {aside && (
        <div
          className={cn("min-w-0 lg:col-span-2 xl:col-span-1", !detailOpen && "hidden lg:block")}
        >
          {aside}
        </div>
      )}
    </div>
  );
}

/** Master-detal panel çərçivəsi: kart, başlıq və sürüşən gövdə. */
export function DetailPanel({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border bg-card shadow-card lg:sticky lg:top-24",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 font-display font-semibold">{title}</div>
          {actions}
        </header>
      )}
      <div className="min-w-0 p-5">{children}</div>
    </section>
  );
}
