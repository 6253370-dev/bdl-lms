import { cn } from "@/lib/utils";
import { initials } from "@/lib/design";

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;
type Size = keyof typeof SIZES;

/** Avatar: şəkil və ya baş hərflər, istəyə görə onlayn nöqtəsi (maddə 9). */
export function UserAvatar({
  name,
  src,
  size = "md",
  online,
  className,
}: {
  name?: string | null;
  src?: string | null;
  size?: Size;
  online?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-full border border-border bg-brand-50 font-semibold text-brand-700 dark:bg-brand-600/20 dark:text-brand-200",
          SIZES[size],
        )}
      >
        {src ? (
          <img
            src={src}
            alt={name ? `${name} — profil şəkli` : "Profil şəkli"}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{initials(name)}</span>
        )}
        {!src && name && <span className="sr-only">{name}</span>}
      </span>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-card",
            online ? "bg-[var(--success-500)]" : "bg-[var(--gray-300)]",
          )}
          aria-label={online ? "Onlayn" : "Oflayn"}
          role="img"
        />
      )}
    </span>
  );
}

/** Avatar yığını: ilk `max` nəfər, qalanı "+N" (maddə 9). */
export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: { id: string; name?: string | null; src?: string | null }[];
  max?: number;
  size?: Size;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {shown.map((p) => (
        <UserAvatar
          key={p.id}
          name={p.name}
          src={p.src}
          size={size}
          className="rounded-full ring-2 ring-card"
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "relative inline-flex items-center justify-center rounded-full border border-border bg-muted font-semibold text-muted-foreground ring-2 ring-card",
            SIZES[size],
          )}
          aria-label={`daha ${rest} nəfər`}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
