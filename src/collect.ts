import { EVAT, EReceiptType } from "./enums.js";

import type {
  CReceipt,
  CSettings,
  PosApiReceipt,
  Receipt,
  Item,
  Payment,
} from "./types.js";

// ---------- helpers ----------
const round2 = (n: number) => Math.round(n * 100) / 100;
const isVAT = (it: Item) => Boolean(it.isVAT);
const isNHAT = (it: Item) => Boolean(it.isNHAT);
const priceWithoutTax = (it: Item) =>
  isVAT(it) ? round2(it.unitPrice / 1.1) : it.unitPrice;
// 10% VAT modeled as gross/11 (matches your original helper)
const totalVATOfItem = (it: Item) =>
  isVAT(it) ? round2((it.qty * it.unitPrice) / 11) : 0;

// ---------- NEW: compute per-item rollups ----------
function rollupItemTotals(it: Item) {
  const subtotal = round2(it.unitPrice * it.qty);
  const vat = totalVATOfItem(it);
  const nhat = isNHAT(it) ? round2(priceWithoutTax(it) * it.qty * 0.02) : 0;
  const city = 0; // set if your jurisdiction requires
  const total = round2(subtotal + nhat);
  return { subtotal, vat, nhat, city, total };
}

/**
 * Port of ConvertToPosApiReceipt — now with totals
 */
export function convertToPosApiReceipt(
  ireceipt: CReceipt,
  settings: CSettings,
  typeOverride?: EReceiptType | null,
): string {
  // decide final type first
  const finalType =
    typeOverride ??
    (ireceipt.CustomerTin
      ? EReceiptType.B2B_RECEIPT
      : EReceiptType.B2C_RECEIPT);

  const pos: PosApiReceipt = {
    districtCode: settings.DistrictCode,
    posNo: settings.PosNo,
    branchNo: settings.BranchNo,
    merchantTin: settings.MerchantTin,
    billIdSuffix: settings.BillIdSuffix ?? "01",

    type: finalType,
    inactiveId: ireceipt.PreviousReceiptId ?? null,
    customerTin: ireceipt.CustomerTin ?? null,

    receipts: [],
    payments: [],
    totalAmount: 0,
    totalVAT: 0,
    totalCityTax: 0,
  };

  // ---- group by VAT type (fixed: only once) ----
  const vatGroups = new Map<EVAT, CReceipt["Items"]>();
  for (const it of ireceipt.Items) {
    const k = it.EVAT ?? EVAT.VAT_ABLE;
    if (!vatGroups.has(k)) vatGroups.set(k, []);
    vatGroups.get(k)!.push(it);
  }

  // ---- build receipts per VAT type with totals ----
  for (const [vatType, list] of vatGroups) {
    const items: Item[] = list.map<Item>((_it) => ({
      name: _it.name,
      barCode: _it.barCode,
      barCodeType: _it.barCodeType ?? "UNDEFINED",
      classificationCode: _it.classificationCode ?? "1234567",
      measureUnit: _it.measureUnit ?? "ш",
      taxProductCode: _it.taxProductCode ?? "6222900",
      qty: _it.qty,
      unitPrice: _it.unitPrice,
      isNHAT: _it.isNhat ?? false,
      isVAT: (_it.EVAT ?? EVAT.VAT_ABLE) === EVAT.VAT_ABLE,
      totalAmount: 0,
      totalVAT: 0,
      totalCityTax: 0,
    }));

    // per-item rollups
    for (const it of items) {
      const r = rollupItemTotals(it);
      it.totalAmount = r.total;
      it.totalVAT = r.vat;
      it.totalCityTax = r.city;
    }

    const recTotal = round2(
      items.reduce((s, it) => s + (it.totalAmount ?? 0), 0),
    );
    const recVAT = round2(items.reduce((s, it) => s + (it.totalVAT ?? 0), 0));
    const recCity = round2(
      items.reduce((s, it) => s + (it.totalCityTax ?? 0), 0),
    );

    const rec: Receipt = {
      taxType: vatType,
      merchantTin: pos.merchantTin,
      customerTin: pos.customerTin ?? null,
      bankAccountNo: null,
      iBan: "",
      items,
      totalAmount: recTotal,
      totalVAT: recVAT,
      totalCityTax: recCity,
    };

    pos.receipts.push(rec);
  }

  // ---- top-level totals ----
  const grandTotal = round2(
    pos.receipts.reduce((s, r) => s + (r.totalAmount ?? 0), 0),
  );
  const grandVAT = round2(
    pos.receipts.reduce((s, r) => s + (r.totalVAT ?? 0), 0),
  );
  const grandCity = round2(
    pos.receipts.reduce((s, r) => s + (r.totalCityTax ?? 0), 0),
  );

  pos.totalAmount = grandTotal;
  pos.totalVAT = grandVAT;
  pos.totalCityTax = grandCity;

  // helper to normalize payments to cover total
  const ensureCoversGrandTotal = (payments: Payment[]) => {
    const sum = round2(payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0));
    if (sum <= 0 && grandTotal > 0) {
      return [
        { code: "CASH", status: "PAID", paidAmount: grandTotal },
      ] as Payment[];
    }
    const delta = round2(grandTotal - sum);
    if (delta > 0) {
      const [first, ...rest] = payments;
      return [
        { ...first, paidAmount: round2((first.paidAmount ?? 0) + delta) },
        ...rest,
      ];
    }
    return payments;
  };

  // ---- payments ----
  // rule: if type is invoice → DO NOT send payments
  const isInvoice =
    finalType === EReceiptType.B2B_INVOICE ||
    finalType === EReceiptType.B2C_INVOICE;

  if (!isInvoice) {
    if (!ireceipt.Payments || ireceipt.Payments.length === 0) {
      pos.payments = [{ code: "CASH", status: "PAID", paidAmount: grandTotal }];
    } else {
      pos.payments = ensureCoversGrandTotal(
        ireceipt.Payments.map<Payment>((p) => ({
          code: p.IsCash ? "CASH" : "PAYMENT_CARD",
          status: "PAID",
          paidAmount: p.Amount ?? 0,
        })),
      );
    }
  } else {
    // explicitly empty for invoice types
    pos.payments = [];
  }

  return JSON.stringify(pos);
}
