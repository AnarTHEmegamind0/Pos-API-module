// src/helpers/index.ts

export { detectBarcodeType } from "./barcode.js";
export { calculateItemTax, getTaxRates, type TaxResult } from "./tax.js";
export {
  validatePayments,
  isValidPaymentCode,
  isValidPaymentStatus,
  type PaymentValidation,
  type PaymentInput,
} from "./payment.js";
export { processBillRequest, type ProcessResult } from "./bill-processor.js";
