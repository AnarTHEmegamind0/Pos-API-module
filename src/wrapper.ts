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

    // Response-ээс status, message, date авах
    const responseData = result.data as DirectBillResponse | null;

    // DB-д хадгалах (response-ийн status, message, date-тэй хамт)
    await saveReceipt({
      orderId,
      merchantTin: payload.merchantTin,
      request: payload,
      response: responseData,
      success: result.success && responseData?.status === "SUCCESS",
      errorMessage: result.success ? null : result.message,
      // Response fields
      responseStatus: responseData?.status ?? null,
      responseMessage: responseData?.message ?? null,
      responseDate: responseData?.date ?? null,
    });

    // Response status-аар амжилт эсэхийг шалгах
    const isSuccess = result.success && responseData?.status === "SUCCESS";

    if (isSuccess && responseData) {
      console.log(
        `[addBill] Success - OrderId: ${orderId}, EbarimtId: ${responseData.id}`,
      );
      this.deps.notifySuccess?.(`Bill created: ${orderId}`);

      // Response-д orderId нэмж буцаах
      return {
        success: true,
        message: result.message,
        data: { ...responseData, orderId },
      };
    } else {
      // Error message-ийг response-ээс авах
      const errorMsg = responseData?.message ?? result.message;
      console.error(
        `[addBill] Error - OrderId: ${orderId}, Status: ${responseData?.status ?? "N/A"}, Message: ${errorMsg}`,
      );
      this.deps.notifyError?.(`POS API error: ${errorMsg}`);
      return {
        success: false,
        message: errorMsg,
        data: responseData ? { ...responseData, orderId } : null,
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

    // responseDate-ийг ашиглах, эсвэл одоогийн огноо
    const deleteDate = receipt.responseDate
      ? receipt.responseDate.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const result = await Client.deleteData(receipt.ebarimtId, deleteDate);

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
