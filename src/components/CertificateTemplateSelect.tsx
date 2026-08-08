import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Settings2 } from "lucide-react";

export interface CertTemplate {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
}

const NONE = "__none__";

export function CertificateTemplateSelect({
  value,
  onChange,
  disabled,
  showManageLink = true,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  showManageLink?: boolean;
}) {
  const [items, setItems] = useState<CertTemplate[]>([]);

  useEffect(() => {
    supabase
      .from("certificate_templates")
      .select("id,name,file_url,file_type")
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as CertTemplate[]));
  }, []);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" /> Sertifikat şablonu
      </Label>
      <Select
        value={value ?? NONE}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Şablon seç" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Standart dizayn (şablonsuz)</SelectItem>
          {items.map((tpl) => (
            <SelectItem key={tpl.id} value={tpl.file_url}>
              {tpl.name} · {tpl.file_type.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showManageLink && (
        <Button asChild variant="ghost" size="sm" className="px-0">
          <Link to="/certificates">
            <Settings2 className="h-3.5 w-3.5" /> Şablonları idarə et
          </Link>
        </Button>
      )}
    </div>
  );
}
