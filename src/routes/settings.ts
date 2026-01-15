// src/routes/settings.ts
import { Router } from "express";
import {
  getPosApiSettings,
  upsertPosApiSettings,
  deletePosApiSettings,
} from "../db.js";

export const settingsRouter = Router();

/**
 * GET /posapi/settings
 */
settingsRouter.get("/settings", async (_req, res) => {
  const settings = await getPosApiSettings();
  res.json({
    success: true,
    data: settings,
  });
});

/**
 * POST /posapi/settings
 * create/insert
 */
settingsRouter.post("/settings", async (req, res) => {
  try {
    const { merchantTin, posNo, districtCode, branchNo, billIdSuffix } =
      req.body ?? {};

    if (!merchantTin || !posNo) {
      return res.status(400).json({
        success: false,
        message: "merchantTin and posNo are required.",
      });
    }

    await upsertPosApiSettings({
      merchantTin,
      posNo,
      districtCode: districtCode ?? "",
      branchNo: branchNo ?? "",
      billIdSuffix: billIdSuffix ?? "01",
    });

    const saved = await getPosApiSettings();
    return res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to save settings",
    });
  }
});

/**
 * PUT /posapi/settings
 * update (same as post but 200)
 */
settingsRouter.put("/settings", async (req, res) => {
  try {
    const { merchantTin, posNo, districtCode, branchNo, billIdSuffix } =
      req.body ?? {};

    if (!merchantTin || !posNo) {
      return res.status(400).json({
        success: false,
        message: "merchantTin and posNo are required.",
      });
    }

    await upsertPosApiSettings({
      merchantTin,
      posNo,
      districtCode: districtCode ?? "",
      branchNo: branchNo ?? "",
      billIdSuffix: billIdSuffix ?? "01",
    });

    const saved = await getPosApiSettings();
    return res.json({
      success: true,
      data: saved,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to update settings",
    });
  }
});

/**
 * DELETE /posapi/settings
 */
settingsRouter.delete("/settings/:merchantTin", async (req, res) => {
  try {
    const { merchantTin } = req.params;

    if (!merchantTin) {
      return res.status(400).json({
        success: false,
        message: "merchantTin is required to delete.",
      });
    }

    await deletePosApiSettings(merchantTin);

    return res.json({
      success: true,
      message: `POS API settings for merchantTin=${merchantTin} deleted.`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? "Failed to delete settings",
    });
  }
});
