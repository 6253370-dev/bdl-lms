import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Teq daxiletməsi (maddə 27, "Nələr öyrənəcəksiniz"): yaz + Enter və ya "Əlavə et" → çip,
 * × ilə silinir. Dəyər adi `string[]`-dir; təkrarlanan və boş bəndlər əlavə olunmur.
 */
export function TagInput({
  id,
  label,
  values,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const items = values.filter((v) => v.trim());

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!items.some((x) => x.toLocaleLowerCase("az") === v.toLocaleLowerCase("az"))) {
      onChange([...items, v]);
    }
    setDraft("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {items.map((v, i) => (
            <li
              key={`${v}-${i}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted py-1 pl-3 pr-1 text-sm text-secondary-foreground"
            >
              <span className="min-w-0 break-words">{v}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                  aria-label={`"${v}" bəndini sil`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <Input
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            // Enter basılmadan sahədən çıxılsa, yazılan bənd itməsin.
            onBlur={add}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
          />
          <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
            <Plus className="h-4 w-4" /> Əlavə et
          </Button>
        </div>
      )}
      {!disabled && <p className="text-xs text-muted-foreground">Yazın və Enter basın.</p>}
    </div>
  );
}
