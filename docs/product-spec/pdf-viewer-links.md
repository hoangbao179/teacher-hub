# PDF từ liên kết Google Drive có quyền xem — product contract

## Yêu cầu tài liệu dài được duyệt ngày 27/10/2026

Tối đa 200 trang; JPEG thích ứng 90/85/80, mục tiêu trung bình mềm 500 KB/trang,
không giảm dưới 200 DPI hoặc bỏ/đổi thứ tự trang để đạt dung lượng. Tài liệu dài
phải dùng task theo phần, checkpoint bền vững và phục hồi khi đóng trang/Worker
lỗi. `/tools` hiển thị số trang, phần trăm, trạng thái và tải khi hoàn thành.
Cap v2 150 MiB chỉ áp dụng sau resource/streaming/timeout/cost review và kích hoạt
đồng bộ riêng; source 20 MiB là giới hạn độc lập. V1 giữ 40 trang/20 MiB trong
lúc v2 chưa được operator bật. Chi tiết triển khai và giới hạn E2E:
[contract v2](../api/pdf-worker-v2.md). Quy tắc quyền bên dưới vẫn bắt buộc;
Viewer mở được không cho phép vượt Print/Download bị khóa. Các đoạn lịch sử
v1 bên dưới không được dùng để tuyên bố nghiệm thu 200 trang.

**Trạng thái:** Yêu cầu sản phẩm đã được chủ dự án xác nhận ngày 25/10/2026;
thiết kế triển khai bên dưới là đề xuất kỹ thuật cần thử nghiệm. **Không được
hiểu đây là tính năng đã hoàn thiện, cam kết mọi liên kết đều tải được, hoặc
là cho phép vượt hạn chế của chủ tài liệu.**

## Cập nhật yêu cầu người dùng ngày 26/10/2026

Người dùng đã xác nhận rõ **trường hợp cần giải quyết chính là liên kết
Google Drive chỉ xem được, trong khi chủ tài liệu khóa cả In/Print**.
Mục tiêu sản phẩm vẫn là PDF mới chỉ chứa ảnh, đủ trang và rõ chữ để in;
không thể coi việc chạy Chromium hoặc tạo PDF với file đã mở Print là
nghiệm thu trường hợp này. Đây là **khoảng cách giữa yêu cầu và sản phẩm**,
không phải chức năng đã hoàn tất.

**Triển khai Worker (cập nhật 26/10/2026):** sau khi tải trực tiếp thất bại,
Worker mở Viewer ẩn danh và ghép PDF ảnh từ tile hiển thị (`view-only`);
không dùng nhánh `print-gated` gắn `ACCESS_DENIED` khi nút In tắt. Env
`PDF_PRINT_FALLBACK_ENABLED=false` và `PDF_VIEWER_SCREEN_CAPTURE_ENABLED=false`
**không** còn tắt fallback Viewer hay chụp tile trên Worker. Không vượt hạn chế
đăng nhập, link riêng tư, hay chặn tải byte gốc của Google. Ambiguous Print
(ví dụ hai nút) vẫn `UNSUPPORTED_SOURCE`. Không thấy Print có thể do UI đang
tải/thay đổi, không tự chứng minh chủ file cấm in. `/tools` chỉ nhận liên kết;
không yêu cầu chọn hoặc upload ảnh. E2E Drive thật và chất lượng in vẫn chưa
đủ để coi rollout production hoàn tất.

**Đây là nguồn chuẩn về mục đích tính năng.** Nếu Worker, API, test hay các
tài liệu cũ giả định "chỉ nhận file đã tải trực tiếp được", phải ghi rõ đó là
**giới hạn implementation**, không sửa ngược yêu cầu sản phẩm cho khớp code.

## 0. Quyết định phạm vi ưu tiên: bản PDF **để in**, nguồn công khai không đăng nhập

**Chủ dự án xác nhận:**
- **Đầu vào v1:** các liên kết Google Drive chia sẻ `Viewer` mà một cửa sổ
  **ẩn danh / không đăng nhập Google vẫn mở xem được**. Không cần file gốc
  tải được từ nút Download, không cần Owner/Editor.
- **Ngoài phạm vi v1:** link Viewer chỉ hiển thị cho tài khoản Google được
  mời (yêu cầu đăng nhập). Không làm OAuth, không yêu cầu cookies/mật khẩu,
  không dùng session Drive của người gửi. Trả `NEEDS_GOOGLE_LOGIN` hoặc
  thông báo tương đương; không giả định Worker có thể xem bằng link riêng tư.
- **Đầu ra v1:** một **PDF phục vụ in giấy**. Cho phép PDF chỉ chứa **ảnh của
  từng trang**, không có text layer, OCR, tìm kiếm, copy, chỉnh sửa, vector,
  bookmark hoặc tính toàn vẹn byte với PDF gốc. Đây **không phải lỗi**.
