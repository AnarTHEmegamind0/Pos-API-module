// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";

import { PosApiWrapper } from "./wrapper";
import type { CReceipt } from "./types";
import type { PosApiLog as DomainPosApiLog } from "./log-types";

// DB helpers
import {
  initDb,
  saveOrderLog,
  saveReturnBillLog,
  findLogByOrderIdAndTin, // <--- use new one
  findLogByOrderId, // fallback
  saveUpdateBillLog,
} from "./db";

import { logsRouter } from "./routes/logs";
import { settingsRouter } from "./routes/settings";
import { ebarimtInfoRouter } from "./routes/ebarimt-info";
import { EReceiptType } from "./enums";

(async () => {
  await initDb();
  console.log("🗄️ Database ready.");
})();

console.log("✅ POS Service initialized. Waiting for requests...\n");

function normalizeDbLogToDomain(row: any): DomainPosApiLog {
  return {
    id: row?.id ?? "",
    date: new Date(row?.date ?? Date.now()),
    orderId: row?.orderId ?? "",
    merchantTin: row?.merchantTin ?? "",
    success: !!row?.success,
    message: row?.message ?? "",
    errorCode: row?.errorCode ?? undefined,
  };
}

const posapi = new PosApiWrapper({
  writeLogOrderData: async (apiResult, orderId, merchantTin) => {
    const payload = apiResult?.data ?? apiResult;
    await saveOrderLog(payload, orderId, merchantTin);

    console.log(
      `🧾 [Order Created]
  • OrderId: ${orderId}
  • Id: ${payload?.id ?? "(unknown)"}
  • MerchantTin: ${merchantTin}
  • Status: Successfully submitted to POS
`,
    );
  },

  writeLogReturnBill: async (
    oldLog: DomainPosApiLog,
    orderId: string,
    msg: string,
  ) => {
    await saveReturnBillLog(oldLog, orderId, msg);

    console.log(
      `↩️ [Order Returned]
  • OrderId: ${orderId}
  • Id: ${oldLog.id}
  • MerchantTin: ${oldLog.merchantTin ?? ""}
  • Message: ${msg}
  • Status: Successfully cancelled
`,
    );
  },

  // new signature: we get both orderId and merchantTin
  findPosApiLogByOrderId: async (orderId: string, merchantTin: string) => {
    let row = null;
    if (merchantTin) {
      row = await findLogByOrderIdAndTin(orderId, merchantTin);
    } else {
      // fallback for very old clients
      row = await findLogByOrderId(orderId);
    }

    if (!row) {
      console.log(
        `🔍 No log found for OrderId: ${orderId} (merchantTin=${merchantTin})`,
      );
      return null;
    }
    return normalizeDbLogToDomain(row);
  },

  notifyError: (msg: string) => console.error(`❌ [POS Error] → ${msg}\n`),
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
    service: "postapi-module",
    ts: new Date().toISOString(),
  });
});

// ADD
app.post("/posapi/addBill", async (req, res) => {
  const order = req.body as CReceipt;
  const result = await posapi.POST_BILL(order);
  res.json(result);
});

// ADD invoice
app.post("/posapi/addBillInvoice", async (req, res) => {
  const order = req.body as CReceipt;
  try {
    const invoiceType = order.CustomerTin
      ? EReceiptType.B2B_INVOICE
      : EReceiptType.B2C_INVOICE;

    const result = await posapi.POST_BILL_TYPE(order, invoiceType);
    return res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to add invoice bill",
      data: null,
    });
  }
});

// UPDATE bill
app.post("/posapi/updateBill", async (req, res) => {
  const order = req.body as CReceipt;

  try {
    const merchantTin = (order as any).MerchantTin ?? "";

    let existing = null;
    if (!order.PreviousReceiptId) {
      // now try with merchantTin first
      if (merchantTin) {
        existing = await findLogByOrderIdAndTin(order.OrderId, merchantTin);
      } else {
        existing = await findLogByOrderId(order.OrderId);
      }

      if (!existing?.id) {
        return res.status(404).json({
          success: false,
          message:
            "No existing bill found for provided OrderId; cannot perform update.",
          data: null,
        });
      }
      order.PreviousReceiptId = existing.id;
    }

    const result = await posapi.POST_BILL(order);

    if (result?.success && result?.data?.id) {
      const merchantTinForUpdate =
        (order as any).MerchantTin ?? existing?.merchantTin ?? "";

      await saveUpdateBillLog({
        orderId: order.OrderId,
        oldId: order.PreviousReceiptId!,
        newId: result.data.id,
        date: result.data.date ?? new Date(),
        merchantTin: merchantTinForUpdate,
      });
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to update bill",
      data: null,
    });
  }
});

// UPDATE bill invoice
app.post("/posapi/updateBillInvoice", async (req, res) => {
  const order = req.body as CReceipt;

  try {
    const merchantTin = (order as any).MerchantTin ?? "";

    let existing = null;
    if (!order.PreviousReceiptId) {
      if (merchantTin) {
        existing = await findLogByOrderIdAndTin(order.OrderId, merchantTin);
      } else {
        existing = await findLogByOrderId(order.OrderId);
      }

      if (!existing?.id) {
        return res.status(404).json({
          success: false,
          message:
            "No existing bill found for provided OrderId; cannot perform invoice update.",
          data: null,
        });
      }
      order.PreviousReceiptId = existing.id;
    }

    const invoiceType = order.CustomerTin
      ? EReceiptType.B2B_INVOICE
      : EReceiptType.B2C_INVOICE;

    const result = await posapi.POST_BILL_TYPE(order, invoiceType);

    if (result?.success && result?.data?.id) {
      const merchantTinForUpdate =
        (order as any).MerchantTin ?? existing?.merchantTin ?? "";

      await saveUpdateBillLog({
        orderId: order.OrderId,
        oldId: order.PreviousReceiptId!,
        newId: result.data.id,
        date: result.data.date ?? new Date(),
        merchantTin: merchantTinForUpdate,
      });
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to update invoice bill",
      data: null,
    });
  }
});

// DELETE
app.post("/posapi/deleteBill", async (req, res) => {
  try {
    const order: CReceipt = req.body;

    // make sure MerchantTin is present, otherwise wrapper will log “not found”
    if (!order.MerchantTin) {
      return res.status(400).json({
        success: false,
        message: "MerchantTin is required to delete a bill.",
        data: null,
      });
    }

    const result = await posapi.DELETE_BILL(order);
    if (!result) throw new Error("Result was null");
    return res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: null,
    });
  }
});

// SEND
app.post("/posapi/sendBills", async (_req, res) => {
  const result = await posapi.SEND_BILLS();
  res.json(result);
});

// routers
app.use("/posapi", settingsRouter);
app.use("/posapi", logsRouter);
app.use("/posapi", ebarimtInfoRouter);

app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

const PORT = Number(process.env.PORT) || 4001;
app.listen(PORT, () => {
  console.log(`🚀 POS Wrapper API running → http://localhost:${PORT}`);
  console.log(`➡️  Base endpoint: http://localhost:${PORT}/posapi`);
});
