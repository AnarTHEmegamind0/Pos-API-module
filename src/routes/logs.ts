// src/routes/logs.ts
import { Router } from "express";
import { getPool, findLogByOrderId, findUpdatesByOrderId } from "../db.js";

export const logsRouter = Router();

// local normalizer for order logs
function normalizeOrderRow(row: any) {
  return {
    orderId: row.order_id,
    id: row.id,
    date: new Date(row.date),
    success: row.success,
    message: row.message,
    errorCode: row.error_code ?? undefined,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * GET /posapi/logs
 * List order logs (optional ?orderId=...). Supports pagination.
 */
logsRouter.get("/logs", async (req, res) => {
  try {
    const pool = getPool();
    const orderId = (req.query.orderId as string) || undefined;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 50)));
    const offset = Math.max(0, Number(req.query.offset ?? 0));

    // single order lookup
    if (orderId) {
      const row = await findLogByOrderId(orderId);
      const data = row ? [normalizeOrderRow(row)] : [];
      return res.json({
        ok: true,
        meta: { total: data.length, limit, offset },
        data,
      });
    }

    // list all
    const result = await pool.query(
      `SELECT *
         FROM pos_api_logs
        ORDER BY date DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM pos_api_logs`,
    );
    const count = parseInt(countResult.rows[0].count, 10);

    res.json({
      ok: true,
      meta: { total: count, limit, offset },
      data: result.rows.map(normalizeOrderRow),
    });
  } catch (e: any) {
    res
      .status(500)
      .json({ ok: false, error: e?.message ?? "Failed to list logs" });
  }
});

/**
 * GET /posapi/returns
 * List return/cancel logs (optional ?orderId=...). Supports pagination.
 */
