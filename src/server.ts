// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { PosApiWrapper } from "./wrapper.js";

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

// -----------------------------
// Boot DB
// -----------------------------
(async () => {
  await initDb();
  console.log("Database ready.");
})();

console.log("POS Service initialized. Waiting for requests...\n");

// -----------------------------
// Wrapper (ST-Ebarimt)
// -----------------------------
const posapi = new PosApiWrapper({
  notifyError: (msg) => console.error(`[POS Error] ${msg}\n`),
  notifySuccess: (msg) => console.log(`[POS Success] ${msg}\n`),
});

const app = express();
app.disable("x-powered-by");

// -----------------------------
// Env + Safe logging utilities
// -----------------------------
const isProd = process.env.NODE_ENV === "production";

// mask helpers (TIN, etc.)
const maskTin = (tin?: string) =>
  tin && tin.length >= 4 ? `${tin.slice(0, 2)}******${tin.slice(-2)}` : tin;

const summarizeBillPayload = (p: any) => ({
  orderId: p?.orderId,
  merchantTin: maskTin(p?.merchantTin),
  customerTin: maskTin(p?.customerTin),
  type: p?.type,
  totalAmount: p?.totalAmount ?? p?.amount,
  force: !!p?.force,
  itemsCount: Array.isArray(p?.items) ? p.items.length : undefined,
});

const safeResultSummary = (r: any) => ({
  success: r?.success,
  status: r?.status,
  id: r?.data?.id,
  // qrData, lottery зэрэг эмзэг/урт талбаруудыг log хийхгүй
});

// controlled logs (prod дээр full dump хийхгүй)
const logInfo = (...args: any[]) => console.log(...args);
const logDebug = (...args: any[]) => {
  if (!isProd) console.log(...args);
};
const logWarn = (...args: any[]) => console.warn(...args);
const logError = (...args: any[]) => console.error(...args);

// -----------------------------
// CORS
// -----------------------------
const ALLOWED_ORIGINS = new Set([
  "https://erp.itsystem.mn",
  "https://cdn.itsystem.mn",
]);

if (!isProd) {
  ALLOWED_ORIGINS.add("http://localhost:3000");
  ALLOWED_ORIGINS.add("http://127.0.0.1:3000");
}

app.use(
  cors({
    origin: (origin, cb) => {
      // Origin байхгүй хүсэлтүүд: server-to-server, curl/postman гэх мэт.
      // Таны Apache rule no-origin-г 403 хийж байгаа тул бодлого зөрчихгүй.
      if (!origin) return cb(null, true);

      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);

      return cb(new Error("CORS: Origin not allowed"), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-KEY"],
    credentials: true,
    maxAge: 86400,
  })
);

// -----------------------------
// Body limit (DoS хамгаалалт)
// -----------------------------
app.use(express.json({ limit: "1mb" }));

// -----------------------------
// Health (info leak багатай)
// -----------------------------
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
  });
});

