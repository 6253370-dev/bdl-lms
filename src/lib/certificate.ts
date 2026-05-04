import { jsPDF } from "jspdf";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export interface CertificateData {
  fullName: string;
  courseTitle: string;
  scorePercent: number;
  serial: string;
  issuedAt: string | Date;
}

// ---------- Fallback (no template) ----------
export function buildCertificatePdf(data: CertificateData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setFillColor(252, 250, 245);
  doc.rect(0, 0, W, H, "F");
  doc.setDrawColor(20, 40, 65);
  doc.setLineWidth(3);
  doc.rect(24, 24, W - 48, H - 48);
  doc.setLineWidth(0.6);
  doc.rect(36, 36, W - 72, H - 72);
  doc.setFillColor(20, 40, 65);
  doc.rect(36, 36, W - 72, 8, "F");

  doc.setTextColor(20, 40, 65);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BE ACADEMY", W / 2, 90, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text("Daxili Təlim Platforması", W / 2, 108, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(20, 40, 65);
  doc.text("TƏLİM SERTİFİKATI", W / 2, 170, { align: "center" });

  doc.setDrawColor(20, 40, 65);
  doc.setLineWidth(1);
  doc.line(W / 2 - 80, 184, W / 2 + 80, 184);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text("Bu sertifikat təqdim olunur", W / 2, 222, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(20, 40, 65);
  doc.text(data.fullName, W / 2, 268, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text("aşağıdakı kursu uğurla tamamladığı üçün:", W / 2, 300, { align: "center" });

  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(20);
  doc.setTextColor(40, 60, 90);
  const titleLines = doc.splitTextToSize(data.courseTitle, W - 200);
  doc.text(titleLines, W / 2, 336, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 40, 65);
  doc.text(`Nəticə: ${data.scorePercent}%`, W / 2, 384, { align: "center" });

  const dt = new Date(data.issuedAt);
  const dateStr = dt.toLocaleDateString("az-AZ", { year: "numeric", month: "long", day: "numeric" });
  const footerY = H - 90;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.5);
  doc.line(80, footerY, 240, footerY);
  doc.line(W - 240, footerY, W - 80, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text("Tarix", 160, footerY + 14, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(dateStr, 160, footerY + 30, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("İmza", W - 160, footerY + 14, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("BE Academy", W - 160, footerY + 30, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(`Seriya: ${data.serial}`, W / 2, H - 50, { align: "center" });

  return doc;
}

export function downloadCertificate(data: CertificateData) {
  const doc = buildCertificatePdf(data);
  const safe = sanitize(data.fullName);
  doc.save(`Sertifikat_${safe}_${data.serial}.pdf`);
}

function sanitize(s: string) {
  return s.replace(/[^\p{L}\p{N}\- ]/gu, "").trim().replace(/\s+/g, "_");
}

// ---------- Template overlay ----------
let _regularFont: ArrayBuffer | null = null;
let _boldFont: ArrayBuffer | null = null;

async function loadFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
  return await res.arrayBuffer();
}

interface Placeholder {
  token: string;          // e.g. "FULL_NAME"
  x: number; y: number;   // bottom-left in PDF coords
  width: number; height: number;
  fontSize: number;
}

const TOKEN_PATTERN = /\{\{\s*(FULL_NAME|COURSE_TITLE|SCORE|ISSUE_DATE|SERIAL)\s*\}\}/g;

function configurePdfWorker(pdfjs: any) {
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
}

async function findPlaceholders(pdfBytes: ArrayBuffer): Promise<{ placeholders: Placeholder[]; pageHeight: number; pageWidth: number; }> {
  // Use pdfjs-dist legacy build for broad compatibility
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  configurePdfWorker(pdfjs);
  const loadingTask = pdfjs.getDocument({ data: pdfBytes.slice(0), isEvalSupported: false });
  const doc = await loadingTask.promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  // Build a flat string with item index map so we can locate {{TOKEN}} that may span items.
  type Item = { str: string; transform: number[]; width: number; height: number };
  const items: Item[] = content.items as any;

  let combined = "";
  const itemRanges: { start: number; end: number; idx: number }[] = [];
  items.forEach((it, idx) => {
    const start = combined.length;
    combined += it.str;
    itemRanges.push({ start, end: combined.length, idx });
  });

  const placeholders: Placeholder[] = [];
  const re = new RegExp(TOKEN_PATTERN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(combined)) !== null) {
    const token = m[1];
    const matchStart = m.index;
    const matchEnd = m.index + m[0].length;
    // Find items overlapping the match
    const overlapping = itemRanges.filter(r => r.start < matchEnd && r.end > matchStart);
    if (overlapping.length === 0) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let avgFont = 0; let count = 0;
    for (const r of overlapping) {
      const it = items[r.idx];
      const tr = it.transform; // [a,b,c,d,e,f]; for typical: a=fontSize, e=x, f=y (baseline)
      const x = tr[4];
      const y = tr[5];
      const fontSize = Math.hypot(tr[0], tr[1]);
      const w = it.width;
      const h = it.height || fontSize;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + w);
      // baseline y; estimate top/bottom around it
      minY = Math.min(minY, y - h * 0.25);
      maxY = Math.max(maxY, y + h);
      avgFont += fontSize;
      count++;
    }
    placeholders.push({
      token,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      fontSize: avgFont / Math.max(count, 1),
    });
  }
  return { placeholders, pageHeight: viewport.height, pageWidth: viewport.width };
}

export async function buildCertificateFromTemplate(
  templateUrl: string,
  data: CertificateData,
): Promise<Uint8Array> {
  const [tplBytes, regular, bold] = await Promise.all([
    fetch(templateUrl).then((r) => {
      if (!r.ok) throw new Error("Şablon yüklənə bilmədi");
      return r.arrayBuffer();
    }),
    _regularFont ?? loadFont("/fonts/NotoSans-Regular.ttf").then((b) => (_regularFont = b)),
    _boldFont ?? loadFont("/fonts/NotoSans-Bold.ttf").then((b) => (_boldFont = b)),
  ]);

  const dt = new Date(data.issuedAt);
  const dateStr = dt.toLocaleDateString("az-AZ", { year: "numeric", month: "long", day: "numeric" });

  const valueMap: Record<string, { value: string; bold?: boolean }> = {
    FULL_NAME: { value: data.fullName, bold: true },
    COURSE_TITLE: { value: data.courseTitle, bold: true },
    SCORE: { value: String(Math.round(data.scorePercent)), bold: true },
    ISSUE_DATE: { value: dateStr },
    SERIAL: { value: data.serial },
  };

  const pdf = await PDFDocument.load(tplBytes);
  pdf.registerFontkit(fontkit);
  const fontReg = await pdf.embedFont(regular, { subset: true });
  const fontBold = await pdf.embedFont(bold, { subset: true });

  // Try to find {{TOKEN}} placeholders in template.
  let placeholders: Placeholder[] = [];
  try {
    const found = await findPlaceholders(tplBytes);
    placeholders = found.placeholders;
  } catch (e) {
    // pdfjs failed — fall back to legacy positional overlay
  }

  const page = pdf.getPage(0);
  const { width: W, height: H } = page.getSize();

  if (placeholders.length > 0) {
    // For each placeholder: cover with white rect, then draw replacement centered.
    for (const ph of placeholders) {
      const v = valueMap[ph.token];
      if (!v) continue;
      // pdfjs y is from top in viewport coords; convert to pdf-lib (origin bottom-left).
      // Actually item transform[5] from pdfjs is in PDF user-space (already bottom-up).
      // But viewport.height is page height. We used transform directly, which IS bottom-up.
      const padX = ph.fontSize * 0.4;
      const padY = ph.fontSize * 0.25;
      const rectX = ph.x - padX;
      const rectY = ph.y - padY;
      const rectW = ph.width + padX * 2;
      const rectH = ph.height + padY * 2;
      page.drawRectangle({
        x: rectX,
        y: rectY,
        width: rectW,
        height: rectH,
        color: rgb(1, 1, 1),
      });

      const font = v.bold ? fontBold : fontReg;
      // Fit text within rectW
      let size = ph.fontSize;
      let textW = font.widthOfTextAtSize(v.value, size);
      if (textW > rectW) {
        size = size * (rectW / textW);
        textW = font.widthOfTextAtSize(v.value, size);
      }
      const cx = rectX + rectW / 2 - textW / 2;
      const cy = rectY + (rectH - size) / 2 + size * 0.18;
      page.drawText(v.value, { x: cx, y: cy, size, font, color: rgb(0.08, 0.16, 0.26) });
    }
  } else {
    // Legacy fallback (no placeholders detected)
    const drawCenter = (text: string, y: number, size: number, b = false) => {
      const f = b ? fontBold : fontReg;
      const w = f.widthOfTextAtSize(text, size);
      page.drawText(text, { x: (W - w) / 2, y, size, font: f, color: rgb(0.08, 0.16, 0.26) });
    };
    drawCenter(data.fullName, H * 0.55, Math.min(38, W * 0.05), true);
    drawCenter(data.courseTitle, H * 0.40, Math.min(22, W * 0.028), true);
    drawCenter(`Nəticə: ${Math.round(data.scorePercent)}%`, H * 0.30, 14, true);
    drawCenter(dateStr, H * 0.12, 12);
    drawCenter(`Seriya: ${data.serial}`, H * 0.06, 9);
  }

  return await pdf.save();
}

export async function downloadCertificateSmart(data: CertificateData, templateUrl?: string | null) {
  const safe = sanitize(data.fullName);
  const fileName = `Sertifikat_${safe}_${data.serial}.pdf`;
  if (templateUrl && /\.pdf($|\?)/i.test(templateUrl)) {
    const bytes = await buildCertificateFromTemplate(templateUrl, data);
    triggerDownload(bytes, fileName);
    return;
  }
  downloadCertificate(data);
}

export async function previewCertificateSmart(data: CertificateData, templateUrl?: string | null): Promise<string> {
  if (templateUrl && /\.pdf($|\?)/i.test(templateUrl)) {
    const bytes = await buildCertificateFromTemplate(templateUrl, data);
    return await renderPdfToImageDataUrl(bytes);
  }
  const blob = buildCertificatePdf(data).output("blob");
  const ab = await blob.arrayBuffer();
  return await renderPdfToImageDataUrl(new Uint8Array(ab));
}

async function renderPdfToImageDataUrl(bytes: Uint8Array): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = "";
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) as any, useWorker: false, isEvalSupported: false }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/png");
}

function triggerDownload(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
