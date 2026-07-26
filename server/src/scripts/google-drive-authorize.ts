import "dotenv/config";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { google } from "googleapis";

async function main(): Promise<void> {
const redirectUri = "http://localhost:53682/oauth2/callback";
const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) throw new Error("Cần GOOGLE_DRIVE_CLIENT_ID và GOOGLE_DRIVE_CLIENT_SECRET trong server/.env.");
const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const state = randomBytes(32).toString("hex");
const scopes = ["https://www.googleapis.com/auth/drive.file"];
const authUrl = oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: scopes, state });

function validState(candidate: string): boolean {
  const left = Buffer.from(candidate); const right = Buffer.from(state);
  return left.length === right.length && timingSafeEqual(left, right);
}

console.log("Mở URL sau trong trình duyệt để cấp quyền Google cho Teacher Hub:");
console.log(authUrl);

const callback = await new Promise<{ code: string }>((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", redirectUri);
    if (url.pathname !== "/oauth2/callback") { res.writeHead(404).end("Not found"); return; }
    const code = url.searchParams.get("code"); const returnedState = url.searchParams.get("state") ?? "";
    if (!code || !validState(returnedState)) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Callback không hợp lệ. Có thể đóng cửa sổ này.");
      server.close(); reject(new Error("OAuth callback thiếu code hoặc state không khớp.")); return;
    }
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end("Đã cấp quyền cho Teacher Hub. Có thể đóng cửa sổ này.");
    server.close(); resolve({ code });
  });
  server.on("error", reject);
  server.listen(53682, "127.0.0.1");
  setTimeout(() => { server.close(); reject(new Error("OAuth timeout sau 3 phút.")); }, 180_000).unref();
});

const tokenResult = await oauth.getToken(callback.code);
oauth.setCredentials(tokenResult.tokens);
if (!tokenResult.tokens.refresh_token) throw new Error("Google không trả refresh token. Hãy thu hồi quyền cũ rồi chạy lại với consent.");
const drive = google.drive({ version: "v3", auth: oauth });
let rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
let ownerLabel = "";
if (rootFolderId) {
  const folder = await drive.files.get({ fileId: rootFolderId, fields: "id,name,owners(displayName,emailAddress),mimeType,trashed" });
  if (folder.data.trashed || folder.data.mimeType !== "application/vnd.google-apps.folder") throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID không phải thư mục hợp lệ.");
  ownerLabel = folder.data.owners?.[0]?.displayName ?? folder.data.owners?.[0]?.emailAddress ?? "";
} else {
  const folder = await drive.files.create({ requestBody: { name: "Lớp học cô Vy - Sổ theo dõi phụ huynh",
    mimeType: "application/vnd.google-apps.folder", appProperties: { teacherHubManaged: "true", resourceType: "parentTrackingRoot" } },
    fields: "id,owners(displayName,emailAddress)" });
  rootFolderId = folder.data.id ?? "";
  ownerLabel = folder.data.owners?.[0]?.displayName ?? folder.data.owners?.[0]?.emailAddress ?? "";
}
console.log("\nChỉ sao chép các giá trị sau vào secret runtime; không commit hoặc gửi qua chat:");
console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokenResult.tokens.refresh_token}`);
console.log(`GOOGLE_DRIVE_ROOT_FOLDER_ID=${rootFolderId}`);
if (ownerLabel) console.log(`GOOGLE_DRIVE_OWNER_LABEL=${ownerLabel}`);
console.log("Access token không được in.");
}

void main().catch((error) => {
  console.error(JSON.stringify({ event: "google_drive_authorize_failed", error: error instanceof Error ? error.name : "UnknownError" }));
  process.exitCode = 1;
});
