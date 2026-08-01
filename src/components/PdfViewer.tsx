import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

/**
 * Renders a PDF to <canvas> pages via pdf.js.
 * Avoids iframe/blob URLs which Chrome can block ("This page has been blocked by Chrome").
 */
export function PdfViewer({ url, className }: { url: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
        if (cancelled) return;
        const host = containerRef.current;
        if (!host) return;
        host.innerHTML = "";
        const width = Math.min(host.clientWidth || 800, 1100);
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * (window.devicePixelRatio || 1);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.className = "rounded-md border bg-white mb-3 shadow-sm";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          host.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "PDF yüklənmədi");
          setLoading(false);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className={className}>
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="text-center py-10 text-sm text-destructive">PDF açılmadı: {error}</div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