- **Ưu tiên nghiệm thu:** đủ trang, đúng thứ tự, đủ nét với chữ nhỏ/dòng kẻ
  để in, tỷ lệ/khổ trang hợp lý, không dính toolbar, không trắng/thiếu
  trang/ghép nhầm. Người dùng chỉ **dán link → nhấn Tạo PDF → tải về**.
- **Quyền:** công khai/xem được không luôn đồng nghĩa được tải/in/sao chép.
  Khi nhà cung cấp/chủ file cấm hành động này, thông báo hạn chế thay vì
  bypass bằng replay cookies, lục endpoint/tile ẩn hoặc né cơ chế bảo vệ.

**Non-goals:** tìm kiếm nội dung trong PDF, tái tạo bản gốc có text layer,
hoàn nguyên metadata/chữ ký số, giữ hyperlinks; login-only Google Drive
và hỗ trợ bản xem riêng tư. Không lẫn non-goal này với lỗi chất lượng in.

## 1. User story và điều kiện sử dụng

Người dùng mở `https://tienganhcovy.com/tools/`, dán 1–5 liên kết Google Drive
được chia sẻ **Viewer (chỉ xem)** và nhấn **Tạo PDF**. Không yêu cầu người dùng
có quyền Editor/Owner, upload trước file gốc, đăng nhập vào trang quản trị,
hay chọn checkbox "Tôi có quyền tải xuống và sử dụng các tài liệu này".
Hiển thị trạng thái xử lý, nguyên nhân thất bại cụ thể; job có thể tiếp tục
khi đóng trình duyệt. Kết quả hợp lệ là một PDF có thứ tự trang, tỷ lệ, khổ
giấy và nội dung phù hợp; cho phép tải về qua ticket một lần và hết hạn theo
quy định hiện có.

**Phạm vi cho lần triển khai này:** chỉ nguồn xem được **ẩn danh**. Dù người
dùng trên máy của họ đăng nhập Google và xem được file, đó **không** phải
bằng chứng file thuộc phạm vi v1. Tự động hóa phải thử từ môi trường không
đăng nhập; nếu bị yêu cầu đăng nhập, ngừng xử lý và giải thích rõ.

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

**Phân biệt nhanh (cập nhật theo source, xem [status](../implementation/status.md)):**

- **Chia sẻ Viewer + mở ẩn danh** là đầu vào mục tiêu; Worker thử tải trực tiếp
  rồi (mặc định) fallback renderer ghép **PDF ảnh** khi được phép theo chế độ
  `print-gated` (Print hoạt động trong Viewer).
- **Chủ file khóa Print/Copy**: v1 và v2 (khi bật) dùng nhánh `view-only` chụp
  tile Viewer khi `PDF_VIEWER_SCREEN_CAPTURE_ENABLED` không tắt; không bypass
  đăng nhập hay link riêng tư. **Chưa DONE** E2E/chất lượng in trên Drive thật.

- `workers/pdf/src/download.ts` gọi
  `https://drive.google.com/uc?export=download&id=...` với allowlist redirect;
  không dùng Drive API metadata/capabilities. Sau lỗi tải phù hợp hoặc HTML,
  `processor.ts` gọi renderer ẩn danh, bắt buộc Print bật và kiểm tra lại khi ghép.
- `workers/pdf/src/processor.ts` xác minh PDF gốc hoặc PDF ảnh bằng qpdf rồi lưu
  kết quả. PDF mã hóa không được chuyển sang renderer. E2E với một file tải trực tiếp thành công **không chứng
  minh** E2E Viewer bị chặn tải thành công.
- `client/src/components/PublicPdfTool.tsx` hiện **đã bỏ checkbox quyền tải**;
  API chấp nhận trường `rightsConfirmed:true` tương thích ngược nhưng không
  bắt buộc cho form public. UX này không chứng minh quyền tải Google Drive;
  Worker vẫn phải tuân thủ restriction của nguồn.
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
3. **Phương án dựng lại PDF ảnh để in** là đường fallback chính khi file
   không có bản PDF gốc tải trực tiếp nhưng nội dung được phép xuất/in.
   Dùng Playwright/Chromium **không đăng nhập** trên Cloud Run Worker riêng,
   dựng trang một cách được hỗ trợ, chụp/capture **từng trang** và ghép
   thành PDF ảnh; xác thực số trang, thứ tự, hướng, tỷ lệ, crop bỏ toolbar.
   Chỉ thao tác trên trang mà Worker có quyền truy cập hợp lệ; không dùng
   Playwright/Chromium làm phương pháp vượt `canDownload=false`,
   IRM/DLP/CAPTCHA/session boundary. Không thêm Chromium vào VPS/API 384 MB.
   **Tính khả thi với Google Drive preview thực tế chưa được kiểm chứng**
   bởi PoC PDF.js local, không hứa rằng chỉ thêm screenshot sẽ chạy ngay.
