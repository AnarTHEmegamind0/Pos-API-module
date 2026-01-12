import type { Result } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

export async function executeHttpRequest<T>(
  url: string,
  method: "GET" | "POST" | "DELETE",
  data?: unknown,
  deserializer?: (s: string) => T
): Promise<Result<T>> {
  const rez: Result<T> = { success: false, message: "", data: null };

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const init: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    };

    if (data && (method === "POST" || method === "DELETE")) {
      init.body = JSON.stringify(data);
    }

    let resp: Response;
    try {
      resp = await fetch(url, init);
    } catch (err: any) {
      rez.message = `Network error: ${err?.message ?? String(err)}\nURL: ${url}`;
      return rez;
    } finally {
      clearTimeout(id);
    }

    const okEmpty = resp.ok && (method === "DELETE" || resp.status === 204);
    const text = okEmpty ? "" : await resp.text();

    if (!resp.ok) {
      rez.message = `HTTP Error: ${resp.status} ${resp.statusText}\nURL: ${url}\nResponse: ${text}`;
      return rez;
    }

    if (deserializer) {
      try {
        const parsed = deserializer(text);
        rez.success = true;
        rez.data = parsed;
        rez.message =
          method === "POST"
            ? "Data posted successfully"
            : method === "DELETE"
              ? "Data deleted successfully"
              : "Data retrieved successfully";
        return rez;
      } catch (e: any) {
        rez.message = `JSON deserialization error: ${e?.message ?? e}\nResponse content: ${text}`;
        return rez;
      }
    } else {
      // @ts-expect-error allow returning raw text for callers that expect string
      rez.data = text;
      rez.success = true;
      rez.message =
        method === "POST"
          ? "Data posted successfully"
          : method === "DELETE"
            ? "Data deleted successfully"
            : "Data retrieved successfully";
      return rez;
    }
  } catch (e: any) {
    rez.message = `Error occurred while processing ${method} request:\n${e?.stack ?? e}`;
    return rez;
  }
}
