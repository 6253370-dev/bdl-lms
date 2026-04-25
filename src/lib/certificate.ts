import { jsPDF } from "jspdf";

export interface CertificateData {
  fullName: string;
  courseTitle: string;
  scorePercent: number;
  serial: string;
  issuedAt: string | Date;
}

export function buildCertificatePdf(data: CertificateData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Background
  doc.setFillColor(252, 250, 245);
  doc.rect(0, 0, W, H, "F");

  // Outer border
  doc.setDrawColor(20, 40, 65);
  doc.setLineWidth(3);
  doc.rect(24, 24, W - 48, H - 48);
  doc.setLineWidth(0.6);
  doc.rect(36, 36, W - 72, H - 72);

  // Top accent
  doc.setFillColor(20, 40, 65);
  doc.rect(36, 36, W - 72, 8, "F");

  // Brand
  doc.setTextColor(20, 40, 65);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BE ACADEMY", W / 2, 90, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text("Daxili Təlim Platforması", W / 2, 108, { align: "center" });

  // Heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(20, 40, 65);
  doc.text("TƏLİM SERTİFİKATI", W / 2, 170, { align: "center" });

  // Decorative line
  doc.setDrawColor(20, 40, 65);
  doc.setLineWidth(1);
  doc.line(W / 2 - 80, 184, W / 2 + 80, 184);

  // Presented to
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text("Bu sertifikat təqdim olunur", W / 2, 222, { align: "center" });

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(20, 40, 65);
  doc.text(data.fullName, W / 2, 268, { align: "center" });

  // Course
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text("aşağıdakı kursu uğurla tamamladığı üçün:", W / 2, 300, { align: "center" });

  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(20);
  doc.setTextColor(40, 60, 90);
  const titleLines = doc.splitTextToSize(data.courseTitle, W - 200);
  doc.text(titleLines, W / 2, 336, { align: "center" });

  // Score
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 40, 65);
  doc.text(`Nəticə: ${data.scorePercent}%`, W / 2, 384, { align: "center" });

  // Footer (date + signature + serial)
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

  // Serial
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(`Seriya: ${data.serial}`, W / 2, H - 50, { align: "center" });

  return doc;
}

export function downloadCertificate(data: CertificateData) {
  const doc = buildCertificatePdf(data);
  const safe = data.fullName.replace(/[^\p{L}\p{N}\- ]/gu, "").trim().replace(/\s+/g, "_");
  doc.save(`Sertifikat_${safe}_${data.serial}.pdf`);
}
