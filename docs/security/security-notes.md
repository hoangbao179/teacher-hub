# Security notes

- bcrypt hash, expiring JWT, protected `/api`, generic login failure, Helmet, explicit
  CORS, 1 MB JSON limit, parameterized repositories and sanitized 500 responses.
- Login limiter: 10 failures/IP+email/15 phút. V1 limiter in-memory phù hợp một API
  instance; multi-instance cần shared store ở post-V1.
- Request IDs và JSON logs chỉ ghi method/path/status/duration/error class; không ghi
  token, password, request body, lesson notes hay workbook.
- Production rejects missing DB fields, non-HTTPS public CORS, wrong timezone and weak JWT.
- JWT trong Web Storage (localStorage khi ghi nhớ, sessionStorage nếu không) vẫn chịu rủi
  ro XSS; CSP/Helmet, không chèn HTML tùy ý và one-admin scope giảm bề mặt nhưng không thay
  thế rotation/revocation tập trung. Ứng dụng chỉ lưu token/email theo lựa chọn, tuyệt đối
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

Dependency tree hợp lệ. Audit production: 2 moderate (ExcelJS + UUID cùng một chuỗi),
0 high/critical. License inventory chủ yếu MIT/Apache/ISC/BSD; MPL và lựa chọn
MIT-or-GPL là dependency transitively distributed, không có copyleft blocker đã xác
định cho source ứng dụng. Outdated major Node types/TypeScript được hoãn vì ngoài M6;
review manifest không tìm thấy dependency trực tiếp không dùng.