4. **Đảm bảo chất lượng in và resource budget trước khi code**:
   - **Ảnh 8-bit/kênh RGB (24-bit)** là đủ, không có khái niệm cần
     "JPEG 128-bit màu". Dùng PNG cho chữ/dòng kẻ cần nét; thử JPEG
     quality khoảng 90–95 cho trang nhiều ảnh nếu đạt test nét in.
   - Nhắm độ phân giải hiệu dụng **200–300 DPI** theo kích thước giấy
     thật; chỉ tăng `deviceScaleFactor` không tự tạo thêm chi tiết nếu
     viewer chỉ cung cấp ảnh thấp độ phân giải. Không upscale rồi báo
     đạt chất lượng 300 DPI.
   - Giữ kích thước/tỷ lệ/orientation từng trang, xuất để máy in A4
     có thể **fit-to-page không cắt mép**; không ép méo landscape thành
     portrait. Chất lượng quan trọng hơn searchable text.
   - So sánh trang trắng, chữ Việt cỡ nhỏ, bảng nét mảnh, ảnh màu,
     trang ngang/dọc và thứ tự trang; phát hiện ảnh thiếu, trùng,
     ảnh chưa load/lazy-load và crop sai. Không chỉ thử PDF 3 trang
     đã tải trực tiếp.
   - Benchmark RAM/CPU, kích thước file, temporary storage, Cloud Run
     timeout/concurrency và chi phí với fixture đại diện; giới hạn
     byte/pages hiện hành có thể khiến PDF ảnh lớn bị từ chối: chỉ
     thay đổi qua PR/đánh giá Level 3 riêng, không tăng âm thầm.
   - Xem `docs/features/pdf-quality-poc.md`. PoC local PDF.js **không
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
| File PDF link Viewer, không phải Owner, **ẩn danh mở được**, tải được | **COMPLETED**; PDF gốc hoặc PDF ảnh, đúng trang, tải được để in |
| File PDF Owner đã cho phép tải, link public | **COMPLETED**; không phát sinh yêu cầu đăng nhập; có thể giữ nguyên bytes gốc |
| File Viewer mở được preview nhưng owner/admin cấm tải/copy/print | **Không cố bypass**; lỗi có lý do và hướng xin quyền |
| **Trường hợp B** — link Viewer chỉ cho tài khoản Google được mời | **Ngoài phạm vi v1**; thông báo cần đăng nhập/chưa hỗ trợ; không mượn cookie |
| `resourcekey`, redirect hợp lệ hoặc loại Drive được hỗ trợ | Không âm thầm loại bỏ key; hoặc hỗ trợ đúng với quyền hợp lệ, hoặc giải thích hạn chế |
| File không phải PDF / Google Workspace native | Chỉ hỗ trợ export nếu được cho phép và có thiết kế/test riêng; khác thì báo không hỗ trợ |
| HTML login, CAPTCHA, confirmation page | Không ghi nhận HTML/ảnh sai làm PDF thành công |
| Link mơ hồ, quá capability batch, source >20 MiB, hoặc >200 trang ở v2 | Từ chối rõ ràng; v1 vẫn 40 trang/20 MiB khi v2 tắt |
| 5-link batch rồi đóng trình duyệt | Recovery vẫn xử lý job hợp lệ, lịch sử/terminal state chính xác |
| PDF hoàn thành, mở thiết bị khác, tải 2 lần bằng một ticket | Lượt đầu đúng bytes/hash; ticket đã dùng bị từ chối; hết hạn không tải |
| Kết nối Cloud Tasks/GCS lỗi, timeout, replay | Không báo COMPLETED sai, retry giới hạn, không leak secret |

### Test chống lặp sai yêu cầu

- Tạo **fixture Viewer khác Owner** có **`canDownload=true`** và chạy E2E
  thực tế. Không lấy file owned + anonymous-direct-download làm bằng chứng đủ.
- Thêm fixture Viewer có `canDownload=false`, bảo đảm fail an toàn thay vì
  screenshot bypass hoặc thành công giả.
- Với render được phép: kiểm tra **PDF dạng ảnh vẫn PASS** (không cần
  OCR/searchable text), chất lượng in ở 200–300 DPI hiệu dụng; so sánh
  từng trang, khổ, chiều, chữ tiếng Việt nhỏ, trang trắng, ảnh, số trang,
  dung lượng, tài nguyên peak và thời gian. Kiểm thử tự động phát hiện
  trang bị lazy-load thiếu, toolbar lọt vào ảnh, trùng/sai thứ tự, crop mất mép.
- Kiểm tra đường Viewer **mở được ẩn danh** thành công và đường Viewer
  **đòi Google login** bị phân loại unsupported v1, không tự khởi tạo OAuth.
- Test quá giới hạn kích thước PDF raster không được ghi `COMPLETED`
  giả; giữ giới hạn an toàn và tính lại budget trước khi nâng.
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
