# Security notes

- bcrypt hash, expiring JWT, protected `/api`, generic login failure, Helmet, explicit
  CORS, 1 MB JSON limit, parameterized repositories and sanitized 500 responses.
- Login limiter: mặc định development 20 lần/60 giây, production 10 lần/300 giây,
  theo IP+username. V1 limiter in-memory phù hợp một API
  instance; multi-instance cần shared store ở post-V1.
- Request IDs và JSON logs chỉ ghi method/path/status/duration/error class; không ghi
  token, password, request body, lesson notes hay workbook.
- Google OAuth client secret, refresh/access token không được log, trả cho client hoặc
  lưu database/Sheet. V16C chỉ ghi failure code/message đã phân loại; credential là
  runtime secret và Sheet mặc định Restricted.
- Production rejects missing DB fields, non-HTTPS public CORS, wrong timezone and weak JWT.
- JWT trong Web Storage (localStorage khi ghi nhớ, sessionStorage nếu không) vẫn chịu rủi
  ro XSS; CSP/Helmet, không chèn HTML tùy ý và one-admin scope giảm bề mặt nhưng không thay
  thế rotation/revocation tập trung. Ứng dụng chỉ lưu token/username theo lựa chọn, tuyệt đối
  không lưu mật khẩu thô; việc lưu mật khẩu thuộc trình quản lý mật khẩu của trình duyệt.
- Nginx phục vụ web đặt CSP chỉ cho phép asset/API cùng origin, thumbnail
  `https://i.ytimg.com` và iframe `https://www.youtube-nocookie.com`; `style-src
  'unsafe-inline'` hiện cần cho Emotion/MUI, còn script inline không được phép.
  `frame-ancestors 'none'`, `nosniff`, referrer policy, permissions policy và
  `X-Frame-Options: DENY` được gửi cả cho HTML lẫn static asset.
- HSTS chỉ được cấu hình tại reverse proxy TLS ngoài cùng sau khi HTTPS và mọi
  subdomain đã được kiểm tra; không bật HSTS ở container HTTP nội bộ. Khuyến nghị
  `Strict-Transport-Security: max-age=31536000; includeSubDomains` và chỉ thêm
  `preload` sau khi đáp ứng đầy đủ điều kiện preload.
- Credential từng xuất hiện trong archive đã chia sẻ phải được xem là đã lộ. Xoay
  JWT secret, mật khẩu bootstrap admin và mọi mật khẩu database tái sử dụng qua
  kênh quản trị riêng; không ghi giá trị cũ/mới vào ticket, report hay terminal log.
- ExcelJS kéo theo một advisory UUID mức moderate cho buffer code path không được export
  này sử dụng. Chấp nhận tạm thời, theo dõi upstream; không có high/critical và không
  dùng `audit fix --force`.

Dependency tree cài sạch. Sau khi thêm `googleapis@173`, `npm audit --omit=dev` ngày
26/07/2026 báo 1 moderate, 14 high, 0 critical trong các chuỗi transitive gồm
ExcelJS và Google (`googleapis-common` đang pin `gaxios@7.1.3` qua rimraf/glob).
Không ép override dependency exact hoặc chạy `audit fix --force`; theo dõi bản vá
official và review riêng trước production enable. Các API Google chỉ nhận dữ liệu
server-generated, không nhận URL/path tùy ý từ client.
License inventory chủ yếu MIT/Apache/ISC/BSD; MPL và lựa chọn
MIT-or-GPL là dependency transitively distributed, không có copyleft blocker đã xác
định cho source ứng dụng. Outdated major Node types/TypeScript được hoãn vì ngoài M6;
review manifest không tìm thấy dependency trực tiếp không dùng.

## Vocabulary media V20B và assignments/games V20C–V20F

Các control image import/search/media bên dưới đã được triển khai ở V20B.
Token assignment được triển khai ở V20C; public session, answer và game runtime
được triển khai ở V20D; aggregate analytics/review được triển khai ở V20E.
V20F giữ analytics ở bảng question-item, không trả correct snapshot/raw answer qua
teacher result API và không đưa session/access token vào Google Sheet.

- Public route `/api/public/*` của V20 phải đăng ký trước
  `router.use("/api", requireAuth)`; teacher route vẫn dùng Bearer auth.
- `publicCode` không phải recipient secret. Recipient/session token dùng tối thiểu
  32 random bytes; DB chỉ giữ SHA-256 hash, token không chứa `studentId`, có revoke
  và session hết hạn sau 24 giờ inactivity/invalid ngay khi assignment đóng.
- Không log token, guest name, raw answer, roster hoặc URL `/play/*` có token.
  `/play/*` và public result gửi `Referrer-Policy: no-referrer` cùng
  `X-Robots-Tag: noindex, nofollow, noarchive`.
- Public limiter tách login limiter: resolve/media 60/phút/IP; access/start
  20/10 phút theo IP+assignment; answer/complete 120/phút theo session+IP.
- Image import chỉ nhận provider + provider asset ID còn trong cache. Backend
  resolve URL, enforce host allowlist sau từng redirect, timeout 5 giây, tối đa
  2 redirect/5 MiB, MIME sniff, JPEG/PNG/WebP, 256–4096 px và 16 MP.
- Pixabay search luôn `safesearch=true`, cache tối thiểu 24 giờ và hiển thị nguồn.
  Preview URL chỉ tạm; selected binary tải vào named volume, không hotlink.
- Media ID/bytes immutable, serve same-origin với `nosniff` và immutable cache.
  Binary không vào MySQL hoặc filesystem tạm; backup/restore gồm media volume.
- `clientAnswerId` unique là idempotency boundary. Answer transaction khóa
  attempt/question, insert một lần và derive first/final correct/retry count.
- Result endpoints xác thực teacher ownership, dùng query parameter hóa, phân trang
  tối đa 50 và không trả raw answer/session/access token. OPEN_LINK chỉ có aggregate
  guest riêng, không map guest name vào roster authoritative.
- Structured event chỉ ghi ID/count/category: publish, access failure/create,
  attempt complete, provider failure và review draft. Request logger redact toàn bộ
  segment session token; body/answer/guest name không được log.
- Recovery-set tạo `.backup.lock` trong media root; import trả 503 trong cửa sổ
  backup. Manifest chỉ chứa SHA/release/schema/file checksum, không chứa key hoặc
  credential.
