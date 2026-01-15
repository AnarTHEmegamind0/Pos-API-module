import "dotenv/config";

// ST-Ebarimt API URL (local POS bridge)
export const POS_API_BASE_URL =
  process.env.POS_API_BASE_URL ?? "http://127.0.0.1:7080";
