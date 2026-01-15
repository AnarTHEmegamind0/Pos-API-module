import { EReceiptType, EVAT } from "./enums.js";

export type Result<T> = {
  message: string;
  success: boolean;
  data: T | null;
};

// ---- ttd / tin results ----
export interface TtdResult {
  msg: string;
  status: number;
  data: string | null;
}

export interface TinResult {
  msg: string;
  status: number;
  data: TinResultInner;
}

export interface TinResultInner {
  name: string;
  freeProject: boolean;
  cityPayer: boolean;
  vatPayer: boolean;
  found: boolean;
  vatpayerRegisteredDate: string;
  isGovernment: boolean;
}

// ---- info ----
export interface PosApiInfo {
  operatorName: string;
  operatorTIN: string;
  posId: number;
  posNo: string;
  version: string;
  lastSentDate: string;
  leftLotteries: number;
  appInfo: AppInfo;
  paymentTypes: PaymentType[];
  merchants: Merchant[];
}

export interface AppInfo {
  applicationDir: string;
  currentDir: string;
  database: string;
  "database-host": string;
  "supported-databases": string[];
  workDir: string;
}

export interface PaymentType {
  code: string;
  name: string;
}

export interface Merchant {
  tin: string;
  name: string;
  customers: Customer[];
}

export interface Customer {
  tin: string;
  name: string;
}

// ========== Direct Bill Types (Frontend-ээс бэлэн JSON) ==========

/**
 * Frontend-ээс ирэх request
 * Бүх тооцоо frontend дээр хийгдсэн байна
 */
export interface DirectBillRequest {
  // Заавал байх field-үүд
  orderId: string;
  totalAmount: number;
  totalVAT: number;
  totalCityTax: number;
  districtCode: string;
  branchNo: string;
  merchantTin: string;
  posNo: string;
  type: EReceiptType | string;
  receipts: DirectReceipt[];
  payments: DirectPayment[];

  // Optional field-үүд
  customerTin?: string | null;
  consumerNo?: string | null;
  inactiveId?: string | null;
  reportMonth?: string | null;
  invoiceId?: string | null;
  billIdSuffix?: string;
}

export interface DirectReceipt {
  taxType: EVAT | string;
  merchantTin: string;
  totalAmount: number;
  totalVAT: number;
  totalCityTax: number;
  items: DirectItem[];
  customerTin?: string | null;
  bankAccountNo?: string | null;
}

export interface DirectItem {
  name: string;
  barCode: string;
  barCodeType: string;
  classificationCode: string;
  measureUnit: string;
  qty: number;
  unitPrice: number;
  totalAmount: number;
  totalVAT: number;
  totalCityTax: number;
  taxProductCode?: string | null;
}

export interface DirectPayment {
  code: string;
  status: string;
  paidAmount: number;
}

/**
 * ST-Ebarimt-ээс ирэх response
 */
export interface DirectBillResponse {
  id: string;
  version: string;
  totalAmount: number;
  totalVAT: number;
  totalCityTax: number;
  branchNo: string;
  districtCode: string;
  merchantTin: string;
  posNo: string;
  customerTin?: string;
  consumerNo?: string;
  type: string;
  receipts: DirectReceiptResponse[];
  payments: DirectPayment[];
  posId: number;
  status: "SUCCESS" | "ERROR" | "PAYMENT";
  qrData: string;
  lottery: string;
  date: string;
  easy: boolean;
}

export interface DirectReceiptResponse {
  id: string;
  totalAmount: number;
  taxType: string;
  items: DirectItem[];
  merchantTin: string;
  totalVAT: number;
  totalCityTax: number;
}

// ========== Delete Bill Types ==========

export interface DeleteBillRequest {
  orderId: string;
  merchantTin: string;
}
