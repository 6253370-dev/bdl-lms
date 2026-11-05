import { useRef, useState } from "react";
import { uploadCourseMedia } from "@/lib/course-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  label: string;
  icon: LucideIcon;
  value: string | null;
  onChange: (url: string | null) => void;
  accept: string;
  folder: string; // e.g. "videos", "pdfs"
  disabled?: boolean;
}

export function FileUpload({
  label,
  icon: Icon,
  value,
  onChange,
  accept,
  folder,
  disabled,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    const url = await uploadCourseMedia(file, folder);
    setUploading(false);
    if (!url) return;
    onChange(url);
    toast.success(`${label} yükləndi`);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      {value ? (
        <div className="flex items-center gap-2">
          <Input value={value} readOnly className="text-xs font-mono" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label={`${label}: faylı sil`}
            title="Faylı sil"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <input
            ref={ref}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={uploading || disabled}
            onClick={() => ref.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {uploading ? "Yüklənir…" : `${label} yüklə`}
          </Button>
        </>
      )}
    </div>
  );
}
