# PDF từ liên kết Google Drive có quyền xem — product contract

**Trạng thái:** Yêu cầu sản phẩm đã được chủ dự án xác nhận ngày 25/10/2026;
thiết kế triển khai bên dưới là đề xuất kỹ thuật cần thử nghiệm. **Không được
hiểu đây là tính năng đã hoàn thiện, cam kết mọi liên kết đều tải được, hoặc
là cho phép vượt hạn chế của chủ tài liệu.**

**Đây là nguồn chuẩn về mục đích tính năng.** Nếu Worker, API, test hay các
tài liệu cũ giả định "chỉ nhận file đã tải trực tiếp được", phải ghi rõ đó là
**giới hạn implementation**, không sửa ngược yêu cầu sản phẩm cho khớp code.

## 1. User story và điều kiện sử dụng

Người dùng mở `https://tienganhcovy.com/tools/`, dán 1–5 liên kết Google Drive
được chia sẻ **Viewer (chỉ xem)** và nhấn **Tạo PDF**. Không yêu cầu người dùng
có quyền Editor/Owner, upload trước file gốc, đăng nhập vào trang quản trị,
hay chọn checkbox "Tôi có quyền tải xuống và sử dụng các tài liệu này".
Hiển thị trạng thái xử lý, nguyên nhân thất bại cụ thể; job có thể tiếp tục
khi đóng trình duyệt. Kết quả hợp lệ là một PDF có thứ tự trang, tỷ lệ, khổ
giấy và nội dung phù hợp; cho phép tải về qua ticket một lần và hết hạn theo
quy định hiện có.

**Phân biệt bắt buộc:**
- `role=reader/Viewer`: quyền truy cập xem, **không nói lên** quyền tải.
- `capabilities.canDownload=true` (hoặc quyền tải được xác minh tương đương):
  có thể chọn phương án trích xuất PDF được cho phép.
- Chủ file/admin/DLP **tắt tải, in hoặc sao chép**: trình xem có thể vẫn mở.
  Không hứa chuyển thành PDF bằng chụp màn hình/scrape trang để đi vòng qua
  hạn chế này. Phải hiển thị thông báo cần chủ file cấp quyền hoặc cung cấp
  bản sao được phép tải. Nếu không xác minh được quyền, thất bại an toàn.
- Link Viewer có thể yêu cầu đăng nhập, không cấp quyền cho identity Worker,
  hoặc có `resourcekey`. "Mở được trong trình duyệt của tôi" không chứng minh
  Cloud Run có quyền đọc. Không thu cookies, mật khẩu, session Drive của người
  dùng vào form hoặc job.

## 2. Sự thật của phiên bản đang chạy (không nhầm với yêu cầu)

- `workers/pdf/src/download.ts` hiện chỉ gọi
  `https://drive.google.com/uc?export=download&id=...` với allowlist redirect;
  không dùng Drive API metadata/capabilities, không render/chụp preview Drive.
- `workers/pdf/src/processor.ts` nhận PDF gốc, xác minh bằng qpdf rồi lưu
  bytes giữ nguyên. E2E với một file tải trực tiếp thành công **không chứng
  minh** E2E Viewer bị chặn tải thành công.
- `client/src/components/PublicPdfTool.tsx` hiện vẫn chứa checkbox xác nhận
  quyền tải; `shared/src/contracts/pdf.ts` và `server/src/services/pdf.service.ts`
  còn yêu cầu `rightsConfirmed:true`. Đây là **khoảng cách so với UX mục tiêu**,
  không phải quy định mới mà người dùng đã đồng ý.
- Hai job FAILED từ giao diện production cần đọc `errorCode` /
  `cloudErrorCode` và result tương ứng trước khi gán nguyên nhân.
  Không tự kết luận do PDF bị cấm tải nếu chưa có bằng chứng.
- Đường dẫn website `:8080` là lỗi redirect Nginx riêng biệt, không phải
  bằng chứng lỗi Worker hoặc Drive.

## 3. Phương án kỹ thuật ưu tiên (đề xuất, chưa triển khai)

1. **Phân loại nguồn theo quyền thực tế.** Kiểm tra link/ID, MIME type,
   metadata và `capabilities.canDownload` bằng Drive API khi có identity
   hợp lệ và quyền truy cập phù hợp. Phân biệt public/link-shared, tài liệu
   cần đăng nhập, không tồn tại, bị hạn chế tải, định dạng Workspace gốc.
   `canDownload` phải được xét trong đúng ngữ cảnh người truy cập; không
   suy ra từ link hay từ việc trang preview hiển thị.
2. **Ưu tiên byte nguyên gốc** cho PDF mà người gọi được phép tải: dùng
   Drive API `files.get?alt=media` hoặc đường tải do Google hỗ trợ, thực
   hiện streaming giới hạn, giữ vector/text, kiểm tra PDF và SHA-256.
   Viewer **được phép tải** phải là happy path bắt buộc.
3. **Phương án dựng lại từ render** chỉ khi chủ tài liệu cho phép sao chép/
   xuất: cân nhắc một Cloud Run Worker tách biệt, renderer được xác thực và
   được phép truy cập nguồn, render từng trang rồi ghép PDF; giữ thứ tự,
   orientation, khổ giấy, không giả vờ giữ text/vector nếu chỉ là ảnh.
   Playwright/Chromium không được tự xem là cách để vượt
   `canDownload=false`, IRM/DLP, CAPTCHA hoặc session boundary.
   Không thêm Chromium vào VPS/API 384 MB.
