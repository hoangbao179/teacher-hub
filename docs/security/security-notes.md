# Security notes

- bcrypt hash, expiring JWT, protected `/api`, generic login failure, Helmet, explicit
  CORS, 1 MB JSON limit, parameterized repositories and sanitized 500 responses.
- Login limiter: 10 failures/IP+email/15 phút. V1 limiter in-memory phù hợp một API
  instance; multi-instance cần shared store ở post-V1.
- Request IDs và JSON logs chỉ ghi method/path/status/duration/error class; không ghi
  token, password, request body, lesson notes hay workbook.
- Production rejects missing DB fields, non-HTTPS public CORS, wrong timezone and weak JWT.
- JWT trong localStorage vẫn chịu rủi ro XSS; CSP/Helmet, không chèn HTML tùy ý và one-admin
  scope giảm bề mặt nhưng không thay thế rotation/revocation tập trung.
- ExcelJS kéo theo một advisory UUID mức moderate cho buffer code path không được export
  này sử dụng. Chấp nhận tạm thời, theo dõi upstream; không có high/critical và không
  dùng `audit fix --force`.

Dependency tree hợp lệ. Audit production: 2 moderate (ExcelJS + UUID cùng một chuỗi),
0 high/critical. License inventory chủ yếu MIT/Apache/ISC/BSD; MPL và lựa chọn
MIT-or-GPL là dependency transitively distributed, không có copyleft blocker đã xác
định cho source ứng dụng. Outdated major Node types/TypeScript được hoãn vì ngoài M6;
review manifest không tìm thấy dependency trực tiếp không dùng.
