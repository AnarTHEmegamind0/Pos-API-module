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
      `SELECT order_id, id, date, success, message, error_code, created_at, updated_at
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