4. **Thiết kế Cloud Run đủ tài nguyên và chi phí trước khi code**:
   benchmark fixture được sở hữu/cho phép, thời gian cgroup, CPU/RAM và
   bộ nhớ tạm, hạn mức đồng thời 1, giới hạn bytes/pages và deadline;
   xem `docs/features/pdf-quality-poc.md`. PoC local PDF.js **không
   phải** bằng chứng renderer của Google Drive hoạt động.
5. **Giữ kiến trúc công việc bền vững**: API → Gateway HMAC → Cloud Tasks →
   Worker private → GCS; MySQL outbox, reconciliation sau khi đóng tab,
   trạng thái, quyền truy cập download ticket, TTL 24h. Nếu đổi schema/payload/
   IAM/memory/image/chi phí cần PR và review Level 3 riêng.

Không thêm fallback HTML scraping, Chrome DevTools protocol interception,
cookie/session replay, endpoint nội bộ không công khai, trích ảnh tile để đi
vòng chế độ tắt tải, mở quyền Worker public hoặc bypass captcha.

## 4. Ma trận nghiệm thu bắt buộc

| Nguồn / quyền | Kết quả mong đợi |
| --- | --- |
| File PDF link Viewer, không phải Owner, tải được | **COMPLETED**; tải PDF thật; trang/bytes/hash đúng |
| File PDF Owner đã cho phép tải, link public | **COMPLETED**; không phát sinh yêu cầu đăng nhập |
| File Viewer mở được preview nhưng owner/admin cấm tải/copy/print | **Không cố bypass**; lỗi có lý do và hướng xin quyền |
| Link Viewer cần đăng nhập, Worker không có quyền | ACCESS_DENIED/NEEDS_ACCESS rõ ràng; không mượn cookie |
| `resourcekey`, redirect hợp lệ hoặc loại Drive được hỗ trợ | Không âm thầm loại bỏ key; hoặc hỗ trợ đúng với quyền hợp lệ, hoặc giải thích hạn chế |
| File không phải PDF / Google Workspace native | Chỉ hỗ trợ export nếu được cho phép và có thiết kế/test riêng; khác thì báo không hỗ trợ |
| HTML login, CAPTCHA, confirmation page | Không ghi nhận HTML/ảnh sai làm PDF thành công |
| Link mơ hồ, quá 5 file, >10 MiB, >40 trang | Từ chối rõ ràng; không vượt resource cap |
| 5-link batch rồi đóng trình duyệt | Recovery vẫn xử lý job hợp lệ, lịch sử/terminal state chính xác |
| PDF hoàn thành, mở thiết bị khác, tải 2 lần bằng một ticket | Lượt đầu đúng bytes/hash; ticket đã dùng bị từ chối; hết hạn không tải |
| Kết nối Cloud Tasks/GCS lỗi, timeout, replay | Không báo COMPLETED sai, retry giới hạn, không leak secret |

### Test chống lặp sai yêu cầu

- Tạo **fixture Viewer khác Owner** có **`canDownload=true`** và chạy E2E
  thực tế. Không lấy file owned + anonymous-direct-download làm bằng chứng đủ.
- Thêm fixture Viewer có `canDownload=false`, bảo đảm fail an toàn thay vì
  screenshot bypass hoặc thành công giả.
- Với render được phép: so sánh từng trang, khổ, chiều, chữ tiếng Việt nhỏ,
  trang trắng, ảnh, số trang, dung lượng, tài nguyên peak và thời gian.
- Dùng `errorCode` thực tế của job FAILED để phân loại; không suy đoán
  nguyên nhân từ chip giao diện.
- Verify UX: chỉ dán link → Tạo PDF; không checkbox về quyền tải;
  ngôn ngữ kết quả phân biệt file không truy cập được, chủ file hạn chế,
  sai MIME, lỗi hệ thống.

## 5. Quy trình review bắt buộc trước khi sửa Worker

- Đọc **tài liệu này** cùng `AGENTS.md`, `docs/features/pdf-worker.md`,
  `docs/api/pdf-worker-v1.md`, `docs/features/pdf-quality-poc.md`.
- Xác nhận test là Viewer thực, không phải tài khoản chủ file.
- Ghi rõ dòng nào là yêu cầu, dòng nào là behavior hiện tại, bằng chứng E2E
  nào còn thiếu. Một lần chạy PASS với PDF public tải trực tiếp không được
  tuyên bố hoàn thành tính năng Viewer.
- Xác minh quyền và cơ chế hợp lệ trước khi chọn direct/API/renderer.
  Nếu phải đổi kiến trúc, hãy PR riêng với threat model, giới hạn RAM/CPU,
  chi phí, test và rollback. Không tự bật production từ tài liệu.

## Nguồn chính thức

- [Google Drive — Download and export files](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
- [Google Drive — Protect file content / download restrictions](https://developers.google.com/workspace/drive/api/guides/content-restrictions)
- [Google Drive API — File capabilities](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
