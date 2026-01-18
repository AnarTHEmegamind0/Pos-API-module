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
  return Math.round(n * 100) / 100;
}

/**
 * Frontend-ийн request-ийг боловсруулах
 *
 * - Item бүрт татвар тооцоолох (VAT, НХАТ)
 * - barCodeType тодорхойлох
 * - unitPrice тооцоолох
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
  let rootTotalVAT = 0;
  let rootTotalCityTax = 0;

  for (let i = 0; i < input.receipts.length; i++) {
    const inputReceipt = input.receipts[i];
    const receiptResult = processReceipt(inputReceipt, i);

    if (!receiptResult.success) {
      return receiptResult;
    }

    processedReceipts.push(receiptResult.data);
    rootTotalAmount += receiptResult.data.totalAmount;
    rootTotalVAT += receiptResult.data.totalVAT;
    rootTotalCityTax += receiptResult.data.totalCityTax;
  }

  // Round root totals
  rootTotalAmount = round2(rootTotalAmount);
  rootTotalVAT = round2(rootTotalVAT);
  rootTotalCityTax = round2(rootTotalCityTax);

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
  | { success: true; data: DirectReceipt }
  | { success: false; message: string } {
  if (!inputReceipt.items || inputReceipt.items.length === 0) {
    return {
      success: false,
      message: `receipts[${receiptIndex}].items хоосон байна`,
    };
  }

  const processedItems: DirectItem[] = [];
  let receiptTotalAmount = 0;
  let receiptTotalVAT = 0;
  let receiptTotalCityTax = 0;

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
    receiptTotalVAT += itemResult.data.totalVAT;
    receiptTotalCityTax += itemResult.data.totalCityTax;
  }

  const directReceipt: DirectReceipt = {
    taxType: inputReceipt.taxType,
    merchantTin: inputReceipt.merchantTin,
    totalAmount: round2(receiptTotalAmount),
    totalVAT: round2(receiptTotalVAT),
    totalCityTax: round2(receiptTotalCityTax),
    items: processedItems,
    customerTin: inputReceipt.customerTin || null,
    bankAccountNo: inputReceipt.bankAccountNo || null,
  };

  return { success: true, data: directReceipt };
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
    classificationCode: inputItem.classificationCode || "",
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
