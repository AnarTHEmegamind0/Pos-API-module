// src/helpers/barcode.ts

/**
 * Barcode төрөл тодорхойлох
 *
 * @param barcode - Barcode string
 * @returns "GS1" | "ISBN" | "UNDEFINED"
 *
 * GS1 (EAN/UPC):
 *   - EAN-8: 8 оронтой
 *   - UPC-A: 12 оронтой
 *   - EAN-13: 13 оронтой (978, 979-ээр эхлээгүй)
 *   - GTIN-14: 14 оронтой
 *
 * ISBN:
 *   - ISBN-10: 10 оронтой
 *   - ISBN-13: 13 оронтой, 978 эсвэл 979-ээр эхэлсэн
 */
export function detectBarcodeType(
  barcode: string | null | undefined,
): "GS1" | "ISBN" | "UNDEFINED" {
  if (!barcode || typeof barcode !== "string") {
    return "UNDEFINED";
  }

  // Зөвхөн тоо авах (зай, - тэмдэгт хасах)
  const cleaned = barcode.replace(/[\s-]/g, "");

  // Тоо биш тэмдэгт байвал UNDEFINED
  if (!/^\d+$/.test(cleaned)) {
    return "UNDEFINED";
  }

  const len = cleaned.length;

  // ISBN-13: 978 эсвэл 979-ээр эхэлсэн 13 оронтой
  if (len === 13 && (cleaned.startsWith("978") || cleaned.startsWith("979"))) {
    return "ISBN";
  }

  // ISBN-10: 10 оронтой
  if (len === 10) {
    return "ISBN";
  }

  // GS1 (EAN/UPC): 8, 12, 13, 14 оронтой
  if (len === 8 || len === 12 || len === 13 || len === 14) {
    return "GS1";
  }

  return "UNDEFINED";
}
