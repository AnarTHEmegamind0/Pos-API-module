export interface PosApiLog {
  id: string; // POS receipt id
  date: Date; // POS receipt timestamp
  merchantTin: string;
  orderId: string;
  success: boolean;
  message: string;
  errorCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PosApiUpdateLog {
  orderId: string;
  oldId: string;
  newId: string;
  date: Date;
  merchantTin: string;
  createdAt?: string;
}

export interface PosApiReturnBillLog {
  orderId: string;
  id: string;
  returnDate: Date;
  merchantTin: string;
  success: boolean;
  message: string;
  errorCode?: string;
  createdAt?: string;
}

export interface PosApiSettings {
  merchantTin: string;
  posNo: string;
  districtCode: string;
  branchNo: string;
  billIdSuffix: string;
  updatedAt?: string;
}

// Response logs (for debugging)
export interface PosApiResponseLog {
  id: number;
  orderId: string;
  merchantTin: string;
  ebarimtId: string | null;
  totalAmount: number;
  totalVat: number;
  totalCityTax: number;
  receiptType: string;
  success: boolean;
  errorMessage: string | null;
  responseStatus: string | null; // "SUCCESS" | "ERROR" | "PAYMENT"
  responseMessage: string | null; // ST-Ebarimt-ээс ирсэн мессеж
  responseDate: Date | null; // ST-Ebarimt-ээс ирсэн огноо
  createdAt: Date;
  updatedAt: Date;
}
