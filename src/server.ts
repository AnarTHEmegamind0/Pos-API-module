// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";

import { PosApiWrapper } from "./wrapper.js";
import type { DirectBillRequest, DeleteBillRequest } from "./types.js";

// DB helpers
import {
  initDb,
  findReceiptByOrderId,
  findReceiptByOrderIdOnly,
} from "./db.js";

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
      "https://pos.itsystem.mn", // Production
      "http://pos.itsystem.mn",
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
    const payload = req.body as DirectBillRequest;

    // Validation
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

    if (!payload.receipts || payload.receipts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "receipts array is required and must not be empty",
        data: null,
      });
    }

    const result = await posapi.POST_BILL(payload);
    return res.json(result);
  } catch (err: any) {
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
    const payload = req.body as DirectBillRequest;
    const { orderId, merchantTin } = payload;

    // Validation
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required",
        data: null,
      });
    }

    // Хуучин баримт хайх
    let existing = null;
    if (!payload.inactiveId) {
      if (merchantTin) {
        existing = await findReceiptByOrderId(orderId, merchantTin);
      } else {
        existing = await findReceiptByOrderIdOnly(orderId);
      }

      if (!existing?.ebarimtId) {
        return res.status(404).json({
          success: false,
          message:
            "No existing bill found for provided OrderId; cannot perform update.",
          data: null,
        });
      }

      // inactiveId-г хуучин баримтын ID-аар тохируулах
      payload.inactiveId = existing.ebarimtId;
    }

    const result = await posapi.POST_BILL(payload);
    return res.json(result);
  } catch (err: any) {
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
