import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Flame, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";

/**
 * Kurs kartı (maddə 68, 74): örtük, istəyə görə "Populyar" nişanı, kateqoriya çipi,
 * müəllim avatarı, reytinq, dərs sayı və şəxsi proqres xətti.
 * Bütün kart kurs səhifəsinə keçid edir; `actions` və `footer` keçidin üstündə qalır (z-20).
 */
export function CourseCard({
  id,
  title,
  cover,
  teacher,
  rating,
  lessons,
  popular,
  category,
  progress,
  badge,
  actions,
  footer,
  emptyRatingText = "Reytinq yoxdur",
  className,
}: {
  id: string;
  title: string;
  cover?: string | null;
  teacher?: string | null;
  rating?: { average: number; count: number } | null;
  lessons?: number;
  popular?: boolean;
  /** Kateqoriya (qovluq) adı. */
  category?: string | null;
  /** Şəxsi keçid faizi (0–100). `undefined` olarsa xətt göstərilmir. */
  progress?: number;
  /** Örtüyün sol yuxarı küncündə nişan (məs. "Layihə"). */
  badge?: ReactNode;
  /** Örtüyün sağ yuxarı küncündə düymələr (məs. admin redaktəsi). */
  actions?: ReactNode;
  /** Kartın altında əlavə interaktiv məzmun. */
  footer?: ReactNode;
  emptyRatingText?: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-card transition-shadow hover:shadow-[var(--elev-lg)] focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <BookOpen className="h-8 w-8" aria-hidden="true" />
          </div>
        )}
        {badge && <div className="absolute left-2.5 top-2.5">{badge}</div>}
        {popular && !actions && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">
            <Flame className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Populyar
          </span>
        )}
        {actions && <div className="absolute right-2.5 top-2.5 z-20 flex gap-1">{actions}</div>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-display text-sm font-semibold leading-snug break-words">
            <Link
              to="/courses/$courseId"
              params={{ courseId: id }}
              className="after:absolute after:inset-0 after:z-10 after:rounded-xl hover:text-primary focus:outline-none"
            >
              {title}
            </Link>
          </h3>
          {category && (
            <span className="max-w-[45%] shrink-0 truncate rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              {category}
            </span>
          )}
        </div>
        {teacher && (
          <p className="mt-3 flex min-w-0 items-center gap-2 text-xs text-secondary-foreground">
            <UserAvatar name={teacher} size="xs" />
            <span className="truncate">{teacher}</span>
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
          {rating && rating.count > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Star
                className="h-3.5 w-3.5 fill-[var(--warning-500)] text-[var(--warning-500)]"
                aria-hidden="true"
              />
              <span className="font-semibold text-foreground tabular-nums">
                {rating.average.toLocaleString("az-AZ", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
              <span className="tabular-nums">({rating.count} rəy)</span>
              <span className="sr-only">reytinq</span>
            </span>
          ) : (
            <span>{emptyRatingText}</span>
          )}
          {lessons !== undefined && <span className="tabular-nums">{lessons} dərs</span>}
        </div>
        {progress !== undefined && (
          <div className="mt-3 flex items-center gap-3">
            <div
              role="progressbar"
              aria-label={`${title}: keçid`}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--gray-200)] dark:bg-[var(--gray-700)]"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <span className="w-9 text-right text-xs font-medium tabular-nums text-secondary-foreground">
              {progress}%
            </span>
          </div>
        )}
        {footer && <div className="relative z-20 mt-3">{footer}</div>}
      </div>
    </article>
  );
}