// ========== ADD BILL ==========
app.post("/posapi/addBill", async (req, res) => {
  try {
    const payload = req.body;

    // PROD дээр payload бүтнээр log хийхгүй
    logInfo("[addBill] Incoming:", summarizeBillPayload(payload));
    logDebug("[addBill] Incoming payload (debug):", payload);

    // === ДАВХЦАЛТ ШАЛГАХ (force=true биш үед) ===
    if (!payload.force) {
      const dupCheck = await checkOrderIdDuplicate(payload.orderId, payload.merchantTin);
      if (dupCheck.isDuplicate) {
        logWarn("[addBill] Duplicate orderId found:", {
          orderId: payload.orderId,
          merchantTin: maskTin(payload.merchantTin),
        });

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
      const existing = await checkOrderIdDuplicate(payload.orderId, payload.merchantTin);
      if (existing.isDuplicate && existing.existingBill?.ebarimtId) {
        payload.inactiveId = existing.existingBill.ebarimtId;
        logInfo("[addBill] Force update - inactiveId set:", payload.inactiveId);
      }
    }

    // Татвар тооцоолж, бүрэн формат үүсгэх
    const processResult = processBillRequest(payload);
    if (!processResult.success) {
      logWarn("[addBill] Process error:", processResult.message);
      return res.status(400).json({
        success: false,
        status: 0,
        message: processResult.message,
        data: null,
      });
    }

    const billRequest = processResult.data;

    // PROD дээр billRequest бүтнээр log хийхгүй
    logDebug("[addBill] Processed request (debug):", billRequest);

    // ST-Ebarimt руу илгээх
    const result = await posapi.POST_BILL(billRequest);

    // PROD дээр зөвхөн summary log
    logInfo("[addBill] ST response:", safeResultSummary(result));
    logDebug("[addBill] ST full response (debug):", result);

    return res.json(result);
  } catch (err: any) {
    logError("[addBill] Exception:", err);
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
    const payload = req.body;

    logInfo("[updateBill] Incoming:", summarizeBillPayload(payload));
    logDebug("[updateBill] Incoming payload (debug):", payload);

    const { ebarimtId } = payload;

    // Validation: ebarimtId эсвэл orderId байх ёстой
    if (!ebarimtId && !payload.orderId) {
      logWarn("[updateBill] Error: ebarimtId or orderId is required");
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
        logWarn("[updateBill] No existing bill for ebarimtId:", ebarimtId);
        return res.status(404).json({
          success: false,
          status: 0,
          message: `No existing bill found for ebarimtId: ${ebarimtId}`,
          data: null,
        });
      }

      // Хуучин баримтын orderId, merchantTin-ийг payload-д нэмэх
      if (!payload.orderId) payload.orderId = existingReceipt.orderId;
      if (!payload.merchantTin) payload.merchantTin = existingReceipt.merchantTin;

      // inactiveId тохируулах
      payload.inactiveId = ebarimtId;
    }

    // Татвар тооцоолж, бүрэн формат үүсгэх
    const processResult = processBillRequest(payload);
    if (!processResult.success) {
      logWarn("[updateBill] Process error:", processResult.message);
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
        logWarn("[updateBill] No existing bill for OrderId:", payload.orderId);
        return res.status(404).json({
          success: false,
          status: 0,
          message: "No existing bill found for provided OrderId; cannot perform update.",
          data: null,
        });
      }

      billRequest.inactiveId = existing.ebarimtId;
    }

    logDebug("[updateBill] Processed request (debug):", billRequest);

    // ST-Ebarimt руу илгээх
    const result = await posapi.POST_BILL(billRequest);

    logInfo("[updateBill] ST response:", safeResultSummary(result));
    logDebug("[updateBill] ST full response (debug):", result);

    // Амжилттай болсны дараа pos_api_update_logs-д хадгалах
    if (result.success && billRequest.inactiveId && result.data?.id) {
      await saveUpdateBillLog({
        orderId: billRequest.orderId,
        oldId: billRequest.inactiveId,
        newId: result.data.id,
        date: new Date(),
        merchantTin: billRequest.merchantTin,
      });

      logInfo("[updateBill] Log saved:", {
        orderId: billRequest.orderId,
        oldId: billRequest.inactiveId,
        newId: result.data.id,
        merchantTin: maskTin(billRequest.merchantTin),
      });
    }

    return res.json(result);
  } catch (err: any) {
    logError("[updateBill] Exception:", err);
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
    const payload = req.body;

    if (!payload.ebarimtId) {
      return res.status(400).json({
        success: false,
        status: 0,
        message: "ДДТД is required",
        data: null,
      });
    }

    const result = await posapi.DELETE_BILL(payload);

    // PROD дээр summary log
    logInfo("[deleteBill] ST response:", safeResultSummary(result));
    logDebug("[deleteBill] ST full response (debug):", result);

    return res.json(result);
  } catch (err: any) {
    logError("[deleteBill] Exception:", err);
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
    logInfo("[sendBills] result:", safeResultSummary(result));
    logDebug("[sendBills] full result (debug):", result);
    return res.json(result);
  } catch (err: any) {
    logError("[sendBills] Exception:", err);
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
    logError("[receipt] Exception:", err);
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

app.listen(PORT, "127.0.0.1", () => {
  console.log(`POS Wrapper API running -> http://127.0.0.1:${PORT}`);
  console.log(`Base endpoint: http://127.0.0.1:${PORT}/posapi`);
});


// ========== DAILY SCHEDULED TASK TO SEND BILLS ==========
cron.schedule(
  "59 23 * * *",
  async () => {
    logInfo("[cron] Sending today's bills to Ebarimt...");
    try {
      const result = await posapi.SEND_BILLS();
      logInfo("[cron] SEND_BILLS result:", safeResultSummary(result));
      logDebug("[cron] SEND_BILLS full (debug):", result);
    } catch (err: any) {
      logError("[cron] Error:", err);
    }
  },
  { timezone: "Asia/Ulaanbaatar" }
);
