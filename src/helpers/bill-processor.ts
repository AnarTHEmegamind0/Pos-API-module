// src/helpers/bill-processor.ts

import type {
  InputBillRequest,
  InputReceipt,
  InputItem,
  DirectBillRequest,
  DirectReceipt,
  DirectItem,
  DirectPayment,
} from "../types.js";
import { detectBarcodeType } from "./barcode.js";
import { calculateItemTax } from "./tax.js";
import { validatePayments } from "./payment.js";

/**
 * Bill processing үр дүн
 */
export type ProcessResult =
  | { success: true; data: DirectBillRequest }
  | { success: false; message: string };

/**
 * 2 орон хүртэл бөөрөнхийлөх
 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Frontend-ийн request-ийг боловсруулах
 *
 * - Item бүрт татвар тооцоолох (VAT, НХАТ)
 * - barCodeType тодорхойлох
 * - unitPrice тооцоолох
 * - ClassificationCode нэмэх
 * - Receipt нийлбэр тооцоолох
 * - Root level нийлбэр тооцоолох
 * - Payment validation хийх
 */
export function processBillRequest(input: InputBillRequest): ProcessResult {
  // === Basic validation ===
  if (!input.orderId) {
    return { success: false, message: "orderId шаардлагатай" };
  }

  if (!input.merchantTin) {
    return { success: false, message: "merchantTin шаардлагатай" };
  }

  if (!input.posNo) {
    return { success: false, message: "posNo шаардлагатай" };
  }

  if (!input.districtCode) {
    return { success: false, message: "districtCode шаардлагатай" };
  }

  if (!input.branchNo) {
    return { success: false, message: "branchNo шаардлагатай" };
  }

  if (!input.receipts || input.receipts.length === 0) {
    return { success: false, message: "receipts хоосон байна" };
  }

  // Invoice эсэхийг шалгах
  const isInvoice =
    input.type === "B2B_INVOICE" || input.type === "B2C_INVOICE";

  // Invoice биш бол payments заавал байх ёстой
  if (!isInvoice && (!input.payments || input.payments.length === 0)) {
    return { success: false, message: "payments хоосон байна" };
  }

  // B2B баримт бол customerTin заавал байх ёстой
  if (
    (input.type === "B2B_RECEIPT" || input.type === "B2B_INVOICE") &&
    !input.customerTin
  ) {
    return { success: false, message: "Байгууллагын ТТД оруулна уу" };
  }

  // === Process receipts ===
  const processedReceipts: DirectReceipt[] = [];
  let rootTotalAmount = 0;
  let rawRootVat = 0;
  let rawRootCityTax = 0;

  for (let i = 0; i < input.receipts.length; i++) {
    const inputReceipt = input.receipts[i];
    const receiptResult = processReceipt(inputReceipt, i);

    if (!receiptResult.success) {
      return receiptResult;
    }

    processedReceipts.push(receiptResult.data);
    rootTotalAmount += receiptResult.data.totalAmount;
    rawRootVat += receiptResult.rawVat;
    rawRootCityTax += receiptResult.rawCityTax;
  }

  // Root level: raw нийлбэр дээр 1 удаа round2 хийх (POSAPI шалгалттай тааруулна)
  rootTotalAmount = round2(rootTotalAmount);
  const rootTotalVAT = round2(rawRootVat);
  const rootTotalCityTax = round2(rawRootCityTax);

  // === Validate payments (Invoice биш үед) ===
  if (!isInvoice) {
    const paymentValidation = validatePayments(input.payments, rootTotalAmount);
    if (!paymentValidation.valid) {
      return {
        success: false,
        message: paymentValidation.message || "Төлбөр таарахгүй",
      };
    }
  }

  // === Build DirectBillRequest ===
  const directRequest: DirectBillRequest = {
    orderId: input.orderId,
    type: input.type,
    merchantTin: input.merchantTin,
    posNo: input.posNo,
    districtCode: input.districtCode,
    branchNo: input.branchNo,
    totalAmount: rootTotalAmount,
    totalVAT: rootTotalVAT,
    totalCityTax: rootTotalCityTax,
    receipts: processedReceipts,
    payments: isInvoice ? [] : (input.payments as DirectPayment[]),

    // Optional fields
    customerTin: input.customerTin || "",
    consumerNo: input.consumerNo || "",
    inactiveId: input.inactiveId || "",
    reportMonth: input.reportMonth || null,
    invoiceId: input.invoiceId || null,
    billIdSuffix: input.billIdSuffix,
  };

  return { success: true, data: directRequest };
}

