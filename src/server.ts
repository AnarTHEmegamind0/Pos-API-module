// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";

import { PosApiWrapper } from "./wrapper.js";
import type {
  DirectBillRequest,
  DeleteBillRequest,
  InputBillRequest,
} from "./types.js";

// DB helpers
import {
  initDb,
  findReceiptByOrderId,
  findReceiptByOrderIdOnly,
  findReceiptByEbarimtId,
  saveUpdateBillLog,
} from "./db.js";

// Bill processor helper
import { processBillRequest } from "./helpers/index.js";
import { checkOrderIdDuplicate } from "./helpers/duplicate-checker.js";

import { logsRouter } from "./routes/logs.js";
import { settingsRouter } from "./routes/settings.js";
import { ebarimtInfoRouter } from "./routes/ebarimt-info.js";

(async () => {
  await initDb();
  console.log("Database ready.");
})();

console.log("POS Service initialized. Waiting for requests...\n");

const posapi = new PosApiWrapper({
  notifyError: (msg: string) => console.error(`[POS Error] ${msg}\n`),
  notifySuccess: (msg: string) => console.log(`[POS Success] ${msg}\n`),
});

const app = express();

// CORS тохиргоо - React frontend-тэй холбогдох
app.use(
  cors({
    origin: [
      "http://localhost:3000", // React development
      "http://127.0.0.1:3000",
      "https://posapi.itsystem.mn", // Production
      "http://posapi.itsystem.mn",
      "http://erp.itsystem.mn",
      "https://erp.itsystem.mn",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "posapi-module",
    ts: new Date().toISOString(),
  });
});

// ========== ADD BILL ==========
app.post("/posapi/addBill", async (req, res) => {
  try {
    const payload = req.body as InputBillRequest;

    // === CONSOLE LOG: Ирсэн payload ===
    console.log(
      "[addBill] Incoming payload:",
      JSON.stringify(payload, null, 2),
    );

    // === ДАВХЦАЛТ ШАЛГАХ (force=true биш үед) ===
    if (!payload.force) {
      const dupCheck = await checkOrderIdDuplicate(
        payload.orderId,
        payload.merchantTin,
      );

      if (dupCheck.isDuplicate) {
        console.log(
          "[addBill] Duplicate orderId found:",
          dupCheck.existingBill,
        );
        return res.status(409).json({
          success: false,
          status: 0,
          duplicate: true,
          existingBill: dupCheck.existingBill,
          message: "ID давхцаж байна. Хамаагүй юу?",
          data: null,
        });
      }
    }

    // === force=true бол UPDATE хийх (хуучин баримтыг inactiveId-аар солих) ===
    if (payload.force) {
      const existing = await checkOrderIdDuplicate(
        payload.orderId,
        payload.merchantTin,
      );

      if (existing.isDuplicate && existing.existingBill?.ebarimtId) {
        // inactiveId-г хуучин баримтын ebarimtId-аар тохируулах
        payload.inactiveId = existing.existingBill.ebarimtId;
        console.log(
          "[addBill] Force update - setting inactiveId:",
          payload.inactiveId,
        );
      }
    }

    // Татвар тооцоолж, бүрэн формат үүсгэх
    const processResult = processBillRequest(payload);

    if (!processResult.success) {
      console.error("[addBill] Process error:", processResult.message);
      return res.status(400).json({
        success: false,
        status: 0,
        message: processResult.message,
        data: null,
      });
    }

    const billRequest = processResult.data;

    // === CONSOLE LOG: Боловсруулсан request ===
    console.log(
      "[addBill] Processed request:",
      JSON.stringify(billRequest, null, 2),
    );

    // ST-Ebarimt руу илгээх
    const result = await posapi.POST_BILL(billRequest);

    // === CONSOLE LOG: Response ===
    console.log(
      "[addBill] ST-Ebarimt response:",
      JSON.stringify(result, null, 2),
    );

    return res.json(result);
  } catch (err: any) {
    console.error("[addBill] Exception:", err);
    return res.status(500).json({
      success: false,
      status: 0,
      message: err?.message ?? "Failed to add bill",
      data: null,
    });
  }
});

