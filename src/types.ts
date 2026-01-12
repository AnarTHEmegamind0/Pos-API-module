import { EReceiptType, EVAT } from "./enums";

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

// ---- send data classes ----
export interface PosApiReceipt {
  // Header / buyer
  customerTin?: string | null; // default: null
  inactiveId?: string | null; // default: null (for return/cancel cases)
  type: EReceiptType; // default: B2C_RECEIPT if no customerTin

  // Merchant / POS identifiers
  districtCode: string;
  merchantTin: string;
  posNo: string;
  branchNo: string;
  billIdSuffix: string; // default: "01"

  // Optional report fields
  consumerNo?: string | null; // default: null
  reportMonth?: string | null; // default: null
  invoiceId?: string | null; // default: null

  // Lines & payments
  receipts: Receipt[];
  payments: Payment[];

  // Totals (computed from `receipts` in C#; set them in TS before sending)
  totalAmount: number;
  totalVAT: number;
  totalCityTax: number;
}

export interface Receipt {
  taxType: EVAT; // default: EVAT.VAT_ABLE
  merchantTin: string;
  customerTin?: string | null; // default: null
  bankAccountNo?: string | null; // default: null
  iBan?: string; // default: ""

  items: Item[];

  totalAmount: number;
  totalVAT: number;
  totalCityTax: number;
}

export interface Item {
  // Identification / classification
  name: string;
  barCode: string; // default in C#: "123456789"
  barCodeType: string; // default in C#: "UNDEFINED" (GS1, ISBN, etc.)
  classificationCode: string; // default in C#: "123"
  measureUnit: string; // default in C#: "ш"
  taxProductCode: string; // default in C#: "6222900"

  // Pricing / qty
  qty: number; // default in C#: 1
  unitPrice: number;

  // Flags (JsonIgnore in C#; still useful in builder logic)
  isVAT?: boolean; // derived from EVAT grouping
  isNHAT?: boolean; // “city tax” applicability

  // Computed rollups (explicit here so they’re serialized)
  priceWithoutTax?: number; // optional helper (not required by bridge)
  totalVAT: number; // e.g., isVAT ? round(qty*unitPrice/11,2) : 0
  totalCityTax: number; // e.g., isNHAT ? qty*priceWithoutTax*0.01 : 0
  totalAmount: number; // round(unitPrice*qty + totalCityTax, 2)
}

export interface Payment {
  code: "CASH" | "PAYMENT_CARD" | string;
  status: string; // "PAID"
  paidAmount: number;
}

export interface PosApiResponse {
  success: boolean; // from the outer envelope you showed
  message: string; // "Data posted successfully"
  data: {
    id: string; // <-- use this instead of billId
    version: string; // "3.2.0"
    totalAmount: number;
    totalVAT: number;
    totalCityTax: number;
    branchNo: string;
    districtCode: string;
    merchantTin: string;
    posNo: string;
    type: "B2C_RECEIPT" | string;

    receipts: Array<{
      id: string;
      totalAmount: number;
      taxType: string; // or EVAT if you normalize
      items: Array<{
        name: string;
        barCode: string;
        barCodeType: string;
        classificationCode: string;
        taxProductCode: string | null;
        measureUnit: string;
        qty: number;
        unitPrice: number;
        totalAmount: number;
        totalVAT: number;
        totalCityTax: number;
      }>;
      merchantTin: string;
      totalVAT: number;
      totalCityTax: number;
    }>;

    payments: Array<{
      code: string; // "CASH"
      paidAmount: number;
      status: string; // "PAID"
    }>;

    posId: number;
    status: "SUCCESS" | "ERROR" | "PAYMENT";
    qrData: string;
    lottery: string;
    date: string; // <-- use this instead of billDate
    easy: boolean; // <-- boolean, not string
  };
}

// client-side wrapper DTOs
export interface CSettings {
  DistrictCode: string;
  PosNo: string;
  BranchNo: string;
  MerchantTin: string;
  BillIdSuffix?: string;
}

export interface CReceipt {
  OrderId: string; // external orderId
  CustomerTin?: string | null;
  MerchantTin?: string | null;
  Items: CReceiptItem[];
  Payments: CPayment[];
  PreviousReceiptId?: string | null; // return (butsaalt) case
}

export interface CReceiptItem {
  barCode: string;
  name: string;
  qty: number;
  unitPrice: number;

  EVAT: EVAT; // default VAT_ABLE
  isNhat: boolean; // default false
  measureUnit: string; // default "ш"
  barCodeType: string; // default "UNDEFINED"
  classificationCode: string; // default "1234567"
  taxProductCode?: string | null;
}

export interface CPayment {
  Amount: number;
  IsCash: boolean;
}
