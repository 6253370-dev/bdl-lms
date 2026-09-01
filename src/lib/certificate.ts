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
  doc.setFontSize(34);
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
  const dateStr = formatDateDDMMYYYY(dt);
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


  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(`Seriya: ${data.serial}`, W / 2, H - 50, { align: "center" });

  return doc;
}

export function downloadCertificate(data: CertificateData) {
  const doc = buildCertificatePdf(data);
  const safe = sanitize(data.fullName);
  doc.save(`Sertifikat_${safe}.pdf`);
}

function sanitize(s: string) {
  return s.replace(/[^\p{L}\p{N}\- ]/gu, "").trim().replace(/\s+/g, "_");
}

export function formatDateDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
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
const TEMPLATE_BACKGROUND = rgb(0.985, 0.98, 0.955);

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

  let normalized = "";
  const normalizedToOriginal: number[] = [];
  Array.from(combined).forEach((ch, originalIndex) => {
    if (/\s/.test(ch)) return;
    normalized += ch;
    normalizedToOriginal.push(originalIndex);
  });

  const placeholders: Placeholder[] = [];
  const re = new RegExp(TOKEN_PATTERN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const token = m[1];
    const matchStart = normalizedToOriginal[m.index] ?? m.index;
    const matchEnd = (normalizedToOriginal[m.index + m[0].length - 1] ?? (m.index + m[0].length - 1)) + 1;
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
  const dateStr = formatDateDDMMYYYY(dt);

  const valueMap: Record<string, { value: string; bold?: boolean }> = {
    FULL_NAME: { value: data.fullName, bold: true },
    COURSE_TITLE: { value: data.courseTitle, bold: true },
    SCORE: { value: String(Math.round(data.scorePercent)), bold: true },
    ISSUE_DATE: { value: dateStr },
    SERIAL: { value: data.serial },
  };

  // Image templates (PNG/JPG) — place image as full page background.
  const head = new Uint8Array(tplBytes.slice(0, 4));
  const isPng = head[0] === 0x89 && head[1] === 0x50;
  const isJpg = head[0] === 0xff && head[1] === 0xd8;
  if (isPng || isJpg) {
    const imgPdf = await PDFDocument.create();
    imgPdf.registerFontkit(fontkit);
    const fReg = await imgPdf.embedFont(regular, { subset: true });
    const fBold = await imgPdf.embedFont(bold, { subset: true });
    const img = isPng ? await imgPdf.embedPng(tplBytes) : await imgPdf.embedJpg(tplBytes);
    const p = imgPdf.addPage([img.width, img.height]);
    p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    const IW = img.width, IH = img.height;
    const put = (text: string, y: number, size: number, b = false) => {
      const f = b ? fBold : fReg;
      const w = f.widthOfTextAtSize(text, size);
      p.drawText(text, { x: (IW - w) / 2, y, size, font: f, color: rgb(0.08, 0.16, 0.26) });
    };
    put(data.fullName, IH * 0.5, Math.min(38, IW * 0.05), true);
    put(data.courseTitle, IH * 0.38, Math.min(22, IW * 0.028), true);
    put(`Nəticə: ${Math.round(data.scorePercent)}%`, IH * 0.3, 14, true);
    put(dateStr, IH * 0.12, 12);
    put(`Seriya: ${data.serial}`, IH * 0.06, 9);
    return await imgPdf.save();
  }

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
    const grouped = new Map<string, Placeholder[]>();
    placeholders.forEach((ph) => grouped.set(ph.token, [...(grouped.get(ph.token) ?? []), ph]));

    // First cover every placeholder with a generous white rectangle so original template text disappears.
    for (const ph of placeholders) {
      const v = valueMap[ph.token];
      if (!v) continue;
      const padX = Math.max(ph.fontSize * 0.35, 6);
      const padY = Math.max(ph.fontSize * 0.22, 4);
      const rectX = ph.x - padX;
      const rectY = ph.y - padY;
      const rectW = ph.width + padX * 2;
      const rectH = ph.height + padY * 2;
      page.drawRectangle({
        x: rectX,
        y: rectY,
        width: rectW,
        height: rectH,
        color: TEMPLATE_BACKGROUND,
      });
    }

    // Then draw one clean replacement per token, centered on the full placeholder area.
    for (const [token, tokenPlaceholders] of grouped) {
      const v = valueMap[token];
      if (!v) continue;
      const minX = Math.min(...tokenPlaceholders.map((ph) => ph.x - Math.max(ph.fontSize * 0.35, 6)));
      const minY = Math.min(...tokenPlaceholders.map((ph) => ph.y - Math.max(ph.fontSize * 0.22, 4)));
      const maxX = Math.max(...tokenPlaceholders.map((ph) => ph.x + ph.width + Math.max(ph.fontSize * 0.35, 6)));
      const maxY = Math.max(...tokenPlaceholders.map((ph) => ph.y + ph.height + Math.max(ph.fontSize * 0.22, 4)));
      const rectX = minX;
      const rectY = minY;
      const rectW = maxX - minX;
      const rectH = maxY - minY;
      const baseFontSize = tokenPlaceholders.reduce((sum, ph) => sum + ph.fontSize, 0) / tokenPlaceholders.length;

      const font = v.bold ? fontBold : fontReg;
      let size = Math.max(baseFontSize, token === "FULL_NAME" ? 22 : 10);
      let textW = font.widthOfTextAtSize(v.value, size);
      if (textW > rectW) {
        size = Math.max(8, size * (rectW / textW));
        textW = font.widthOfTextAtSize(v.value, size);
      }
      const cx = rectX + rectW / 2 - textW / 2;
      const cy = rectY + (rectH - size) / 2 + size * 0.18;
      page.drawText(v.value, { x: cx, y: cy, size, font, color: rgb(0.08, 0.16, 0.26) });
    }
  } else {
    // Fallback for PDFs whose placeholder text cannot be extracted by pdf.js:
    // clear the expected dynamic bands first, then write clean values.
    const clearBand = (centerY: number, height: number, marginX = W * 0.16) => {
      page.drawRectangle({ x: marginX, y: centerY - height / 2, width: W - marginX * 2, height, color: TEMPLATE_BACKGROUND });
    };
    clearBand(H * 0.55, H * 0.07, W * 0.28);
    clearBand(H * 0.40, H * 0.05, W * 0.25);
    clearBand(H * 0.30, H * 0.035, W * 0.36);
    clearBand(H * 0.12, H * 0.03, W * 0.16);
    clearBand(H * 0.06, H * 0.025, W * 0.34);

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
  const fileName = `Sertifikat_${safe}.pdf`;
  if (templateUrl) {
    try {
      const bytes = await buildCertificateFromTemplate(templateUrl, data);
      triggerDownload(bytes, fileName);
      return;
    } catch (e) {
      console.error("Sertifikat şablonu tətbiq edilmədi:", e);
    }
  }
  downloadCertificate(data);
}

export async function previewCertificateSmart(data: CertificateData, templateUrl?: string | null): Promise<string> {
  if (templateUrl) {
    try {
      const bytes = await buildCertificateFromTemplate(templateUrl, data);
      return await renderPdfToImageDataUrl(bytes);
    } catch (e) {
      console.error("Sertifikat şablonu tətbiq edilmədi:", e);
    }
  }

  const blob = buildCertificatePdf(data).output("blob");
  const ab = await blob.arrayBuffer();
  return await renderPdfToImageDataUrl(new Uint8Array(ab));
}

async function renderPdfToImageDataUrl(bytes: Uint8Array): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  configurePdfWorker(pdfjs);
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) as any, isEvalSupported: false }).promise;
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
