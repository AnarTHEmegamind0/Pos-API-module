import "dotenv/config";

export const POS_API_BASE_URL =
  process.env.POS_API_BASE_URL ?? "http://127.0.0.1:7080";

// Default POS Settings from environment variables
export const DEFAULT_SETTINGS = {
  merchantTin: process.env.MERCHANT_TIN ?? "",
  posNo: process.env.POS_NO ?? "",
  districtCode: process.env.DISTRICT_CODE ?? "",
  branchNo: process.env.BRANCH_NO ?? "",
  billIdSuffix: process.env.BILL_ID_SUFFIX ?? "01",
};
