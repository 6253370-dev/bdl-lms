import { useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadCourseMedia } from "@/lib/course-media";
import { cn } from "@/lib/utils";

/**
 * Şəkil yükləmə zonası (maddə 27): önizləmə, sürüklə-burax, "Şəkil dəyişdir" və "Sil".
 * Yükləmə `FileUpload` ilə eyni yerə və eyni qaydalarla gedir (course-media bucket).
 */
export function ImageDropzone({
  label,
  value,
  onChange,
  folder,
  disabled,
  className,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);
  const inputId = `${folder}-image-input`;

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Yalnız şəkil faylı seçin");
      return;
    }
    setUploading(true);
    const url = await uploadCourseMedia(file, folder);
    setUploading(false);
    if (url) {
      onChange(url);
      toast.success(`${label} yükləndi`);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium leading-none" id={`${inputId}-label`}>
        {label}
      </p>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
          {value ? (
            <img src={value} alt={`${label} önizləməsi`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageIcon className="h-7 w-7" aria-hidden="true" />
              <span className="text-xs">Şəkil yoxdur</span>
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={disabled || uploading}
          aria-labelledby={`${inputId}-label`}
          aria-describedby={`${inputId}-hint`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            if (disabled) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60",
            over
              ? "border-primary bg-brand-50 dark:bg-brand-600/15"
              : "border-border hover:border-primary/60 hover:bg-muted",
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <Upload className="h-6 w-6 text-primary" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold">
            {uploading ? "Yüklənir…" : value ? "Şəkil dəyişdir" : "Şəkil yüklə"}
          </span>
          <span id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            Faylı bura sürükləyin və ya klikləyin · JPG, PNG, WebP
          </span>
        </button>
      </div>
      {value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
          className="text-muted-foreground"
        >
          <Trash2 className="h-4 w-4" /> Şəkli sil
        </Button>
      )}
    </div>
  );
}
