import { useState, type ReactNode } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** PDF/Excel ixrac düyməsi (maddə 19). Yalnız düymədir: ixrac funksiyasını səhifə verir. */
export function ExportButton({
  format,
  onExport,
  children,
  variant = "outline",
  disabled,
  className,
}: {
  format: "excel" | "pdf";
  onExport: () => unknown | Promise<unknown>;
  children?: ReactNode;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const Icon = format === "excel" ? FileSpreadsheet : FileText;
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={disabled || busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onExport();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Icon />}
      {children ?? (format === "excel" ? "Excel ixrac" : "PDF ixrac")}
    </Button>
  );
}
