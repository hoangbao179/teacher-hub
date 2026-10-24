import type { CreatePdfBatchRequest, PdfBatch, PdfBatchList, PdfCapabilities, PdfDownloadTicket, PdfJob } from "@teacher/shared";
import { api, apiPostPdfBlob } from "./client";

const root = "/api/public/pdf";
const json = (value: unknown) => JSON.stringify(value);

/** PDF API contracts come from @teacher/shared; keep cloud keys/tickets outside URLs. */
export const pdfApi = {
  capabilities: () => api<PdfCapabilities>(root + "/capabilities"),
  session: () => api<{available: boolean}>(root + "/session", { method: "POST" }),
  list: (page = 1) => api<PdfBatchList>(root + "/batches?page=" + page),
  detail: (id: string) => api<PdfBatch>(root + "/batches/" + id),
  create: (input: CreatePdfBatchRequest, key: string) => api<PdfBatch>(root + "/batches", {
    method: "POST", headers: { "Idempotency-Key": key }, body: json(input),
  }),
  retry: (id: string, key: string) => api<PdfJob>(root + "/jobs/" + id + "/retry", {
    method: "POST", headers: { "Idempotency-Key": key },
  }),
  ticket: (id: string) => api<PdfDownloadTicket>(root + "/jobs/" + id + "/download-ticket", { method: "POST" }),
  download: (path: string, ticket: string, signal?: AbortSignal) => {
    if (!/^\/api\/public\/pdf\/jobs\/[0-9a-f-]{36}\/download$/.test(path)) throw new Error("Invalid PDF download path");
    return apiPostPdfBlob(path, { ticket }, signal);
  },
};

/** Exactly the two public Drive link forms accepted by Teacher Hub server v1. */
export function pdfDriveId(raw: string): string | null {
  if (raw.length > 512) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com" ||
      url.port || url.username || url.password || url.hash) return null;
    const match = /^\/file\/d\/([A-Za-z0-9_-]{10,128})\/view$/.exec(url.pathname);
    if (match && !url.search) return match[1];
    if (url.pathname === "/open" && [...url.searchParams.keys()].length === 1 && url.searchParams.has("id")) {
      const id = url.searchParams.get("id");
      return id && /^[A-Za-z0-9_-]{10,128}$/.test(id) ? id : null;
    }
  } catch { /* unsupported link */ }
  return null;
}
