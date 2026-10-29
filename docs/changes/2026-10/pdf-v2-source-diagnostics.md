# Audit PDF Worker v2: đối chiếu nguồn và diagnostic

## Task level

Initial/final: Level 2. Sửa diagnostic và regression của Worker; không đổi
contract persisted, thuật toán nhận nguồn, quyền, deployment hay tài nguyên.

## Problem và bằng chứng

Job `1876e95d-6ed7-4ae4-a374-7dc92279a784`, revision được cung cấp
`teacher-pdf-worker-00020-fiv`. Đọc GCS chỉ xuất field kỹ thuật xác nhận manifest
viewer/139 trang, marker 1 trang 1–10/4.772.813 bytes, không đọc được marker 2,
result FAILED/UNSUPPORTED_SOURCE. Không đọc/ghi PDF, ảnh, tên hay URL nguồn.
Truy vấn structured log theo revision/UUID trong 30 ngày không có event trả về;
không suy từ kết quả rỗng rằng không có lỗi hoặc xác nhận nguồn không đổi.

Đối chiếu `35ff0f8` với main `169c551`: `viewer-chunk.ts`, `capture-page.ts`
giống hệt; `chunk-processor.ts` chỉ khác phần metadata filename. Hai lỗi xác
nhận ở cả hai phiên bản: fingerprint mismatch dùng nhầm reason tổng trang;
v2 không gọi diagnostic khi catch/persist lỗi. Không thể xác định hồi cứu job
này là fingerprint mismatch chỉ bằng marker/result hiện có.

## Root cause và các khả năng khác

SHA-256 đo bytes PNG, không phải revision tài liệu. Regression browser context
độc lập cho cùng fixture giữ nguyên anchor; thay 1 pixel trắng 255→254 làm
anchor đổi và bị từ chối như thay nội dung rõ rệt. Đây là bằng chứng về độ nhạy
thuật toán, không chứng minh Chromium đã render khác trong job production.
PNG encoding hoặc bitmap khác đều có thể làm hash đổi; canvas hiện đã re-encode
PNG, nên khác cách nén PNG của nguồn chưa chắc truyền tới fingerprint.

Các nhánh liên quan step 2:

| Nhánh | Đánh giá từ bằng chứng hiện có |
| --- | --- |
| Anchor khác manifest | Có thể; phần 1 chỉ chứng minh lần capture trước khớp |
| Tổng trang khác hoặc label đổi giữa capture | Có thể; manifest 139 không chứng minh phiên sau vẫn 139 |
| Heading trùng, nhiều heading/ảnh/toolbar trong wrapper | Có thể; layout trang 11–20 chưa được marker 1 chứng minh |
| Bitmap >12 MP | Có thể ở anchor hoặc trang sau; không suy từ bytes PDF phần 1 |
| page-count-unreadable | Có nhánh trong reader; readiness thông thường chặn trước nếu không có label trang 1 |
| invalid-file-id | Không phù hợp ID đã qua validation và phần 1 thành công |
| Direct download/HTML/encrypted PDF | Discovery đã qua, step 2 Viewer không gọi direct download |
| Print disabled | Active selectViewerMode không kiểm Print; không thể dùng làm nguyên nhân từ source này |
| Timeout/seek/decode/context mất, DPI thấp | Thông thường SOURCE_UNAVAILABLE retryable, không trực tiếp tạo terminal UNSUPPORTED_SOURCE |
| qpdf/merge, checkpoint sai, byte/page cap | Có mã lỗi riêng; không giải thích cùng mã ở Viewer capture nếu không có bằng chứng bổ sung |

## Decision và changes

Giữ nguyên fail-closed anchor, không retry mismatch thành công giả. Thêm reason
`anchor-fingerprint-mismatch`, pageIndex=1; giữ `page-total-mismatch` cho tổng
trang. V2 gọi logger allowlist trước khi persist/rethrow và khi direct fallback;
gồm step, stage, code, reason, retryable và field số hợp lệ. Không thêm dữ liệu
nhạy cảm vào result. Sink lỗi không thay behavior.

### Cơ chế đối chiếu ổn định hơn được đề xuất, chưa triển khai

