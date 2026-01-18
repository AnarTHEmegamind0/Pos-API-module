// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";

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
      message: err?.message ?? "Failed to add bill",
      data: null,
    });
  }
});

// ========== UPDATE BILL ==========
app.post("/posapi/updateBill", async (req, res) => {
  try {
    const payload = req.body as InputBillRequest;

    // === CONSOLE LOG: Ирсэн payload ===
    console.log(
      "[updateBill] Incoming payload:",
      JSON.stringify(payload, null, 2),
    );

    const { orderId, merchantTin } = payload;

    // Validation
    if (!orderId) {
      console.error("[updateBill] Error: orderId is required");
      return res.status(400).json({
        success: false,
        message: "orderId is required",
        data: null,
      });
    }

    // Татвар тооцоолж, бүрэн формат үүсгэх
    const processResult = processBillRequest(payload);

    if (!processResult.success) {
      console.error("[updateBill] Process error:", processResult.message);
      return res.status(400).json({
        success: false,
        message: processResult.message,
        data: null,
      });
    }

    const billRequest = processResult.data;

    // Хуучин баримт хайх
    if (!billRequest.inactiveId) {
      let existing = null;
      if (merchantTin) {
        existing = await findReceiptByOrderId(orderId, merchantTin);
      } else {
        existing = await findReceiptByOrderIdOnly(orderId);
      }

      if (!existing?.ebarimtId) {
        console.error(
          "[updateBill] Error: No existing bill found for OrderId:",
          orderId,
        );
        return res.status(404).json({
          success: false,
          message:
            "No existing bill found for provided OrderId; cannot perform update.",
          data: null,
        });
      }

      // inactiveId-г хуучин баримтын ID-аар тохируулах
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

    return res.json(result);
  } catch (err: any) {
    console.error("[updateBill] Exception:", err);
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to update bill",
      data: null,
    });
  }
});

// ========== DELETE BILL ==========
app.post("/posapi/deleteBill", async (req, res) => {
  try {
    const payload = req.body as DeleteBillRequest;

    if (!payload.orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required",
        data: null,
      });
    }

    if (!payload.merchantTin) {
      return res.status(400).json({
        success: false,
        message: "merchantTin is required",
        data: null,
      });
    }

    const result = await posapi.DELETE_BILL(payload);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
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
