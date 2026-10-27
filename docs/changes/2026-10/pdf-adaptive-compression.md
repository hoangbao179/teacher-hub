# PDF: nén thích ứng và đánh giá giới hạn tài liệu dài

## Task level

Initial/final Level 3: thay đổi cấu hình shared xuyên Worker/API/Gateway/client
và đánh giá tài nguyên cho kiến trúc PDF dài. PR này chỉ hoàn thành nền tảng
nén; không bật hỗ trợ 200 trang hoặc thay đổi hạ tầng.

## Problem và root cause

Một quality JPEG cố định không thích ứng với trang chữ/trang ảnh. Cap nguồn và
đầu ra dùng chung `maxBytes`, trong khi raster output có đặc tính khác file gốc.
pdf-lib giữ stream JPEG toàn tài liệu và cấp thêm buffer lúc serialize; giảm
quality không giải quyết yêu cầu xử lý 200 trang với bộ nhớ bị chặn.

## Decision và changes

- Dùng quality 90 → 85 → 80 từ PNG gốc, 4:4:4; không resize hoặc recompress JPEG.
  Thử tiếp khi chưa đạt target mềm 500,000 bytes hoặc remaining embed budget.
  Giữ candidate nhỏ nhất; quality 80 vẫn có thể vượt target nếu cap tổng cho phép.
- Shared sở hữu quality ladder, target, 200 DPI và 12 MP. Cả capture trong browser
  và placement kiểm tra cùng ngưỡng DPI. Byte nguồn và byte output có cấu hình
  riêng, mỗi tầng tiếp tục validate. Không thay schema/payload v1.
- Giữ nguyên giới hạn sản phẩm 40 trang/20 MiB và working set PNG 32 MiB.
  **Không áp dụng 150 MiB** từ một benchmark tổng hợp; thiếu budget browser,
  merge/download, nguồn thực, concurrency và bằng chứng vận hành.
- Giai đoạn tiếp theo cần task/part riêng có checkpoint GCS và API outbox điều phối;
  không dùng retry như vòng lặp chunk vì queue hiện chỉ có 5 attempts. Chưa viết
  hoặc bật pipeline này trong PR nén.

## Verification

Node Windows 24.18.0; Linux Docker local, 1 CPU / 2 GiB, không swap, mỗi benchmark
chạy tuần tự, network tắt. Fixture tự tạo: chữ tiếng Việt, nét mảnh, texture màu
deterministic, native khoảng 220 DPI, xen trang ngang/trắng. Đây là **codec +
pdf-lib capacity probe**, không có Chromium, source Drive, queue hay transport.
tmpfs thử nghiệm 256 MiB; production tmpfs không đổi. Peak cgroup gồm allocations
verify/qpdf/tmpfs; không cộng Node RSS vào số này. Một lần chạy/mốc, không phải SLA.

| Trang | PDF bytes | JPEG trung bình/trang | Wall s | Node CPU s | Peak cgroup bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 17 | 12,968,929 | 762,482 | 6.08 | 4.96 | 410,836,992 |
| 50 | 36,725,538 | 734,133 | 17.13 | 13.79 | 501,235,712 |
| 100 | 72,745,873 | 727,088 | 32.88 | 26.69 | 655,745,024 |
| 200 | 145,498,609 | 727,125 | 66.38 | 53.97 | 1,031,639,040 |

Mọi output của probe qua qpdf --check, đúng số trang, orientation và SHA-256 từng
stream JPEG so với thứ tự capture đầu vào; thư mục output được xóa sau chạy.
50/100/200 vượt cap sản phẩm 20 MiB; probe không được tính là job production PASS.
200 trang nằm dưới 150 MiB chỉ với fixture này; không chứng minh cap đủ cho sách.
Khác image có thể vượt cap. CPU trong bảng là Node user+system, không gồm qpdf.

Regression codec kiểm tra early stop, đủ ba quality, target mềm, kích thước native,
sai số pixel vùng chữ Việt/nét mảnh và abort. Sai số pixel là corruption guard,
không phải nghiệm thu bản in hoặc đánh giá mọi font. Viewer fixture local kiểm tra
trang trắng/ngang, bitmap lazy-load, thiếu/trùng/sai thứ tự, quyền Print, overflow,
thay tổng trang, timeout và cleanup. Integration thật dùng HTTP → source fixture →
qpdf → fake GCS, kiểm tra idempotency, retry và phục hồi upload/result bị gián đoạn.

- Shared build, server/client typecheck, client lint, Worker check: đạt.
- Worker local suite trước phần gom hằng DPI/MP: 97 passed, 2 Linux-only skipped.
  Hai test Linux-only được chạy trong Docker integration: 26/26 passed, no skip.
- Gateway 15/15; targeted server PDF/provider/validation 17/17 passed.
- Docker image build: lần đầu lỗi npm ECONNRESET; retry build thành công. Docker
  renderer smoke dùng source cuối và shared dist mount read-only: 38/38 passed,
  no skip, Chromium/Sharp/pdf-lib thật và network tắt.
- Drive link do user cung cấp: đọc ẩn danh thấy 17 trang, một Print control disabled;
  smoke trả `PDF_VIEWER_SMOKE_PRINT_NOT_PERMITTED_OR_UNAVAILABLE`, không chụp trang.
  Đây là negative permission evidence, không phải benchmark tạo PDF thành công.

## Documentation updated

Feature, v1 API budget, operations và current status phản ánh adaptive codec và
giới hạn hiện tại. Product contract chưa đổi giới hạn nghiệm thu vì chưa triển khai
queue 200 trang; yêu cầu nâng cấp vẫn mở, không được đánh dấu hoàn thành.

## Rollback

PR chỉ đổi source. Revert commit để khôi phục codec cố định; nếu sau này được phép
rollout, operator khôi phục immutable Worker revision trước. Không migration dữ
liệu, không đổi format GCS/result, không sửa IAM/secrets/traffic, không xóa kết quả cũ.

## Remaining risks

- Chưa làm PR queue/chunk, bounded final merge hoặc UI progress/E2E 200 trang.
- pdf-lib còn giữ toàn bộ compressed image streams và final buffer; PNG/native
  encoding xử lý từng trang không đồng nghĩa bộ nhớ toàn job hằng số.
- Chưa benchmark browser/Cloud Run, cold start, output transport 150 MiB, lỗi giữa
  các chunk, cleanup checkpoint bền vững, chi phí theo batch hoặc giấy in thực tế.
- Cần Viewer khác Owner được phép tải/in tại 17/50/100/200 trang. Link 17 trang hiện
  bị khóa Print không đáp ứng happy path. Không chụp để vượt hạn chế chủ file.
- Docker base hiện dùng npm 11.16.0 và cảnh báo engine npm >=12; đây là khác biệt
  runtime build sẵn có, chưa thay Docker image/toolchain trong PR nén.