Ưu tiên snapshot bytes bất biến khi được phép tải: checksum toàn file, render
mọi phần từ cùng snapshot như direct path hiện tại. Với Viewer-only, cần chứng
minh lấy được revision/version chính thống trong ngữ cảnh anonymous được phép,
gắn đúng file và toàn bộ rendition; kiểm trước/sau mỗi phần và trước publish.
File ID, title, totalPages, blob URL hoặc token phiên không đủ làm revision.
Không mặc định API metadata/revision truy cập được ẩn danh; cần PoC được phép.

Nếu có identity ổn định đáng tin cậy, lưu schema identity có version và kế hoạch
tương thích manifest cũ; kiểm revision khác phải dừng, kể cả trang 1 không đổi.
Hash canonical decoded pixels có thể loại biến động encoding nhưng không loại
render drift. So sánh perceptual chỉ làm tín hiệu QA phụ với revision đã xác
minh; dung sai ảnh tự nó không chứng minh hai tài liệu giống nhau (đổi một chữ
số nhỏ có thể quan trọng). Không lấy perceptual hash trang 1 làm khóa ghép.
Thiết kế mới đụng cross-service contract/security cần Level 3/review riêng.
Nếu không có snapshot/revision đủ tin cậy, tiếp tục fail-closed.

## Verification

Targeted browser fixture: capture range không bắt đầu trang 1/thứ tự/native size;
context độc lập cùng nguồn; drift một pixel; đổi nội dung; đổi tổng trang.
Drift nhỏ và tài liệu đổi đều bị chặn với reason fingerprint riêng, không được
diễn giải thành đã hỗ trợ render drift. Capture suite giữ regression layout,
decode, lazy/recycled node, DPI/byte bounds. Processor fixture kiểm step 2 có
marker 1 hợp lệ, reason riêng, terminal replay, không part 2/output khi lỗi,
retryable không ghi FAILED, cleanup và sink lỗi. Diagnostic chỉ xuất allowlist.
Kết quả local Windows/Node 24.18.0/npm 12.0.1:

- `npm --prefix workers/pdf run check`: PASS (typecheck, syntax, 3 policy tests).
- Trong workers/pdf: `node --test test/chunk-diagnostics.test.mjs test/diagnostics.test.mjs test/viewer-chunk.test.mjs test/capture-page.test.mjs`: 31 PASS, 0 skip.
- Trong workers/pdf: `node --test --test-name-pattern='real HTTP|versioned chunk payload|over 200' test/chunk-pipeline.test.mjs`: 3 PASS, 0 skip; không chọn các ca qpdf Linux.
- `npm run check:docs`, `npm run check:repo`, `git diff --check`: PASS.

Worker không có script lint riêng; dùng check hiện có. Không chạy full suite,
qpdf Linux/Docker hoặc E2E Drive thật: không đổi qpdf/runtime, và quyền nguồn
thực chưa được xác minh. Không dùng test SKIP làm PASS. Không lưu ảnh/log test.

## Documentation updated

Contract v2, runbook diagnostic và status source; không thay yêu cầu sản phẩm.

## Rollback

Revert commit trước khi phát hành. Không cần migration/backfill hay sửa object
GCS cũ. Job terminal immutable giữ nguyên; không xóa marker/result để chạy lại.
Không tự merge/deploy/đổi traffic. Chưa triển khai nên chưa có rollback runtime.

## Remaining risks và nghiệm thu thực tế

Nguyên nhân production cụ thể vẫn chưa xác định. Chỉ sau operator duyệt rollout
diagnostic và chạy attempt mới được phép mới phân biệt được lý do tại bước lỗi.
Không tuyên bố đã sửa thành công file 139 trang. Nghiệm thu cần Viewer khác Owner
mở ẩn danh và được phép tải/in, đủ 139 trang (14 phần rồi merge), thứ tự/chiều/
nét in, recovery sau restart/đóng tab, bytes/thời gian/RAM/scratch trên Cloud Run.
Nếu làm identity mới: nguồn ổn định + drift render nhẹ cùng revision phải qua;
revision đổi với cùng tổng trang/trang 1, đổi trang giữa/cuối và đổi trong lúc
capture phải bị chặn; thiếu identity không được âm thầm fallback sang dung sai.

Khoảng cách quyền Print/canDownload đã được spec/status ghi nhận vẫn tồn tại;
không chạy capture file production khi chưa xác minh quyền. Không dùng audit này
để hợp thức hóa capture vượt hạn chế hoặc chứng nhận production-ready.
