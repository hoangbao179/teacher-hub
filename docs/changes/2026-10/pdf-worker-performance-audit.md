# Audit hiệu năng PDF Worker và lifetime của anchor

## Task level

Initial / final: Level 2. Sửa lifetime buffer/handle và cancellation trong Worker,
thêm regression/browser benchmark; không đổi architecture, persisted contract,
quyền, deployment hoặc tài nguyên. Audit baseline `7505c827c44e533fddb4bb941bde357098142662`.

## Problem và root cause

Commit baseline thực sự tránh export PNG trang 1 hai lần trong chunk đầu: test
chạy bằng Chromium thật, không phải fake DOM. Chỉ tiết kiệm một capture cho cả
tài liệu; discovery và các chunk khác vẫn cần anchor độc lập. Guard kiểm source,
geometry, stale binding, timestamp và quiet window; fallback hash lại trang 1.
Không tìm thấy stale bitmap được chấp nhận trong các regression đã chạy. Đây
không phải chứng minh mọi biến thể DOM/nguồn Drive sẽ an toàn hoặc được hỗ trợ.

Hai vấn đề lifetime còn lại:

- Nếu guard từ chối reuse, PNG anchor vẫn bị giữ trong biến ngoài trong lúc
  capture và encode PNG mới; PNG cũ chỉ được thả ở cuối chunk. Hai buffer có thể
  cùng tồn tại, trái với ý định working set một PNG. Đây là kết luận từ source,
  chưa có phép đo peak RAM chứng minh mức giảm.
- Seek không dispose handle kết quả và không tự nghe abort trong lúc polling.
  Gọi helper độc lập có thể chờ hết 30 giây dù signal đã abort. Production
  `withDriveViewer` đã có listener đóng browser ngoài cùng: không được suy số đo
  helper dưới đây thành mức tăng tốc production khi hết deadline toàn job.

## Bottleneck và decision

| Giai đoạn | Kết luận từ source / bằng chứng |
| --- | --- |
| Admission/queue | Create commit DB rồi tick, capabilities/ready và Gateway gọi mạng; queue concurrency 1. Không có số đo Cloud Tasks/cold start live. |
| Browser/readiness | Mở browser/context riêng mỗi discovery/chunk; 50 trang cần 6 session, 200 trang cần 21 nếu không retry. Giữ isolation/cleanup. |
| Capture | Seek RAF có bước scroll 175 ms; readiness 500 ms, zoom settle 250 ms và bitmap quiet 750 ms giữ nguyên. Decode thành công, identity và native DPI vẫn bắt buộc. |
| PNG/JPEG | Canvas PNG + base64 vẫn cần; adaptive JPEG có tối đa ba encode 90/85/80 từ PNG gốc, 4:4:4, không resize. Raw-decode-once probe không nhanh hơn nên không triển khai. |
| Writer/parser/upload | Writer Windows rất ngắn trong microbenchmark; không có bằng chứng đáng thay writer. Giữ ba qpdf checks, hash, streaming upload và final immutable assembly recovery. |
| Checkpoint → task | Worker không enqueue; API đọc checkpoint, lease có lịch +15 giây, UI poll 5 giây, timer mỗi phút. Có thể chi phối tài liệu dài; không có live timestamp để kết luận đã chi phối một job cụ thể. |
| Result/UI | GCS result cần API xác nhận trước COMPLETED; UI poll/hidden tab và lease timing còn tạo độ trễ hiển thị. Không công bố thành công sớm. |

Chỉ sửa các lifetime/cancellation có regression rõ ràng. Không giảm quiet window,
quality, cap hoặc validation để tạo tốc độ giả. Chưa chứng minh job PDF thành công
nhanh hơn end-to-end; mục tiêu throughput/latency sản phẩm **NOT VERIFIED**.

## Changes

- `viewer-chunk.ts`: thả PNG anchor trước fallback; seek dùng `withViewerAbort`,
  dispose handle khi thành công. Giữ fingerprint và cleanup partial writer.
- `viewer-chunk.test.mjs`: thay node giữ nguyên source, đổi geometry, thay source
  sau anchor, abort khi seek trong chunk, kiểm partial cleanup và dispose handle.
- Hai script benchmark offline để phân biệt writer/codec với canceled seek.
  Không dùng file PDF riêng của người dùng làm fixture.

## Benchmark

Windows, Node 24.18.0 / npm 12.0.1, cùng máy và fixture, không hard cap CPU/RAM.
Baseline là source từ commit trên, chỉ sửa đường dẫn import của bản tạm để chạy.
Các số sau không phải Linux 1 CPU/2 GiB, Google Drive hay Cloud Run.

Seek không có heading, signal abort sau 150 ms (một mẫu/mỗi phiên bản):

| Chỉ số | Baseline | Sau sửa |
| --- | --- | --- |
| Thời gian seek trả lỗi | 30.007,76 ms | 160,83 ms |
| Page đã đóng khi helper trả về | Không | Có |
| Browser startup riêng | 221,41 ms | 222,71 ms |

