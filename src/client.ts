import { POS_API_BASE_URL } from "./config.js";

import type { TtdResult, TinResult } from "./types.js";
import { executeHttpRequest } from "./http.js";

// ----- low-level GET helper -----
async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) throw new Error(`Request failed with status ${r.status}`);
  const text = await r.text();
  return JSON.parse(text) as T;
}

// ----- REST calls to local POS bridge -----
export async function postData(postData: string) {
  return executeHttpRequest<any>(
    `${POS_API_BASE_URL}/rest/receipt`,
    "POST",
    JSON.parse(postData),
    (s: string) => JSON.parse(s),
  );
}

export async function sendData() {
  return executeHttpRequest<string>(
    `${POS_API_BASE_URL}/rest/sendData`,
    "GET",
    undefined,
    (s: string) => s,
  );
}

export async function deleteData(id: string, date: string) {
  return executeHttpRequest<string>(
    `${POS_API_BASE_URL}/rest/receipt`,
    "DELETE",
    { id, date },
    (s: string) => s,
  );
}

export async function getInfo() {
  return (await fetch(`${POS_API_BASE_URL}/rest/info`)).json();
}

export function getTTD(regNo: string): Promise<TtdResult> {
  const encoded = encodeURIComponent((regNo ?? "").trim());
  const url = `https://api.ebarimt.mn/api/info/check/getTinInfo?regNo=${encoded}`;
  return getJson<TtdResult>(url);
}

export function getTin(tinNo: string): Promise<TinResult> {
  const encoded = encodeURIComponent((tinNo ?? "").trim());
  const url = `https://api.ebarimt.mn/api/info/check/getInfo?tin=${encoded}`;
  return getJson<TinResult>(url);
}

export async function getCombinedTinInfo(
  regNo: string,
): Promise<TinResult | null> {
  try {
    const ttd = await getTTD(regNo);
    if (!ttd?.data) {
      // original showed MessageBox; here we just return null
      return null;
    }
    return await getTin(ttd.data);
  } catch {
    return null;
  }
}
