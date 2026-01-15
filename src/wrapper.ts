// src/wrapper.ts
import * as Client from "./client.js";
import type {
  DirectBillRequest,
  DirectBillResponse,
  DeleteBillRequest,
  Result,
} from "./types.js";
import {
  saveReceipt,
  findReceiptByOrderId,
  findReceiptByOrderIdOnly,
  type ReceiptRecord,
} from "./db.js";

export interface PosApiDependencies {
  notifyError?: (msg: string) => void;
  notifySuccess?: (msg: string) => void;
}

export class PosApiWrapper {
  constructor(private deps: PosApiDependencies = {}) {}

  /**
   * POST_BILL - Frontend-ээс бэлэн JSON авч ST-Ebarimt руу явуулах
   */
  async POST_BILL(
    request: DirectBillRequest,
  ): Promise<Result<DirectBillResponse & { orderId: string }>> {
    const { orderId, ...payload } = request;

    if (!orderId) {
      const msg = "orderId is required";
      this.deps.notifyError?.(`POS API error: ${msg}`);
      return { success: false, message: msg, data: null };
    }

    console.log(
      "[addBill] Request:",
      JSON.stringify({ orderId, ...payload }, null, 2),
    );

    // ST-Ebarimt руу явуулах
    const result = await Client.postData(JSON.stringify(payload));

    // DB-д хадгалах
    await saveReceipt({
      orderId,
      merchantTin: payload.merchantTin,
      request: payload,
      response: result.data as DirectBillResponse | null,
      success: result.success,
      errorMessage: result.success ? null : result.message,
    });

    if (result.success && result.data) {
      console.log(
        `[addBill] Success - OrderId: ${orderId}, EbarimtId: ${result.data.id}`,
      );
      this.deps.notifySuccess?.(`Bill created: ${orderId}`);

      // Response-д orderId нэмж буцаах
      return {
        success: true,
        message: result.message,
        data: { ...result.data, orderId },
      };
    } else {
      console.error(
        `[addBill] Error - OrderId: ${orderId}, Message: ${result.message}`,
      );
      this.deps.notifyError?.(`POS API error: ${result.message}`);
      return {
        success: false,
        message: result.message,
        data: null,
      };
    }
  }

  /**
   * DELETE_BILL - Баримт буцаах/устгах
   */
  async DELETE_BILL(request: DeleteBillRequest): Promise<Result<string>> {
    const { orderId, merchantTin } = request;

    if (!orderId || !merchantTin) {
      const msg = "orderId and merchantTin are required";
      this.deps.notifyError?.(`POS API error: ${msg}`);
      return { success: false, message: msg, data: null };
    }

    // DB-ээс хуучин баримт хайх
    let receipt: ReceiptRecord | null = null;
    if (merchantTin) {
      receipt = await findReceiptByOrderId(orderId, merchantTin);
    } else {
      receipt = await findReceiptByOrderIdOnly(orderId);
    }

    if (!receipt || !receipt.ebarimtId) {
      const msg = `No existing bill found for OrderId: ${orderId} (merchantTin=${merchantTin})`;
      this.deps.notifyError?.(`POS API error: ${msg}`);
      return { success: false, message: msg, data: null };
    }

    // Date format for delete
    const dateStr = receipt.responseJson?.date ?? new Date().toISOString();

    const result = await Client.deleteData(receipt.ebarimtId, dateStr);

    if (result.success) {
      console.log(
        `[deleteBill] Success - OrderId: ${orderId}, EbarimtId: ${receipt.ebarimtId}`,
      );
    } else {
      this.deps.notifyError?.(`POS API error: ${result.message}`);
    }

    return result;
  }

  /**
   * SEND_BILLS - Бүх pending баримтуудыг илгээх
   */
  async SEND_BILLS(): Promise<Result<string>> {
    const result = await Client.sendData();
    if (!result.success) {
      this.deps.notifyError?.(`POS API error: ${result.message}`);
    }
    return result;
  }

  // Info functions
  GetInfo = Client.getInfo;
  GetTTDInfo = Client.getTTD;
  GetTinInfo = Client.getTin;
  GetCombinedTinInfo = Client.getCombinedTinInfo;
}
