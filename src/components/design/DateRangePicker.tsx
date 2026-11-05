import { useEffect, useState } from "react";
import { az } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { dateToIso, isoToDate, rangeLabel, type DateRangeValue } from "@/lib/design";

export type { DateRangeValue };

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/**
 * Tarix aralığı seçicisi (maddə 18).
 * Dəyər köhnə `<input type="date">` ilə eyni formatdadır: "YYYY-MM-DD" sətirləri (boş = filtr yoxdur).
 * Beləliklə səhifədəki filtr məntiqi və sərhəd günləri dəyişmir.
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Tarix aralığı",
  id,
  className,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const narrow = useIsNarrow();
  const selected: DateRange | undefined =
    value.from || value.to ? { from: isoToDate(value.from), to: isoToDate(value.to) } : undefined;
  const hasValue = Boolean(value.from || value.to);

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-card pl-3.5 text-left text-sm shadow-xs",
              "focus-visible:outline-none focus-visible:border-brand-500 focus-visible:shadow-[var(--focus-ring)]",
              hasValue ? "pr-10" : "pr-3.5",
            )}
            aria-label={hasValue ? `Tarix aralığı: ${rangeLabel(value)}` : placeholder}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={cn("truncate tabular-nums", !hasValue && "text-[var(--gray-500)]")}>
              {rangeLabel(value, placeholder)}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            locale={az}
            weekStartsOn={1}
            numberOfMonths={narrow ? 1 : 2}
            defaultMonth={selected?.from ?? selected?.to}
            selected={selected}
            onSelect={(r) => {
              onChange({ from: dateToIso(r?.from), to: dateToIso(r?.to) });
            }}
          />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange({ from: "", to: "" })}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          aria-label="Tarixi təmizlə"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
