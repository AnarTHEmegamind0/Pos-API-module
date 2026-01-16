 // src/db.ts
import pg from "pg";
import { PosApiLog, PosApiSettings, PosApiUpdateLog } from "./log-types.js";
import type { DirectBillRequest, DirectBillResponse } from "./types.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/posapi",
    });
  }
  return pool;
}

export async function initDb(): Promise<void> {
  const p = getPool();

  // main logs
  await p.query(`
    CREATE TABLE IF NOT EXISTS pos_api_logs (
      log_id       SERIAL PRIMARY KEY,
      order_id     TEXT NOT NULL,
      id           TEXT NOT NULL,
      date         TIMESTAMPTZ NOT NULL,
      merchant_tin TEXT NOT NULL DEFAULT '',
      success      BOOLEAN NOT NULL,
      message      TEXT NOT NULL,
      error_code   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(order_id, merchant_tin)
    );
  `);

  // return/cancel logs
  await p.query(`
    CREATE TABLE IF NOT EXISTS pos_api_return_logs (
      log_id       SERIAL PRIMARY KEY,
      order_id     TEXT NOT NULL,
      id           TEXT NOT NULL,
      return_date  TIMESTAMPTZ NOT NULL,
      merchant_tin TEXT NOT NULL DEFAULT '',
      success      BOOLEAN NOT NULL,
      message      TEXT NOT NULL,
      error_code   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // update link logs
  await p.query(`
    CREATE TABLE IF NOT EXISTS pos_api_update_logs (
      log_id       SERIAL PRIMARY KEY,
      order_id     TEXT NOT NULL,
      old_id       TEXT NOT NULL,
      new_id       TEXT NOT NULL,
      date         TIMESTAMPTZ NOT NULL,
      merchant_tin TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(order_id, old_id, new_id)
    );
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS pos_api_settings (
      merchant_tin   TEXT PRIMARY KEY,
      pos_no         TEXT NOT NULL,
      district_code  TEXT NOT NULL,
      branch_no      TEXT NOT NULL,
      bill_id_suffix TEXT NOT NULL,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Create indexes if not exists
  await p.query(
    `CREATE INDEX IF NOT EXISTS idx_pos_logs_order_id ON pos_api_logs(order_id);`,
  );
  await p.query(
    `CREATE INDEX IF NOT EXISTS idx_pos_retlogs_order_id ON pos_api_return_logs(order_id);`,
  );
  await p.query(
    `CREATE INDEX IF NOT EXISTS idx_pos_updlogs_order_id ON pos_api_update_logs(order_id);`,
  );
  await p.query(
    `CREATE INDEX IF NOT EXISTS idx_pos_updlogs_old_id ON pos_api_update_logs(old_id);`,
  );
  await p.query(
    `CREATE INDEX IF NOT EXISTS idx_pos_updlogs_new_id ON pos_api_update_logs(new_id);`,
  );

  // Receipts table - бүрэн JSON хадгалах
  await p.query(`
    CREATE TABLE IF NOT EXISTS pos_api_receipts (
      id             SERIAL PRIMARY KEY,
      order_id       TEXT NOT NULL,
      merchant_tin   TEXT NOT NULL,
      
      request_json   JSONB NOT NULL,
      response_json  JSONB,
      ebarimt_id     TEXT,
      
      total_amount   DECIMAL(18,2),
      total_vat      DECIMAL(18,2),
      total_city_tax DECIMAL(18,2),
      receipt_type   TEXT,
      
      success        BOOLEAN NOT NULL DEFAULT false,
      error_message  TEXT,
      
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      
      UNIQUE(order_id, merchant_tin)
    );
  `);

  await p.query(
    `CREATE INDEX IF NOT EXISTS idx_pos_receipts_order_id ON pos_api_receipts(order_id);`,
  );
  await p.query(
    `CREATE INDEX IF NOT EXISTS idx_pos_receipts_merchant_tin ON pos_api_receipts(merchant_tin);`,
  );
  await p.query(
    `CREATE INDEX IF NOT EXISTS idx_pos_receipts_ebarimt_id ON pos_api_receipts(ebarimt_id);`,
  );
}

/**
 * Upsert order log (1 row per (order_id, merchant_tin))
 */
export async function saveOrderLog(
  apiResult: any,
  orderId: string,
  merchantTin: string,
): Promise<void> {
  const id: string = apiResult?.id ?? "";
  const rawDate: string | number | Date = apiResult?.date ?? new Date();
  const dateIso = toIso(rawDate);

  const success = true;
  const message = "Successfully submitted to POS";
  const errorCode: string | null = null;

  const p = getPool();
  await p.query(
    `
    INSERT INTO pos_api_logs (order_id, id, date, merchant_tin, success, message, error_code)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT(order_id, merchant_tin) DO UPDATE SET
      id          = EXCLUDED.id,
      date        = EXCLUDED.date,
      merchant_tin = EXCLUDED.merchant_tin,
      success     = EXCLUDED.success,
      message     = EXCLUDED.message,
      error_code  = EXCLUDED.error_code,
      updated_at  = NOW()
    `,
    [orderId, id, dateIso, merchantTin ?? "", success, message, errorCode],
  );
}

/** Find order log by orderId + merchantTin (preferred) */
export async function findLogByOrderIdAndTin(
  orderId: string,
  merchantTin: string,
): Promise<PosApiLog | null> {
  const p = getPool();
  const result = await p.query(
    `
     SELECT order_id, id, date, merchant_tin, success, message, error_code, created_at, updated_at
     FROM pos_api_logs
     WHERE order_id = $1 AND merchant_tin = $2
    `,
    [orderId, merchantTin ?? ""],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    orderId: row.order_id,
    id: row.id,
    date: new Date(row.date),
    merchantTin: row.merchant_tin ?? "",
    success: row.success,
    message: row.message,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Backward compat: if some old code still calls by orderId only,
 * we'll just take the latest by updated_at.
 */
export async function findLogByOrderId(
  orderId: string,
): Promise<PosApiLog | null> {
  const p = getPool();
  const result = await p.query(
    `
     SELECT order_id, id, date, merchant_tin, success, message, error_code, created_at, updated_at
     FROM pos_api_logs
     WHERE order_id = $1
     ORDER BY updated_at DESC
     LIMIT 1
    `,
    [orderId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    orderId: row.order_id,
    id: row.id,
    date: new Date(row.date),
    merchantTin: row.merchant_tin ?? "",
    success: row.success,
    message: row.message,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Append a return/cancel log */
export async function saveReturnBillLog(
  oldLog: PosApiLog,
  orderId: string,
  resultMessage: string,
  opts?: {
    errorCode?: string | null;
    success?: boolean;
    returnDate?: Date | string | number;
  },
): Promise<void> {
  const p = getPool();
  const success = opts?.success ?? true;
  const returnDateIso = toIso(opts?.returnDate ?? new Date());
  const errorCode = opts?.errorCode ?? null;

  await p.query(
    `
    INSERT INTO pos_api_return_logs (order_id, id, return_date, merchant_tin, success, message, error_code)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      orderId,
      oldLog.id,
      returnDateIso,
      oldLog.merchantTin ?? "",
      success,
      resultMessage,
      errorCode,
    ],
  );
}

export async function saveUpdateBillLog(input: {
  orderId: string;
  oldId: string;
  newId: string;
  date: Date | string | number;
  merchantTin: string;
}): Promise<void> {
  const p = getPool();
  const dateIso = toIso(input.date);

  await p.query(
    `
    INSERT INTO pos_api_update_logs (order_id, old_id, new_id, date, merchant_tin)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT DO NOTHING
    `,
    [input.orderId, input.oldId, input.newId, dateIso, input.merchantTin ?? ""],
  );
}

export async function findUpdatesByOrderId(
  orderId: string,
): Promise<PosApiUpdateLog[]> {
  const p = getPool();
  const result = await p.query(
    `
    SELECT order_id, old_id, new_id, date, merchant_tin, created_at
    FROM pos_api_update_logs
    WHERE order_id = $1
    ORDER BY date DESC, created_at DESC
    `,
    [orderId],
  );

  return result.rows.map((r: any) => ({
    orderId: r.order_id,
    oldId: r.old_id,
    newId: r.new_id,
    date: new Date(r.date),
    merchantTin: r.merchant_tin ?? "",
    createdAt: r.created_at,
  }));
}

/** Helper to coerce to ISO string */
function toIso(d: Date | string | number): string {
  const date =
    d instanceof Date
      ? d
      : typeof d === "string" || typeof d === "number"
        ? new Date(d)
        : new Date();
  return date.toISOString();
}

export async function getPosApiSettings(): Promise<PosApiSettings | null> {
  const p = getPool();
  const result = await p.query(
    `SELECT merchant_tin, pos_no, district_code, branch_no, bill_id_suffix, updated_at
     FROM pos_api_settings ORDER BY updated_at DESC LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    merchantTin: row.merchant_tin,
    posNo: row.pos_no,
    districtCode: row.district_code,
    branchNo: row.branch_no,
    billIdSuffix: row.bill_id_suffix,
    updatedAt: row.updated_at,
  };
}

export async function getPosApiSettingsByTin(
  merchantTin: string,
): Promise<PosApiSettings | null> {
  const p = getPool();
  const result = await p.query(
    `
    SELECT merchant_tin, pos_no, district_code, branch_no, bill_id_suffix, updated_at
    FROM pos_api_settings
    WHERE merchant_tin = $1
    `,
    [merchantTin],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    merchantTin: row.merchant_tin,
    posNo: row.pos_no,
    districtCode: row.district_code,
    branchNo: row.branch_no,
    billIdSuffix: row.bill_id_suffix,
    updatedAt: row.updated_at,
  };
}

export async function upsertPosApiSettings(
  input: PosApiSettings,
): Promise<void> {
  const p = getPool();
  await p.query(
    `
    INSERT INTO pos_api_settings (merchant_tin, pos_no, district_code, branch_no, bill_id_suffix)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT(merchant_tin) DO UPDATE SET
      pos_no        = EXCLUDED.pos_no,
      district_code = EXCLUDED.district_code,
      branch_no     = EXCLUDED.branch_no,
      bill_id_suffix = EXCLUDED.bill_id_suffix,
      updated_at    = NOW()
    `,
    [
      input.merchantTin,
      input.posNo,
      input.districtCode,
      input.branchNo,
      input.billIdSuffix,
    ],
  );
}

export async function deletePosApiSettings(merchantTin: string): Promise<void> {
  const p = getPool();
  await p.query(`DELETE FROM pos_api_settings WHERE merchant_tin = $1`, [
    merchantTin,
  ]);
}

// For graceful shutdown
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ========== Receipt Functions ==========

export interface SaveReceiptInput {
  orderId: string;
  merchantTin: string;
  request: Omit<DirectBillRequest, "orderId">;
  response: DirectBillResponse | null;
  success: boolean;
  errorMessage?: string | null;
}

export interface ReceiptRecord {
  id: number;
  orderId: string;
  merchantTin: string;
  requestJson: DirectBillRequest;
  responseJson: DirectBillResponse | null;
  ebarimtId: string | null;
  totalAmount: number;
  totalVat: number;
  totalCityTax: number;
  receiptType: string;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Receipt хадгалах (upsert)
 */
export async function saveReceipt(input: SaveReceiptInput): Promise<void> {
  const p = getPool();

  const ebarimtId = input.response?.id ?? null;
  const totalAmount = input.request.totalAmount ?? 0;
  const totalVat = input.request.totalVAT ?? 0;
  const totalCityTax = input.request.totalCityTax ?? 0;
  const receiptType = input.request.type ?? "";

  await p.query(
    `
    INSERT INTO pos_api_receipts (
      order_id, merchant_tin, 
      ebarimt_id, 
      success, error_message
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT(order_id, merchant_tin) DO UPDATE SET
      ebarimt_id     = EXCLUDED.ebarimt_id,
      total_amount   = EXCLUDED.total_amount,
      total_vat      = EXCLUDED.total_vat,
      total_city_tax = EXCLUDED.total_city_tax,
      receipt_type   = EXCLUDED.receipt_type,
      success        = EXCLUDED.success,
      error_message  = EXCLUDED.error_message,
      updated_at     = NOW()
    `,
    [
      input.orderId,
      input.merchantTin,
      JSON.stringify(input.request),
      input.response ? JSON.stringify(input.response) : null,
      ebarimtId,
      totalAmount,
      totalVat,
      totalCityTax,
      receiptType,
      input.success,
      input.errorMessage ?? null,
    ],
  );
}

/**
 * Receipt хайх (orderId + merchantTin)
 */
export async function findReceiptByOrderId(
  orderId: string,
  merchantTin: string,
): Promise<ReceiptRecord | null> {
  const p = getPool();
  const result = await p.query(
    `
    SELECT 
      id, order_id, merchant_tin, request_json, response_json,
      ebarimt_id,
      total_amount, total_vat, total_city_tax, receipt_type,
      success, error_message, created_at, updated_at
    FROM pos_api_receipts
    WHERE order_id = $1 AND merchant_tin = $2
    `,
    [orderId, merchantTin],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    orderId: row.order_id,
    merchantTin: row.merchant_tin,
    requestJson: row.request_json,
    responseJson: row.response_json,
    ebarimtId: row.ebarimt_id,
    totalAmount: parseFloat(row.total_amount),
    totalVat: parseFloat(row.total_vat),
    totalCityTax: parseFloat(row.total_city_tax),
    receiptType: row.receipt_type,
    success: row.success,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Receipt хайх (orderId only - fallback)
 */
export async function findReceiptByOrderIdOnly(
  orderId: string,
): Promise<ReceiptRecord | null> {
  const p = getPool();
  const result = await p.query(
    `
    SELECT 
      id, order_id, merchant_tin, request_json, response_json,
      ebarimt_id, 
      total_amount, total_vat, total_city_tax, receipt_type,
      success, error_message, created_at, updated_at
    FROM pos_api_receipts
    WHERE order_id = $1
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [orderId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    orderId: row.order_id,
    merchantTin: row.merchant_tin,
    requestJson: row.request_json,
    responseJson: row.response_json,
    ebarimtId: row.ebarimt_id,
    totalAmount: parseFloat(row.total_amount),
    totalVat: parseFloat(row.total_vat),
    totalCityTax: parseFloat(row.total_city_tax),
    receiptType: row.receipt_type,
    success: row.success,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