logsRouter.get("/returns", async (req, res) => {
  try {
    const pool = getPool();
    const orderId = (req.query.orderId as string) || undefined;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 50)));
    const offset = Math.max(0, Number(req.query.offset ?? 0));

    if (orderId) {
      const result = await pool.query(
        `SELECT order_id, id, return_date, success, message, error_code, created_at
           FROM pos_api_return_logs
          WHERE order_id = $1
          ORDER BY return_date DESC
          LIMIT $2 OFFSET $3`,
        [orderId, limit, offset],
      );
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM pos_api_return_logs WHERE order_id = $1`,
        [orderId],
      );
      const count = parseInt(countResult.rows[0].count, 10);
      return res.json({
        ok: true,
        meta: { total: count, limit, offset },
        data: result.rows.map((r: any) => ({
          orderId: r.order_id,
          id: r.id,
          returnDate: new Date(r.return_date),
          success: r.success,
          message: r.message,
          errorCode: r.error_code ?? undefined,
          createdAt: r.created_at ?? null,
        })),
      });
    }

    const result = await pool.query(
      `SELECT order_id, id, return_date, success, message, error_code, created_at
         FROM pos_api_return_logs
        ORDER BY return_date DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM pos_api_return_logs`,
    );
    const count = parseInt(countResult.rows[0].count, 10);

    res.json({
      ok: true,
      meta: { total: count, limit, offset },
      data: result.rows.map((r: any) => ({
        orderId: r.order_id,
        id: r.id,
        returnDate: new Date(r.return_date),
        success: r.success,
        message: r.message,
        errorCode: r.error_code ?? undefined,
        createdAt: r.created_at ?? null,
      })),
    });
  } catch (e: any) {
    res
      .status(500)
      .json({ ok: false, error: e?.message ?? "Failed to list returns" });
  }
});

/**
 * GET /posapi/updates
 * List update linkages (optional ?orderId=...). Supports pagination when not filtered.
 */
logsRouter.get("/updates", async (req, res) => {
  try {
    const pool = getPool();
    const orderId = (req.query.orderId as string) || undefined;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 50)));
    const offset = Math.max(0, Number(req.query.offset ?? 0));

    if (orderId) {
      const data = await findUpdatesByOrderId(orderId);
      return res.json({
        ok: true,
        meta: { total: data.length, limit: data.length, offset: 0 },
        data,
      });
    }

    const result = await pool.query(
      `SELECT order_id, old_id, new_id, date, created_at
         FROM pos_api_update_logs
     ORDER BY date DESC, created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM pos_api_update_logs`,
    );
    const count = parseInt(countResult.rows[0].count, 10);

    res.json({
      ok: true,
      meta: { total: count, limit, offset },
      data: result.rows.map((r: any) => ({
        orderId: r.order_id,
        oldId: r.old_id,
        newId: r.new_id,
        date: new Date(r.date),
        createdAt: r.created_at ?? null,
      })),
    });
  } catch (e: any) {
    res
      .status(500)
      .json({ ok: false, error: e?.message ?? "Failed to list updates" });
  }
});

/**
 * GET /posapi/response-logs
 * List response logs from pos_api_receipts table.
 * Query params:
 *   - orderId: filter by order ID
 *   - status: filter by response_status (ERROR, SUCCESS, PAYMENT)
 *   - limit: max records (default 50, max 500)
 *   - offset: pagination offset
 */
logsRouter.get("/response-logs", async (req, res) => {
  try {
    const pool = getPool();
    const orderId = (req.query.orderId as string) || undefined;
    const status = (req.query.status as string) || undefined;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 50)));
    const offset = Math.max(0, Number(req.query.offset ?? 0));

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (orderId) {
      conditions.push(`order_id = $${paramIndex++}`);
      params.push(orderId);
    }

    if (status) {
      conditions.push(`response_status = $${paramIndex++}`);
      params.push(status.toUpperCase());
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Query data
    const result = await pool.query(
      `SELECT 
        id, order_id, merchant_tin, ebarimt_id,
        total_amount, total_vat, total_city_tax, receipt_type,
        success, error_message,
        response_status, response_message, response_date,
        created_at, updated_at
      FROM pos_api_receipts
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset],
    );

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM pos_api_receipts ${whereClause}`,
      params,
    );
    const count = parseInt(countResult.rows[0].count, 10);

    res.json({
      ok: true,
      meta: { total: count, limit, offset },
      data: result.rows.map((r: any) => ({
        id: r.id,
        orderId: r.order_id,
        merchantTin: r.merchant_tin,
        ebarimtId: r.ebarimt_id,
        totalAmount: parseFloat(r.total_amount),
        totalVat: parseFloat(r.total_vat),
        totalCityTax: parseFloat(r.total_city_tax),
        receiptType: r.receipt_type,
        success: r.success,
        errorMessage: r.error_message,
        responseStatus: r.response_status,
        responseMessage: r.response_message,
        responseDate: r.response_date ? new Date(r.response_date) : null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (e: any) {
    res
      .status(500)
      .json({ ok: false, error: e?.message ?? "Failed to list response logs" });
  }
});

/**
 * GET /posapi/response-logs/:orderId
 * Get response log by order ID
 */
logsRouter.get("/response-logs/:orderId", async (req, res) => {
  try {
    const pool = getPool();
    const { orderId } = req.params;
    const merchantTin = (req.query.merchantTin as string) || undefined;

    let whereClause = "WHERE order_id = $1";
    const params: any[] = [orderId];

    if (merchantTin) {
      whereClause += " AND merchant_tin = $2";
      params.push(merchantTin);
    }

    const result = await pool.query(
      `SELECT 
        id, order_id, merchant_tin, ebarimt_id,
        total_amount, total_vat, total_city_tax, receipt_type,
        success, error_message,
        response_status, response_message, response_date,
        created_at, updated_at
      FROM pos_api_receipts
      ${whereClause}
      ORDER BY updated_at DESC`,
      params,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Response log not found",
      });
    }

    const data = result.rows.map((r: any) => ({
      id: r.id,
      orderId: r.order_id,
      merchantTin: r.merchant_tin,
      ebarimtId: r.ebarimt_id,
      totalAmount: parseFloat(r.total_amount),
      totalVat: parseFloat(r.total_vat),
      totalCityTax: parseFloat(r.total_city_tax),
      receiptType: r.receipt_type,
      success: r.success,
      errorMessage: r.error_message,
      responseStatus: r.response_status,
      responseMessage: r.response_message,
      responseDate: r.response_date ? new Date(r.response_date) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({
      ok: true,
      data: data.length === 1 ? data[0] : data,
    });
  } catch (e: any) {
    res
      .status(500)
      .json({ ok: false, error: e?.message ?? "Failed to get response log" });
  }
});
