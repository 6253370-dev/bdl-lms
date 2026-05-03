import { jsPDF } from "jspdf";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

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

  const pdf = await PDFDocument.load(tplBytes);
  pdf.registerFontkit(fontkit);
  const fontReg = await pdf.embedFont(regular, { subset: true });
  const fontBold = await pdf.embedFont(bold, { subset: true });

  const page = pdf.getPage(0);
  const { width: W, height: H } = page.getSize();

  const dt = new Date(data.issuedAt);
  const dateStr = dt.toLocaleDateString("az-AZ", { year: "numeric", month: "long", day: "numeric" });

  const drawCenter = (text: string, y: number, size: number, bold = false, color = rgb(0.08, 0.16, 0.26)) => {
    const f = bold ? fontBold : fontReg;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (W - w) / 2, y, size, font: f, color });
  };

  // Positions calibrated for landscape A4 templates; scale by height for any size.
  // y is measured from the bottom in pdf-lib.
  const yName = H * 0.55;
  const yCourse = H * 0.40;
  const yScore = H * 0.30;
  const yFooter = H * 0.12;

  drawCenter(data.fullName, yName, Math.min(38, W * 0.05), true);

  // Course title (wrap if long)
  const courseSize = Math.min(22, W * 0.028);
  const maxW = W * 0.75;
  const words = data.courseTitle.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (fontBold.widthOfTextAtSize(test, courseSize) > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((ln, i) => {
    const tw = fontBold.widthOfTextAtSize(ln, courseSize);
    page.drawText(ln, {
      x: (W - tw) / 2,
      y: yCourse - i * (courseSize + 4),
      size: courseSize,
      font: fontBold,
      color: rgb(0.16, 0.24, 0.36),
    });
  });

  drawCenter(`Nəticə: ${data.scorePercent}%`, yScore, 14, true);
  drawCenter(dateStr, yFooter, 12, false, rgb(0.2, 0.2, 0.2));
  drawCenter(`Seriya: ${data.serial}`, H * 0.06, 9, false, rgb(0.4, 0.4, 0.4));

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
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  }
  const blob = buildCertificatePdf(data).output("blob");
  return URL.createObjectURL(blob);
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
