// src/helpers/barcode.ts

/**
 * GS1 Check Digit тооцоолох (EAN-8, EAN-13, UPC-A, GTIN-14)
 *
 * Алгоритм:
 * 1. Баруунаас зүүн тийш орнуудыг дугаарлах (1-ээс эхлэн)
 * 2. Сондгой байрлалтай орнуудыг 3-аар үржүүлэх
 * 3. Тэгш байрлалтай орнуудыг 1-ээр үржүүлэх
 * 4. Бүгдийг нэмээд 10-д хуваах үлдэгдэл
 * 5. Check digit = (10 - үлдэгдэл) % 10
 *
 * @param digits - Check digit-гүй баркод (эхний n-1 орон)
 * @returns Тооцоолсон check digit
 */
function calculateGS1CheckDigit(digits: string): number {
  let sum = 0;
  const len = digits.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(digits[i], 10);
    // Баруунаас зүүн тийш: сондгой байрлал = 3, тэгш байрлал = 1
    const position = len - i;
    const multiplier = position % 2 === 1 ? 3 : 1;
    sum += digit * multiplier;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * GS1 баркод хүчинтэй эсэхийг check digit-ээр шалгах
 *
 * @param barcode - Бүтэн баркод (check digit-тэй)
 * @returns true бол хүчинтэй GS1 баркод
 */
function isValidGS1Barcode(barcode: string): boolean {
  const len = barcode.length;

  // GS1 урт: 8, 12, 13, 14
  if (len !== 8 && len !== 12 && len !== 13 && len !== 14) {
    return false;
  }

  // Зөвхөн тоо эсэхийг шалгах
  if (!/^\d+$/.test(barcode)) {
    return false;
  }

  // Check digit тооцоолох
  const digitsWithoutCheck = barcode.slice(0, -1);
  const providedCheckDigit = parseInt(barcode.slice(-1), 10);
  const calculatedCheckDigit = calculateGS1CheckDigit(digitsWithoutCheck);

  return providedCheckDigit === calculatedCheckDigit;
}

/**
 * ISBN-10 Check Digit шалгах
 *
 * Алгоритм:
 * 1. Эхний 9 орныг 10, 9, 8, ..., 2-оор үржүүлж нэмэх
 * 2. Сүүлийн орон (check digit) нь X=10 эсвэл 0-9
 * 3. Нийлбэр 11-д хуваагдах ёстой
 *
 * @param barcode - 10 оронтой ISBN
 * @returns true бол хүчинтэй ISBN-10
 */
function isValidISBN10(barcode: string): boolean {
  if (barcode.length !== 10) {
    return false;
  }

  // Сүүлийн орон X байж болно
  const checkChar = barcode[9].toUpperCase();
  if (!/^\d$/.test(barcode.slice(0, 9))) {
    return false;
  }
  if (!/^[\dX]$/.test(checkChar)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(barcode[i], 10) * (10 - i);
  }

  const checkValue = checkChar === "X" ? 10 : parseInt(checkChar, 10);
  sum += checkValue;

  return sum % 11 === 0;
}

/**
 * ISBN-13 Check Digit шалгах (GS1 алгоритмтай ижил)
 *
 * @param barcode - 13 оронтой ISBN (978 эсвэл 979-ээр эхэлсэн)
 * @returns true бол хүчинтэй ISBN-13
 */
function isValidISBN13(barcode: string): boolean {
  if (barcode.length !== 13) {
    return false;
  }
  if (!barcode.startsWith("978") && !barcode.startsWith("979")) {
    return false;
  }

  // ISBN-13 нь GS1-13 алгоритмтай ижил
  return isValidGS1Barcode(barcode);
}

/**
 * Barcode төрөл тодорхойлох
 *
 * Ямар ч баркод ирсэн 3 төрлийн аль нэгд нь заавал хуваагдана:
 * - GS1: Стандарт EAN/UPC баркодууд (check digit зөв)
 * - ISBN: Номын баркодууд (check digit зөв)
 * - UNDEFINED: Бусад бүх баркодууд (check digit буруу эсвэл стандарт бус)
 *
 * @param barcode - Barcode string
 * @returns "GS1" | "ISBN" | "UNDEFINED"
 *
 * GS1 (EAN/UPC) - Дараах нөхцлийг хангасан + check digit зөв:
 *   - EAN-8: Яг 8 оронтой тоо
 *   - UPC-A: Яг 12 оронтой тоо
 *   - EAN-13: Яг 13 оронтой тоо (978, 979-ээр эхлээгүй)
 *   - GTIN-14: Яг 14 оронтой тоо
 *
 * ISBN - Дараах нөхцлийг хангасан + check digit зөв:
 *   - ISBN-10: Яг 10 оронтой
 *   - ISBN-13: Яг 13 оронтой, 978 эсвэл 979-ээр эхэлсэн
 *
 * UNDEFINED - Дээрх нөхцлийг хангаагүй бүх баркодууд:
 *   - Хоосон эсвэл null
 *   - Тоо биш тэмдэгт агуулсан
 *   - Урт нь стандарт биш
 *   - Check digit буруу
 */
export function detectBarcodeType(
  barcode: string | null | undefined,
): "GS1" | "ISBN" | "UNDEFINED" {
  // Хоосон эсвэл null байвал UNDEFINED
  if (!barcode || typeof barcode !== "string") {
    return "UNDEFINED";
  }

  // Зай, - тэмдэгт хасах
  const cleaned = barcode.replace(/[\s-]/g, "").trim();

  // Хоосон string байвал UNDEFINED
  if (cleaned.length === 0) {
    return "UNDEFINED";
  }

  const len = cleaned.length;

  // ISBN-13: 978 эсвэл 979-ээр эхэлсэн 13 оронтой
  if (len === 13 && (cleaned.startsWith("978") || cleaned.startsWith("979"))) {
    // Check digit шалгах
    if (isValidISBN13(cleaned)) {
      return "ISBN";
    }
    // Check digit буруу бол UNDEFINED
    return "UNDEFINED";
  }

  // ISBN-10: 10 оронтой (сүүлийн орон X байж болно)
  if (len === 10) {
    if (isValidISBN10(cleaned)) {
      return "ISBN";
    }
    return "UNDEFINED";
  }

  // GS1 (EAN/UPC): 8, 12, 13, 14 оронтой
  if (len === 8 || len === 12 || len === 13 || len === 14) {
    // Check digit шалгах
    if (isValidGS1Barcode(cleaned)) {
      return "GS1";
    }
    // Check digit буруу бол UNDEFINED
    return "UNDEFINED";
  }

  // Бусад бүх тохиолдолд UNDEFINED
  return "UNDEFINED";
}

/**
 * Баркодыг стандартчилах (цэвэрлэх)
 *
 * @param barcode - Оригинал баркод
 * @returns Цэвэрлэсэн баркод (зай, - хассан)
 */
export function normalizeBarcode(barcode: string | null | undefined): string {
  if (!barcode || typeof barcode !== "string") {
    return "";
  }
  return barcode.replace(/[\s-]/g, "").trim();
}

/**
 * Баркод хүчинтэй эсэхийг шалгах
 *
 * @param barcode - Баркод
 * @returns true бол GS1 эсвэл ISBN, false бол UNDEFINED
 */
export function isValidStandardBarcode(
  barcode: string | null | undefined,
): boolean {
  const type = detectBarcodeType(barcode);
  return type === "GS1" || type === "ISBN";
}

/**
 * Баркод мэдээлэл бүрэн авах
 *
 * @param barcode - Баркод
 * @returns Баркодын төрөл, цэвэрлэсэн утга, урт
 */
export function getBarcodeInfo(barcode: string | null | undefined): {
  original: string;
  normalized: string;
  type: "GS1" | "ISBN" | "UNDEFINED";
  length: number;
  isValid: boolean;
} {
  const normalized = normalizeBarcode(barcode);
  const type = detectBarcodeType(barcode);

  return {
    original: barcode || "",
    normalized,
    type,
    length: normalized.length,
    isValid: type !== "UNDEFINED",
  };
}