// ========== UPDATE BILL ==========
// Input: { ebarimtId: string, ...шинэ InputBillRequest (orderId-гүй байж болно) }
app.post("/posapi/updateBill", async (req, res) => {
  try {
    const payload = req.body as InputBillRequest & { ebarimtId?: string };

    // === CONSOLE LOG: Ирсэн payload ===
    console.log(
      "[updateBill] Incoming payload:",
      JSON.stringify(payload, null, 2),
    );

    const { ebarimtId } = payload;

    // Validation: ebarimtId эсвэл orderId байх ёстой
    if (!ebarimtId && !payload.orderId) {
      console.error("[updateBill] Error: ebarimtId or orderId is required");
      return res.status(400).json({
        success: false,
        status: 0,
        message: "ebarimtId or orderId is required",
        data: null,
      });
    }

    // ebarimtId-аар хуучин баримт хайх
    let existingReceipt = null;
    if (ebarimtId) {
      existingReceipt = await findReceiptByEbarimtId(ebarimtId);
      if (!existingReceipt) {
        console.error("[updateBill] Error: No existing bill found for ebarimtId:", ebarimtId);
        return res.status(404).json({
          success: false,
          status: 0,
          message: `No existing bill found for ebarimtId: ${ebarimtId}`,
          data: null,
        });
      }
      // Хуучин баримтын orderId, merchantTin-ийг payload-д нэмэх
      if (!payload.orderId) {
        payload.orderId = existingReceipt.orderId;
      }
      if (!payload.merchantTin) {
        payload.merchantTin = existingReceipt.merchantTin;
      }
      // inactiveId тохируулах
      payload.inactiveId = ebarimtId;
    }

    // Татвар тооцоолж, бүрэн формат үүсгэх
    const processResult = processBillRequest(payload);

    if (!processResult.success) {
      console.error("[updateBill] Process error:", processResult.message);
      return res.status(400).json({
        success: false,
        status: 0,
        message: processResult.message,
        data: null,
      });
    }

    const billRequest = processResult.data;

    // orderId-аар хайсан тохиолдолд (ebarimtId байхгүй үед)
    if (!billRequest.inactiveId) {
      let existing = null;
      if (payload.merchantTin) {
        existing = await findReceiptByOrderId(payload.orderId, payload.merchantTin);
      } else {
        existing = await findReceiptByOrderIdOnly(payload.orderId);
      }

      if (!existing?.ebarimtId) {
        console.error("[updateBill] Error: No existing bill found for OrderId:", payload.orderId);
        return res.status(404).json({
          success: false,
          status: 0,
          message: "No existing bill found for provided OrderId; cannot perform update.",
          data: null,
        });
      }

      billRequest.inactiveId = existing.ebarimtId;
    }

    // === CONSOLE LOG: Боловсруулсан request ===
    console.log(
      "[updateBill] Processed request:",
      JSON.stringify(billRequest, null, 2),
    );

    // ST-Ebarimt руу илгээх
    const result = await posapi.POST_BILL(billRequest);

    // === CONSOLE LOG: Response ===
    console.log(
      "[updateBill] ST-Ebarimt response:",
      JSON.stringify(result, null, 2),
    );

    // Амжилттай болсны дараа pos_api_update_logs-д хадгалах
    if (result.success && billRequest.inactiveId && result.data?.id) {
      await saveUpdateBillLog({
        orderId: billRequest.orderId,
        oldId: billRequest.inactiveId,
        newId: result.data.id,
        date: new Date(),
        merchantTin: billRequest.merchantTin,
      });
      console.log(
        `[updateBill] Log saved - OldId: ${billRequest.inactiveId}, NewId: ${result.data.id}`,
      );
    }

    return res.json(result);
  } catch (err: any) {
    console.error("[updateBill] Exception:", err);
    return res.status(500).json({
      success: false,
      status: 0,
      message: err?.message ?? "Failed to update bill",
      data: null,
    });
  }
});

// ========== DELETE BILL ==========
app.post("/posapi/deleteBill", async (req, res) => {
  try {
    const payload = req.body as DeleteBillRequest;

    if (!payload.ebarimtId) {
      return res.status(400).json({
        success: false,
        status: 0,
        message: "ДДТД is required",
        data: null,
      });
    }

    const result = await posapi.DELETE_BILL(payload);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      status: 0,
      message: err?.message ?? "Failed to delete bill",
      data: null,
    });
  }
});

// ========== SEND BILLS ==========
app.post("/posapi/sendBills", async (_req, res) => {
  try {
    const result = await posapi.SEND_BILLS();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to send bills",
      data: null,
    });
  }
});

// ========== GET RECEIPT BY ORDER ID ==========
app.get("/posapi/receipt/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const merchantTin = req.query.merchantTin as string | undefined;

    let receipt = null;
    if (merchantTin) {
      receipt = await findReceiptByOrderId(orderId, merchantTin);
    } else {
      receipt = await findReceiptByOrderIdOnly(orderId);
    }

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
        data: null,
      });
    }

    return res.json({
      success: true,
      message: "Receipt found",
      data: receipt,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to get receipt",
      data: null,
    });
  }
});

// routers
app.use("/posapi", settingsRouter);
app.use("/posapi", logsRouter);
app.use("/posapi", ebarimtInfoRouter);

app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

const PORT = Number(process.env.PORT) || 4001;
app.listen(PORT, () => {
  console.log(`POS Wrapper API running -> http://localhost:${PORT}`);
  console.log(`Base endpoint: http://localhost:${PORT}/posapi`);
});
// ========== DAILY SCHEDULED TASK TO SEND BILLS ==========
cron.schedule('59 23 * * *', async () => {
  console.log(' Өнөөдрийн бүх баримтийг Ebarimt луу баримт илгээж байна...');
  try {
    const result = await posapi.SEND_BILLS();
    console.log(' Илгээсэн:', result);
  } catch (err) {
    console.error(' Алдаа:', err);
  }
}, {
  timezone: 'Asia/Ulaanbaatar'
});