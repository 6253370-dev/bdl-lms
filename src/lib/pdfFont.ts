import type { jsPDF } from "jspdf";

let _regularB64: string | null = null;
let _boldB64: string | null = null;
let _registered = false;

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

async function fetchB64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
  return arrayBufferToBase64(await res.arrayBuffer());
}

/**
 * Loads NotoSans (Regular + Bold) into the jsPDF instance and sets it as
 * the active font. Required to render Azerbaijani characters (ə, ş, ç, ğ,
 * ı, ö, ü) correctly — the default Helvetica font cannot render them.
 */
export async function applyAzerbaijaniFont(doc: jsPDF): Promise<void> {
  if (!_regularB64 || !_boldB64) {
    [_regularB64, _boldB64] = await Promise.all([
      fetchB64("/fonts/NotoSans-Regular.ttf"),
      fetchB64("/fonts/NotoSans-Bold.ttf"),
    ]);
  }
  // jsPDF stores files in a per-document VFS, so register on every doc.
  doc.addFileToVFS("NotoSans-Regular.ttf", _regularB64);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", _boldB64);
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  doc.setFont("NotoSans", "normal");
  _registered = true;
}

export function isAzerbaijaniFontRegistered() {
  return _registered;
}
