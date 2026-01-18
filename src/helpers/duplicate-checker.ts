// src/helpers/duplicate-checker.ts

import { findReceiptByOrderId, findReceiptByOrderIdOnly } from "../db.js";

/**
 * Давхцалт шалгасан үр дүн
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingBill?: {
    orderId: string;
    merchantTin: string;
    ebarimtId: string | null;
    totalAmount: number;
    createdAt: Date;
  };
}

/**
 * OrderId давхцалт шалгах
 * Database-д ижил orderId, merchantTin-тай баримт байгаа эсэхийг шалгана
 */
export async function checkOrderIdDuplicate(
  orderId: string,
  merchantTin?: string,
): Promise<DuplicateCheckResult> {
  let existing = null;

  if (merchantTin) {
    existing = await findReceiptByOrderId(orderId, merchantTin);
  } else {
    existing = await findReceiptByOrderIdOnly(orderId);
  }

  if (!existing) {
    return { isDuplicate: false };
  }

  return {
    isDuplicate: true,
    existingBill: {
      orderId: existing.orderId,
      merchantTin: existing.merchantTin,
      ebarimtId: existing.ebarimtId,
      totalAmount: existing.totalAmount,
      createdAt: existing.createdAt,
    },
  };
}