Chỉ xác minh cancellation của helper. Không báo phần trăm tăng tốc job PDF.

Writer-only: ba mẫu/mốc, median ms; tái sử dụng cùng JPEG đã encode ngoài timer.
Writer không đổi, nên chênh lệch hai lượt là biến thiên/control, không phải gain.
Bảng dùng lượt baseline/control chạy tuần tự sau khi browser regression đã kết
thúc; loại lượt control trước đó có test chạy đồng thời. Bytes và hash JPEG
giống nhau ở cả hai lượt.

| Trang | Baseline ms | Lượt sau ms | PDF bytes |
| --- | --- | --- | --- |
| 5 | 2,99 | 3,29 | 3.739.370 |
| 17 | 6,61 | 7,01 | 12.713.308 |
| 50 | 17,21 | 16,11 | 37.391.740 |
| 100 | 32,12 | 32,52 | 74.783.441 |
| 139 | 45,78 | 43,40 | 103.948.968 |
| 200 | 62,57 | 62,09 | 149.566.842 |

Base64 → Buffer ~0,288 ms/PNG (30 lặp, gồm equality check); adaptive JPEG từ
PNG texture 1800×2547 ~121,78 ms (một mẫu). Raw probe với ảnh noise toàn trang:
ba quality từ PNG ~354,74 ms, decode raw một lần rồi ba quality ~360,58 ms;
microprobe một mẫu, không đủ để khái quát codec. Không đưa raw variant vào source.
Không đo canvas encoding, toàn process-tree memory/CPU, queue gap, retry rate,
GCS upload hay qpdf trên máy này. Peak RSS script writer gồm cả verifier pdf-lib,
không đại diện working set Worker hoặc peak Chromium.

## Verification

- Node/npm đúng runtime; build shared cần thiết vì dist cũ thiếu export parser.
- Worker TypeScript/syntax/print-policy checks: PASS.
- `npm.cmd run check` tại `workers/pdf`: PASS (TypeScript, syntax, 3 policy tests).
- `node --test` tại Worker với `capture-page`, `viewer-chunk`, `viewer-ready`,
  `viewer-pdf`, `jpeg`, `chunk-diagnostics`, `print-policy`: 84 PASS, 0 FAIL,
  0 SKIP. Gồm thứ tự ảnh khác nhau, native dimensions, đổi fingerprint, decode
  muộn, timeout, abort và cleanup.
- `node --test` với `chunk-pipeline`, `processing`, `server`, `storage`,
  `viewer-page-indicator`: 33 PASS, 0 FAIL, 8 SKIP có sẵn theo platform.
  Không thêm hoặc thay skip để vượt gate.
- `npm.cmd run check:repo`, `npm.cmd run check:docs`: PASS.
- Linux/qpdf integration: NOT VERIFIED. Docker Desktop engine không chạy kể cả
  khi kiểm tra ngoài sandbox; chỉ có distro docker-desktop, không có Linux runtime
  sẵn dùng. Các integration có guard Linux sẵn trong suite được báo SKIP, không
  tính là PASS. Không khởi động/sửa Docker hoặc cài parser để giả lập production.
- Drive khác Owner được phép tải, Cloud Run end-to-end, resource-capped benchmark,
  bản in và pipeline đầy đủ 5/17/50/100/139/200 trang: NOT VERIFIED.
- Baseline test ban đầu fail ở import `shared/dist` cũ; build lại shared giải
  quyết nguyên nhân môi trường, không sửa contract hay bỏ test.

## Documentation updated

Feature doc bổ sung lifetime, cancellation, scheduling và ranh giới benchmark.
Không đổi current-state status thành production-ready.

## Rollback

Revert commit task để trở về helper/anchor lifetime baseline. Không migration,
backfill hoặc đổi checkpoint nên không có thao tác dữ liệu/Cloud cần rollback.

## Remaining risks và đề xuất cần duyệt riêng

- Khoảng cách kiểm quyền tải/in/copy đã được ghi trong product contract vẫn tồn
  tại; các fixture Print disabled không phải bằng chứng được phép xử lý nguồn đó.
  Không dùng nguồn thật bị hạn chế cho audit này.
- Quiet window vẫn là heuristic; fingerprint chỉ anchor trang 1, không phát hiện
  mọi thay đổi ở trang khác nếu anchor/total giữ nguyên. Không nới cam kết nguồn.
- Đo timestamp checkpoint/task dispatch/result live trước khi chọn kiến trúc.
  Đường notify checkpoint → producer enqueue ngay, kèm durable polling fallback,
  deterministic task name, retry/idempotency và auth cần review Level 3 riêng.
- Reconciler thường xuyên hơn cần review deployment, số request Gateway/GCS,
  CPU/RAM VPS chung và chi phí; không tự giảm timer/lease delay ở task này.
- Tăng chunk size hoặc giữ browser qua checkpoint thay đổi budget/contract,
  isolation và recovery; cần benchmark Linux/Cloud Run cùng giới hạn hiện có và
  duyệt riêng. Không tăng tài nguyên/timeout để che bottleneck.
