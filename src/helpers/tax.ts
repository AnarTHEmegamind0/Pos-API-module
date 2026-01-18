// src/helpers/tax.ts

/**
 * Татварын тооцооллын үр дүн
 */
export interface TaxResult {
  baseAmount: number; // Цэвэр үнэ (татваргүй)
  vat: number; // НӨАТ
  cityTax: number; // НХАТ
  unitPrice: number; // Нэгж үнэ (татвартай)
  totalAmount: number; // Нийт дүн (татвартай)
}

/**
 * 2 орон хүртэл бөөрөнхийлөх
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Item-ийн татвар тооцоолох
 *
 * Тооцооллын логик:
 *   - VAT_ABLE + isNhat=true:  totalAmount = 112% (100% + 10% VAT + 2% НХАТ)
 *   - VAT_ABLE + isNhat=false: totalAmount = 110% (100% + 10% VAT)
 *   - !VAT_ABLE + isNhat=true: totalAmount = 102% (100% + 2% НХАТ)
 *   - !VAT_ABLE + isNhat=false: totalAmount = 100% (татваргүй)
 *
 * @param totalAmount - Татвартай нийт үнэ (qty * unitPrice)
 * @param qty - Тоо ширхэг
 * @param taxType - VAT төрөл (VAT_ABLE, VAT_FREE, VAT_ZERO, NO_VAT)
 * @param isNhat - НХАТ эсэх
 */
export function calculateItemTax(
  totalAmount: number,
  qty: number,
  taxType: string,
  isNhat: boolean,
): TaxResult {
  const isVatAble = taxType === "VAT_ABLE";

  // Хуваагч тодорхойлох
  let divisor = 1;
  if (isVatAble && isNhat) {
    divisor = 1.12; // 100% + 10% + 2%
  } else if (isVatAble && !isNhat) {
    divisor = 1.1; // 100% + 10%
  } else if (!isVatAble && isNhat) {
    divisor = 1.02; // 100% + 2%
  }
  // else divisor = 1 (татваргүй)

  const baseAmount = round2(totalAmount / divisor);
  const vat = isVatAble ? round2(baseAmount * 0.1) : 0;
  const cityTax = isNhat ? round2(baseAmount * 0.02) : 0;
  const unitPrice = qty > 0 ? round2(totalAmount / qty) : 0;

  return {
    baseAmount,
    vat,
    cityTax,
    unitPrice,
    totalAmount,
  };
}

/**
 * Татварын хувь хэмжээг авах (debug зорилгоор)
 */
export function getTaxRates(
  taxType: string,
  isNhat: boolean,
): { vatRate: number; cityTaxRate: number; divisor: number } {
  const isVatAble = taxType === "VAT_ABLE";

  let divisor = 1;
  if (isVatAble && isNhat) {
    divisor = 1.12;
  } else if (isVatAble && !isNhat) {
    divisor = 1.1;
  } else if (!isVatAble && isNhat) {
    divisor = 1.02;
  }

  return {
    vatRate: isVatAble ? 0.1 : 0,
    cityTaxRate: isNhat ? 0.02 : 0,
    divisor,
  };
}
