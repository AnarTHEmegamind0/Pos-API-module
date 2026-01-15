// src/wrapper.ts
import * as Client from "./client.js";
import { convertToPosApiReceipt } from "./collect.js";
import type { CReceipt, CSettings, Result } from "./types.js";
import type { PosApiLog } from "./log-types.js";
import { EReceiptType } from "./enums.js";
import { getPosApiSettingsByTin, getPosApiSettings } from "./db.js";

export interface PosApiDependencies {
  // add merchantTin here
  writeLogOrderData: (
    apiResult: any,
    orderId: string,
    merchantTin: string,
  ) => void;
  writeLogReturnBill: (
    oldLog: PosApiLog,
    orderId: string,
    resultMessage: string,
  ) => void;
  // <--- change signature: we need merchantTin too
  findPosApiLogByOrderId: (
    orderId: string,
    merchantTin: string,
  ) => Promise<PosApiLog | null>;
  notifyError?: (msg: string) => void;
}

export class PosApiWrapper {
  private talonNos = new Map<string, string>();

  constructor(private deps: PosApiDependencies) {}

  private async resolveSettings(order: CReceipt): Promise<CSettings> {
    const merchantTin = order.MerchantTin ?? null;

    if (merchantTin) {
      const row = await getPosApiSettingsByTin(merchantTin);
      if (!row) {
        throw new Error(`No POS settings found for merchantTin=${merchantTin}`);
      }
      return {
        MerchantTin: row.merchantTin,
        PosNo: row.posNo,
        DistrictCode: row.districtCode,
        BranchNo: row.branchNo,
        BillIdSuffix: row.billIdSuffix,
      };
    }

    const row = await getPosApiSettings();
    if (!row) {
      throw new Error("No POS settings found in database");
    }

    return {
      MerchantTin: row.merchantTin,
      PosNo: row.posNo,
      DistrictCode: row.districtCode,
      BranchNo: row.branchNo,
      BillIdSuffix: row.billIdSuffix,
    };
  }

  async POST_BILL(order: CReceipt): Promise<Result<any>> {
    if (!this.talonNos.has(order.OrderId)) this.talonNos.set(order.OrderId, "");
    const settings = await this.resolveSettings(order);
    const payload = convertToPosApiReceipt(order, settings);

    const result = await Client.postData(payload);
    if (result?.success) {
      this.deps.writeLogOrderData(
        result.data,
        order.OrderId,
        settings.MerchantTin,
      );
    } else {
      this.deps.notifyError?.(
        `POS API error: ${result?.message ?? "Unknown error"}`,
      );
    }
    return result;
  }

  async POST_BILL_TYPE(
    order: CReceipt,
    typeOverride: EReceiptType,
  ): Promise<Result<any>> {
    if (!this.talonNos.has(order.OrderId)) this.talonNos.set(order.OrderId, "");
    const settings = await this.resolveSettings(order);
    const payload = convertToPosApiReceipt(order, settings, typeOverride);

    const result = await Client.postData(payload);
    if (result?.success) {
      this.deps.writeLogOrderData(
        result.data,
        order.OrderId,
        settings.MerchantTin,
      );
    } else {
      this.deps.notifyError?.(
        `POS API error: ${result?.message ?? "Unknown error"}`,
      );
    }
    return result;
  }

  async DELETE_BILL(order: CReceipt): Promise<Result<string>> {
    // we MUST know which merchantTin we’re deleting for
    const merchantTin = order.MerchantTin ?? "";
    const oldLog = await this.deps.findPosApiLogByOrderId(
      order.OrderId,
      merchantTin,
    );
    if (!oldLog) {
      const msg = `No existing bill for provided OrderId: ${order.OrderId} (merchantTin=${merchantTin})`;
      this.deps.notifyError?.(`POS API error: ${msg}`);
      return { success: false, message: msg, data: null };
    }

    const deleteFn:
      | ((id: string, date: string) => Promise<Result<string>>)
      | undefined = (Client as any).deleteData ?? (Client as any).deleteBill;

    if (!deleteFn) {
      const msg = "deleteData/deleteBill is not exported from client";
      this.deps.notifyError?.(`POS API error: ${msg}`);
      return { success: false, message: msg, data: null };
    }

    const dateStr = toPosDateTime(oldLog.date);
    const result = await deleteFn(oldLog.id, dateStr);

    if (result.success) {
      this.deps.writeLogReturnBill(oldLog, order.OrderId, result.message);
    } else {
      this.deps.notifyError?.(`POS API error: ${result.message}`);
    }
    return result;
  }

  async SEND_BILLS(): Promise<Result<string>> {
    const result = await Client.sendData();
    if (!result.success) {
      this.deps.notifyError?.(`POS API error: ${result.message}`);
    }
    return result;
  }

  GetInfo = Client.getInfo;
  GetTTDInfo = Client.getTTD;
  GetTinInfo = Client.getTin;
  GetCombinedTinInfo = Client.getCombinedTinInfo;
}

function toPosDateTime(d: Date | string | number): string {
  const date =
    d instanceof Date
      ? d
      : typeof d === "string" || typeof d === "number"
        ? new Date(d)
        : new Date(NaN);

  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return fmt(now);
  }
  return fmt(date);

  function fmt(x: Date) {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(
      x.getHours(),
    )}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
  }
}
