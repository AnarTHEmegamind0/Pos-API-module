// src/routes/ebarimt-info.ts
import { Router } from "express";

export const ebarimtInfoRouter = Router();

// you can lift this to env if needed
const EBARIMT_BASE = "https://api.ebarimt.mn/api";

async function safeFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ebarimt api error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as any;
  // they return { msg, status, data }
  if (json?.status !== 200) {
    throw new Error(
      `ebarimt api returned non-200 status: ${json?.status} - ${json?.msg}`
    );
  }
  return json.data as T;
}

/**
 * GET /posapi/info/branches
 * proxies → https://api.ebarimt.mn/api/info/check/getBranchInfo
 */
ebarimtInfoRouter.get("/info/branches", async (_req, res) => {
  try {
    const data = await safeFetch<any[]>(
      `${EBARIMT_BASE}/info/check/getBranchInfo`
    );
    return res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to fetch branch info",
    });
  }
});

/**
 * GET /posapi/info/tin-by-reg/:regNo
 * proxies → https://api.ebarimt.mn/api/info/check/getTinInfo?regNo=1234567
 *
 * returns number in `data` (their API)
 */
ebarimtInfoRouter.get("/info/tin-by-reg/:regNo", async (req, res) => {
  try {
    const { regNo } = req.params;
    if (!regNo) {
      return res.status(400).json({
        success: false,
        message: "regNo is required",
      });
    }

    const data = await safeFetch<number>(
      `${EBARIMT_BASE}/info/check/getTinInfo?regNo=${encodeURIComponent(regNo)}`
    );

    return res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to fetch TIN by regNo",
    });
  }
});

/**
 * GET /posapi/info/tin/:tin
 * proxies → https://api.ebarimt.mn/api/info/check/getInfo?tin=93202263351
 */
ebarimtInfoRouter.get("/info/tin/:tin", async (req, res) => {
  try {
    const { tin } = req.params;
    if (!tin) {
      return res.status(400).json({
        success: false,
        message: "tin is required",
      });
    }

    const data = await safeFetch<any>(
      `${EBARIMT_BASE}/info/check/getInfo?tin=${encodeURIComponent(tin)}`
    );

    return res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to fetch info by TIN",
    });
  }
});

/**
 * GET /posapi/info/product-tax-codes
 * proxies → https://api.ebarimt.mn/api/receipt/receipt/getProductTaxCode
 */
ebarimtInfoRouter.get("/info/product-tax-codes", async (_req, res) => {
  try {
    const data = await safeFetch<any[]>(
      `${EBARIMT_BASE}/receipt/receipt/getProductTaxCode`
    );
    return res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to fetch product tax codes",
    });
  }
});
