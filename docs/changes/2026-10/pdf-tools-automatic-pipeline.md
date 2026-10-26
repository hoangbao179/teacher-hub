# PDF Tools — pipeline tự động và chẩn đoán nguồn

## Task level

Initial: Level 3. Final: Level 3 vì thay đổi gate quyền renderer và chặn fallback
đối với PDF mã hóa. Không đổi HTTP/result contract, database, IAM hay deployment.

## Problem

`/tools` còn luồng chọn ảnh và ghép PDF thủ công, trái với luồng dán link → tạo
PDF → server xử lý → tải kết quả. `UNSUPPORTED_SOURCE` không chỉ rõ bước lỗi.
Cờ thử nghiệm có thể bỏ qua Print bị thiếu/vô hiệu hóa.

## Root cause

`validatePDF` dùng cùng mã `UNSUPPORTED_SOURCE` cho HTML và PDF mã hóa;
renderer cũng dùng mã này cho giao diện không nhận diện chắc chắn. Worker chưa
ghi stage/reason nên không thể xác định nguyên nhân job lịch sử từ mã lỗi đơn lẻ.

Kiểm tra ẩn danh local Linux ngày 26/10/2026 với file do user chỉ định
(`1_ArvHd…ynzIr`, sourceHash
`e6be0e0bebe57d3f9c6f97ac95f4565edd4356f7b856d6361a9f991f597bd89b`):
direct validation nhận HTML (`UNSUPPORTED_SOURCE/html-response`); Viewer có
Print vô hiệu hóa (`ACCESS_DENIED/print-disabled`). Không capture hoặc upload
kết quả. Đây là quan sát hiện tại, không phải bằng chứng truy nguyên job Cloud Run
cũ; log cloud đọc được chưa có stage/reason/job correlation.

Read-only Cloud Run inspection: Worker live `teacher-pdf-worker-00003-6m4`
nhận 100% traffic và timeout **30s**; service template là **180s**. Gateway live
`teacher-pdf-gateway-00003-s6v` nhận 100%, timeout 30s, không thấy cờ long-task.
Không suy cấu hình revision live từ service template hoặc mặc định source mới.

## Decision and changes

- Xóa UI chọn ảnh, state/handler, helper `imagePdf.ts`, test và npm script riêng
  của tính năng đã bỏ. E2E vẫn kiểm tra không còn file input và giữ submit/download.
- Giữ direct PDF trước, fallback Viewer sau lỗi tải phù hợp hoặc HTML; PDF mã hóa
  không đi qua renderer. PDF gốc giữ nguyên bytes; PDF ảnh vẫn được qpdf kiểm tra
  trước GCS upload, với giới hạn và cleanup hiện có.
- Loại bỏ assembly view-only. Cờ `PDF_VIEWER_SCREEN_CAPTURE_ENABLED` cũ không còn
  tác dụng, kể cả `true`; gate Print được kiểm tra khi chọn mode và trong assembly.
- Log JSON nội bộ theo job UUID/hash nguồn, stage, fallback flag và code/reason
  allowlist. Không ghi raw ID/URL, nội dung, cookie, token, stack hay parser stderr.
  Không đổi result schema, ACK, retry hay persistence; lỗi logging không làm hỏng job.

## Verification

Targeted checks passed:

- `npm.cmd -w client run typecheck`, `npm.cmd -w client run lint`.
- `npm.cmd -w server run typecheck`; `npm.cmd --prefix workers/pdf run check`.
- Client Tools/polling unit: 6 tests; API Gateway/transport/Print classification:
  8 tests; Gateway: 15 tests.
- `npm.cmd -w client run test:e2e:tools`: public/admin routing, flags, mobile,
  submit/reload/download, không còn chọn ảnh.
- `node --env-file=server/.env --import tsx client/scripts/public-pdf.e2e.mjs`:
  MySQL/FakeCloud E2E, recovery, public/private history, retry, ticket, responsive.
  Lần chạy không nạp cấu hình local bị MySQL từ chối; lần chạy với cấu hình local PASS.
- Targeted `pdf.integration.test.ts`: 4 tests qua runner integration hiện có.
- Worker Linux offline: 83 tests với Chromium/qpdf thật, network none, 1 CPU/2 GiB.
  Sau thay đổi cuối, chạy lại processing/diagnostics (23 tests) và assembly
  (14 tests); đều PASS. Image local cũ thiếu Playwright đã được thay bằng image
  build từ Dockerfile hiện tại cho verification, không push image hoặc deploy.
- Docker Worker build PASS. Base image hiện cài npm 11.16.0 trong khi package yêu
  cầu npm 12; build cảnh báo engine. Không âm thầm đổi Dockerfile/runtime trong task.
- Probe đúng file thật kết thúc `FAILED/ACCESS_DENIED`, đạt yêu cầu dừng khi
  Print disabled; không phải happy-path PDF success.
- `git diff --check`, `check:repo`, `check:docs`.

Không chạy `check:full`: thay đổi cô lập trong PDF/client Tools, không migration,
auth API, shared contract hay deployment runtime; targeted browser/integration và
Linux permission/cleanup tests bảo vệ phạm vi thay đổi. Không chạy cloud mutation.

## Documentation updated

Product contract, Worker feature, API diagnostic contract, current status và
Cloud Run operations được đồng bộ. Không thay business rules khác.

## Rollback

Revert commit source bằng PR; không cần data rollback. Giữ bất biến job/result
đã lưu; không xóa hoặc ghi lại FAILED cũ. Retry qua API tạo job mới theo cơ chế
hiện hành. Revert có thể khôi phục cờ view-only cũ nên phải giữ cờ này `false`.
Mọi rollout/traffic/flag change vẫn là công việc vận hành được duyệt riêng.

## Remaining risks

- Cần Cloud Run E2E trên file khác Owner, mở ẩn danh và được phép tải/in;
  kiểm tra đủ trang, thứ tự, nét in, RAM/CPU/tmpfs, timeout và cleanup trên revision
  thật. Local synthetic tests không chứng minh chất lượng giấy hay capacity cloud.
- Cần phối hợp producer/Gateway long-task gate 180s với Worker 120s và Cloud Run
  request 180s; chưa thay flags, traffic hoặc IAM. Provider Tasks trực tiếp vẫn 30s.
- File quan sát có Print disabled cần chủ tài liệu cấp quyền hoặc bản nguồn hợp lệ.
  Không có đường capture hợp lệ cho restriction đó; không hứa tạo được PDF từ file này.
- Google có thể đổi markup; các layout mơ hồ phải fail an toàn. Job lịch sử chỉ có
  `UNSUPPORTED_SOURCE` không thể hồi tố stage nếu không có bằng chứng bổ sung.

Temporary artifacts chỉ nằm trong `.artifacts/`, không commit ảnh, log hoặc PDF.
