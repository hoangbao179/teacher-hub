# Google Drive và Google Sheets

V16C dùng OAuth server-side để tạo một Google Sheet Restricted theo từng học sinh.
V16D đồng bộ lesson một chiều qua transactional outbox; Teacher Hub database vẫn
là source of truth.

## Google Cloud

1. Tạo hoặc chọn Google Cloud project của cô Vy.
2. Bật Google Drive API và Google Sheets API.
3. Cấu hình OAuth consent screen và OAuth Client loại Web application.
4. Thêm redirect URI chính xác `http://localhost:53682/oauth2/callback`.
5. Đặt client ID/secret trong `server/.env`, không commit.
6. Chạy `npm -w server run google-drive:authorize`, mở URL được in và đăng nhập đúng
   tài khoản sở hữu Sheet. Script dùng state chống CSRF, offline consent và đóng callback
   server sau khi hoàn tất.
7. Lưu refresh token/root folder ID được in một lần vào secret runtime. Không lưu access token.

Scope duy nhất là `drive.file`; không cấp `spreadsheets` hoặc scope `drive` rộng.
Root folder do script tạo có tên
`Lớp học cô Vy - Sổ theo dõi phụ huynh`; ứng dụng không gọi permissions API và
không bật anyone-with-link.

## Runtime

```dotenv
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
GOOGLE_SHEET_SYNC_ENABLED=true
```

`false` cho phép server chạy không cần credential. `true` mà thiếu một credential bắt
buộc sẽ làm startup fail rõ ràng. Các giá trị này chỉ được cấp cho API container lúc
runtime, không phải Docker build args.

Backend cố định nhãn chủ sở hữu là `Cô Vy`, template version là `v2`, chu kỳ sync là
30 giây, batch 20 event, tối đa 8 lần thử và lock timeout 10 phút. Các giá trị này
không cấu hình qua environment.

## Smoke thật

Chỉ dùng account test hoặc dữ liệu giả:

```bash
GOOGLE_DRIVE_SMOKE=1 npm -w server run google-drive:smoke
```

Script xác minh auth/root folder, tạo và format năm sheet bằng dữ liệu giả, đọc lại
appProperties rồi đưa file thử vào Trash. Không chạy trong CI và không dùng học sinh thật.

## Vận hành

- `invalid_grant`: chạy authorize lại và thay refresh token runtime.
- Permission/root folder: kiểm tra account đang sở hữu và folder ID.
- 429/network: dùng action Thử tạo lại; retry tìm file theo appProperties trước khi tạo.
- Archive trong Teacher Hub không xóa file Google. Việc Trash file thật là thao tác riêng.
- Phụ huynh được cấp Viewer thủ công trực tiếp trong Google Sheets; V16C không tự share.
- Nếu trạng thái tạo kéo dài quá 10 phút, Student Detail hiển thị `Thử tạo lại`.
  Retry tìm file bằng `appProperties` trước khi tạo mới để recovery không tạo duplicate.
- Regenerate giữ nguyên spreadsheet ID/URL và không xóa formatting/protection do
  người dùng tự tạo ngoài rule Teacher Hub quản lý.
- Worker chỉ chạy khi cả Drive và sync đều bật. Tắt sync không xóa event; khi bật
  lại worker tiếp tục pending/retry, hoặc admin chọn **Đồng bộ lại**.
- V16D không cập nhật tab `Học phí`; dùng regenerate thủ công nếu cần dựng lại
  snapshot V16C trong lúc chờ V16E.
- V20F thêm tab `Ôn từ vựng`. Existing spreadsheet được bổ sung tab thiếu tại chỗ;
  mỗi identified vocabulary attempt dùng outbox `VOCABULARY_ATTEMPT_UPSERT` idempotent.
  OPEN_LINK guest không tạo student sync. Worker chỉ cập nhật managed range và giữ
  vùng dữ liệu/format ngoài phạm vi Teacher Hub.