/**
 * Receipt боловсруулах
 */
function processReceipt(
  inputReceipt: InputReceipt,
  receiptIndex: number,
):
  | { success: true; data: DirectReceipt; rawVat: number; rawCityTax: number }
  | { success: false; message: string } {
  if (!inputReceipt.items || inputReceipt.items.length === 0) {
    return {
      success: false,
      message: `receipts[${receiptIndex}].items хоосон байна`,
    };
  }

  const processedItems: DirectItem[] = [];
  let receiptTotalAmount = 0;
  let rawReceiptVat = 0;
  let rawReceiptCityTax = 0;

  for (let i = 0; i < inputReceipt.items.length; i++) {
    const inputItem = inputReceipt.items[i];
    const itemResult = processItem(
      inputItem,
      inputReceipt.taxType,
      receiptIndex,
      i,
    );

    if (!itemResult.success) {
      return itemResult;
    }

    processedItems.push(itemResult.data);
    receiptTotalAmount += itemResult.data.totalAmount;

    // ST-Ebarimt/POSAPI шалгалттай тааруулахын тулд receipt-ийн VAT/CityTax-ыг
    // item-үүдийн raw (round хийгдээгүй) утгаар нь нийлүүлж байгаад төгсгөлд нь round2 хийнэ.
    const isVatAble = inputReceipt.taxType === "VAT_ABLE";
    const isNhat = inputItem.isNhat ?? false;

    let divisor = 1;
    if (isVatAble && isNhat) {
      divisor = 1.12;
    } else if (isVatAble && !isNhat) {
      divisor = 1.1;
    } else if (!isVatAble && isNhat) {
      divisor = 1.02;
    }

    const baseAmount = inputItem.totalAmount / divisor;
    rawReceiptVat += isVatAble ? baseAmount * 0.1 : 0;
    rawReceiptCityTax += isNhat ? baseAmount * 0.02 : 0;
  }

  // Receipt түвшинд нэг удаа round2 хийх
  receiptTotalAmount = round2(receiptTotalAmount);
  const receiptTotalVAT = round2(rawReceiptVat);
  const receiptTotalCityTax = round2(rawReceiptCityTax);

  const directReceipt: DirectReceipt = {
    taxType: inputReceipt.taxType,
    merchantTin: inputReceipt.merchantTin,
    totalAmount: receiptTotalAmount,
    totalVAT: receiptTotalVAT,
    totalCityTax: receiptTotalCityTax,
    items: processedItems,
    customerTin: inputReceipt.customerTin || null,
    bankAccountNo: inputReceipt.bankAccountNo || null,
  };

  return {
    success: true,
    data: directReceipt,
    rawVat: rawReceiptVat,
    rawCityTax: rawReceiptCityTax,
  };
}

/**
 * Item боловсруулах
 */
function processItem(
  inputItem: InputItem,
  taxType: string,
  receiptIndex: number,
  itemIndex: number,
): { success: true; data: DirectItem } | { success: false; message: string } {
  // Validation
  if (!inputItem.name) {
    return {
      success: false,
      message: `receipts[${receiptIndex}].items[${itemIndex}].name шаардлагатай`,
    };
  }

  if (!inputItem.qty || inputItem.qty <= 0) {
    return {
      success: false,
      message: `receipts[${receiptIndex}].items[${itemIndex}].qty 0-ээс их байх ёстой`,
    };
  }

  if (!inputItem.totalAmount || inputItem.totalAmount <= 0) {
    return {
      success: false,
      message: `receipts[${receiptIndex}].items[${itemIndex}].totalAmount 0-ээс их байх ёстой`,
    };
  }

  // Detect barcode type
  const barCodeType = detectBarcodeType(inputItem.barCode);

  // Calculate tax
  const taxResult = calculateItemTax(
    inputItem.totalAmount,
    inputItem.qty,
    taxType,
    inputItem.isNhat ?? false,
  );

  const directItem: DirectItem = {
    name: inputItem.name,
    barCode: inputItem.barCode || "",
    barCodeType: barCodeType,
    classificationCode: inputItem.classificationCode,
    measureUnit: inputItem.measureUnit || "ш",
    qty: inputItem.qty,
    unitPrice: taxResult.unitPrice,
    totalAmount: taxResult.totalAmount,
    totalVAT: taxResult.vat,
    totalCityTax: taxResult.cityTax,
    taxProductCode: inputItem.taxProductCode || null,
  };

  return { success: true, data: directItem };
}
