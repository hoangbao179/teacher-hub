# Audit hiệu năng và correctness PDF Worker — PR #73

## Task level

Initial / final: **Level 2**. Sửa guard loading, lifetime buffer/handle và cancellation,
không đổi API, persisted contract, quyền, deployment, tài nguyên hay kiến trúc.
Baseline PR được audit sâu: `5ef7eac`; baseline hiệu năng trước PR: `94fe915`.

## Problem, root cause và decision

### P1 — reuse anchor bỏ qua loading

`viewer-chunk.ts` kiểm signature/timestamp/quiet window nhưng thiếu busy check;
observer trong `capture-page.ts` không theo dõi `role`. Thêm progressbar bằng
role hoặc làm hiện progressbar qua CSSOM có thể giữ nguyên chữ ký ảnh và timestamp,
cho phép ghi anchor cũ trong lúc Viewer đang thay ảnh. Chromium regression trước
sửa fail ở assertion writer không được ghi khi loading; thay source sau loading
còn bỏ qua fingerprint mới. Đây là lỗi correctness có bằng chứng, không chỉ giả thuyết.

Fix: observation cung cấp chung `isBusy()` cho capture và reuse, cập nhật changedAt
khi loading hiển thị; observer thêm `role`. Không capture/hash lại vô điều kiện.
Regression sau sửa gồm role, CSS visibility không mutation, loading kết thúc bằng
thay node, source đổi phải fail fingerprint, PNG fallback đúng hai lần.

### P2 — lỗi layout tạm bị kết luận permanent trong loading

Khi hai ảnh cũ/mới cùng tồn tại quá 750 ms, resolver trả
`ambiguous-layout-multiple-images` trước busy check. Reproduction Chromium trước
sửa trả `UNSUPPORTED_SOURCE` không retry thay vì đợi ảnh mới. Capture nay trì hoãn
layout error khi busy và giữ quiet window sau loading. Vẫn scroll heading ngoài
viewport để Viewer lazy-load hoàn tất; regression offscreen chống deadlock.
Loading không kết thúc vẫn bị timeout, không được chấp nhận ảnh chưa ổn định.

### P3 — polling handles readiness/zoom chưa dispose

Instrument Chromium trước sửa ghi nhận ba handle polling thành công, không handle
nào được dispose. `viewer-ready.ts` và `viewer-pdf.ts` nay dispose cả ba; regression
xác nhận 3/3. Đây là lifetime bị giới hạn bởi context, chưa chứng minh memory leak
lớn hay giảm peak RSS. Không thêm refactor speculative.

Các sửa trước trong cùng PR được giữ: bỏ strong reference PNG anchor trước fallback;
seek dùng `withViewerAbort` và dispose handle. Buffer được giữ đến khi encode/write
settle rồi mới bỏ reference, không khẳng định GC trả RAM ngay. Guard chạy đồng bộ
trong browser, snapshot sau guard có cùng giới hạn thời điểm như fresh capture;
không tìm thấy regression TOCTOU khác trong source/node/geometry/scroll/decode tests.
Fingerprint vẫn chỉ trang 1 + total, không phải document revision toàn bộ.

## Changes và cleanup evidence

- Capture/reuse dùng chung busy validation; readiness/zoom giải phóng handle.
- Chromium regressions kiểm source/node/loading/overlap/offscreen, abort trước capture,
  page đóng, lỗi encode, lỗi writer, abort encode/loading, file đích đã có.
- Cleanup kiểm handles được dispose, observer Worker disconnect, partial PDF bị xóa,
  file caller đã có không bị xóa. Không tính observer injected-script của Playwright.
- Thêm successful-path offline benchmark có real Chromium, Sharp, writer và kiểm
  page count, thứ tự bằng pixel marker, native portrait/landscape/blank dimensions.
- Không đổi codec, quality 90/85/80, 4:4:4, DPI 200, quiet window 750 ms, cap,
  qpdf checks, checkpoint/hash/idempotency hoặc quyền tải/in/copy.

## Benchmark thành công

Windows, Node 24.18.0/npm 12.0.1, Chromium/Sharp đã cài, cùng máy/fixture; chạy tuần
 tự, không chạy test CPU song song. Mỗi mốc ba mẫu, bảng là median ms. Script
`viewer-success-benchmark.mjs` nạp bốn module audit từ Git baseline `94fe915` hoặc
working tree sau sửa; dependencies còn lại giống nhau. Mỗi discovery/chunk có
browser mới, fixture virtualized 1800×2547, trang 10 ngang, trang 17 trắng, các
trang khác có chữ Việt, đường mảnh và noise xác định. Không dùng tài liệu riêng.

| Chỉ số | 5 trang trước | 5 trang sau | 17 trang trước | 17 trang sau |
| --- | ---: | ---: | ---: | ---: |
| Wall gồm fixture setup | 21433,09 | 21653,67 | 42836,35 | 42423,28 |
| Wall trừ fixture setup | 7856,33 | 8088,88 | 22472,18 | 22027,11 |
| Browser launch | 109,57 | 167,88 | 313,84 | 191,54 |
| Context/page setup | 96,33 | 121,69 | 198,38 | 184,90 |
| Readiness | 1038,97 | 1044,70 | 1562,43 | 1553,59 |
| Zoom settle | 523,52 | 526,76 | 779,16 | 789,86 |
| Seek | 52,35 | 58,02 | 214,17 | 208,19 |
| Capture polling tổng | 5110,03 | 5107,85 | 16387,62 | 16219,49 |
| Handle JSON transfer | 123,67 | 131,21 | 399,66 | 366,20 |
| JPEG encode | 636,38 | 735,46 | 2299,66 | 2213,29 |
| Writer page | 3,12 | 3,06 | 14,76 | 11,25 |
| PNG export (nằm trong capture) | 258,20 | 266,80 | 837,60 | 795,60 |
| Decode (chồng lấp capture/fixture) | 72,60 | 91,40 | 353,60 | 333,40 |
| Dynamic fixture render (chồng lấp seek/capture) | 249,80 | 269,50 | 1055,50 | 1000,40 |
| Node CPU, không gồm Chromium | 1578 | 1625 | 5126 | 4891 |
| Tổng PNG export trang 1 | 3 | 2 | 4 | 3 |
| Tổng JPEG attempts | 15 | 15 | 49 | 49 |
| PDF part bytes tổng | 3772054 | 3772054 | 12123756 | 12123756 |

Các median độc lập không cộng thành median tổng. Capture bao gồm quiet window,
PNG, decode và một phần fixture render; không cộng lại các stage lồng nhau.
Fixture setup tốn khoảng 6,8 giây/session, báo riêng, không coi là latency Drive.
Harness dùng longCap; từng part dưới cap production 20 MiB (ngay tổng 17 trang
cũng dưới cap), không dùng benchmark này để chứng minh enforcement cap.

Wall trừ fixture: 5 trang trước 7782–7907 ms, sau 7975–8236 ms; 17 trang trước
22319–22542 ms, sau 21993–22733 ms. **Chưa chứng minh speedup đáng tin cậy**:
5 trang chậm hơn khoảng 3%, 17 trang median nhanh khoảng 2% nhưng khoảng mẫu chồng
lấp. Đã chứng minh loại một PNG export của chunk đầu; không tiết kiệm mọi chunk.
Reuse ổn định trong 3/3 mẫu mỗi workload; hit rate Drive thật chưa đo.

Bottleneck xác minh trong fixture: capture/settling (~16,2 s ở 17 trang), rồi JPEG
(~2,2 s), không phải writer (~0,011 s). Không giảm safe wait để làm đẹp benchmark.
Native PNG export nhỏ hơn tổng JPEG nhiều lần ở fixture này; adaptive attempts
không đổi, không có bằng chứng được phép bỏ quality candidates. Seek trang xa
Drive thật có thể khác lớn do virtualization/network; số đo offline không thay thế.

Không đo checkpoint upload, qpdf, final merge, queue, network, cold start, process-tree
CPU/peak RAM hay retry rate. Node peak RSS gồm verifier giữa các lượt và không gồm
Chromium nên không dùng kết luận working set. Không hard cap 1 vCPU/2 GiB; local
Windows không chứng minh Cloud Run production. 50/100/139/200 chưa benchmark capture
thành công; chỉ có writer-only và mô hình phía dưới, không ngoại suy thành số đo.

### Các microbenchmark trước trong PR

Canceled seek: 30007,76 → 160,83 ms khi abort sau 150 ms, một mẫu mỗi phiên bản;
chỉ chứng minh helper cancellation, production outer wrapper đã đóng browser khi
abort. Không dùng làm speedup job thành công.

Writer-only ba mẫu/mốc, JPEG encode ngoài timer, bytes/hash giống nhau:

| Trang | Baseline median ms | Control median ms | PDF bytes |
| --- | ---: | ---: | ---: |
| 5 | 2,99 | 3,29 | 3739370 |
| 17 | 6,61 | 7,01 | 12713308 |
| 50 | 17,21 | 16,11 | 37391740 |
| 100 | 32,12 | 32,52 | 74783441 |
| 139 | 45,78 | 43,40 | 103948968 |
| 200 | 62,57 | 62,09 | 149566842 |

Writer không đổi: control là biến thiên, không phải gain. Raw decode-once probe
noise toàn trang 360,58 ms so với ba quality từ PNG 354,74 ms (một mẫu), không
triển khai raw variant vì chưa có lợi ích và thêm RAM. Base64→Buffer khoảng
0,288 ms/PNG (30 lần gồm equality), không đại diện toàn transfer.

## Latency model và instrumentation đề xuất

Từ source: K=ceil(N/10), K+2 tasks (discovery, K phần, merge), K+1 browser sessions.
Queue concurrency 1. Worker chỉ ghi checkpoint; API đọc hợp lệ rồi enqueue ngay.
Mọi save, kể cả WAITING trong khi Worker chạy, đặt next_action_at=now+15 s.
UI active poll 5 s, hidden không poll; recovery timer mỗi phút, CLI xử lý tuần tự.
Min instances 0 không đồng nghĩa cold start mỗi task.

Gọi e là enqueue, Q là queue wait, C là platform startup, W là thời gian Worker
(render/validate/upload): checkpoint f=e+Q+C+W. Lấy s là DB save gần nhất (gồm cả
WAITING); lần reconcile tiếp phải >=s+15 và trùng một tick thực tế. r là lần tick
đủ điều kiện đọc được checkpoint sau f; enqueue tiếp xảy ra ngay trong tick đó,
kèm HTTP latency. Gap=r-f+enqueue overhead. Ví dụ f=25 s, tick WAITING ở 15 s đặt
hạn 30 s: gap khoảng 5 s, không phải cộng 15 s cố định, cũng không phải 0 s.

Merge/result có một lần reconcile tương tự. Nếu UI poll chính nó reconcile và
trả COMPLETED thì không cộng thêm 5 s nữa; nếu CLI reconcile trước, cộng phần dư
đến UI poll (~0–5 s và HTTP khi tab visible). Tab hidden có thể chờ đến khi mở lại.

Ví dụ mô phỏng, **không phải dự báo production**: một job, queue/cold/network=0,
timer căn mốc 0, discovery 2 s, phần n trang mất 2+n s, merge 5 s. Từng task ngắn
hơn 15 s, không có retry; bảng gồm reconcile kết quả cuối:

| Trang | K | Sessions / tasks | Worker thuần s | UI poll + gate, visible s | Chỉ timer: DB confirmed s | Previous-part marker reads |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| 17 | 2 | 3 / 4 | 28 | 60 | 240 | 3 |
| 50 | 5 | 6 / 7 | 67 | 105 | 420 | 15 |
| 100 | 10 | 11 / 12 | 127 | 180 | 720 | 55 |
| 139 | 14 | 15 / 16 | 174 | 240 | 960 | 105 |
| 200 | 20 | 21 / 22 | 247 | 330 | 1320 | 210 |

Previous-part reads=K(K+1)/2 từ vòng đọc tất cả marker trước mỗi bước và merge;
chưa tính claim/manifest/result/head, API/Gateway hoặc retries. RTT thật chưa đo.
Không kết luận scheduling là bottleneck production từ bảng giả định này.

Instrumentation tối thiểu cho PR riêng: một structured event/Worker step với jobId,
step, status và số đo allowlist launch/readiness/zoom/seek/capture/PNG/transfer/codec/
writer/parser/storage; một event API reconcile/enqueue với due/checked/enqueue và
step quan sát. Không log URL, fileId, title, cookie, nội dung, source fingerprint.
Dùng Cloud Tasks dispatch và GCS timeCreated sẵn có khi điều tra, không thêm GCS
request runtime. Dispatch→handler-start chỉ là proxy cold/platform/network;
đối chiếu instance-start và clock skew trước khi gán riêng cold start.

Giới hạn đề xuất hai event/step, mỗi event <=512 byte: tối đa khoảng 22 KiB/job
200 trang không retry; đây là ước tính volume, không phải giá tiền. Flag tắt mặc
định/sampling giới hạn, rollback tắt flag. Không thêm persisted field/schema.
Chi phí compute phụ thuộc active vCPU-seconds và GiB-seconds; chưa có billing
mode/latency live để tính tiền. Không suy queue gap thành CPU billable liên tục.

## Tối ưu kế tiếp, xếp theo bằng chứng và tác động

| Ưu tiên | Phương án | Impact / bằng chứng | Risk / complexity | Cost / rollback |
| --- | --- | --- | --- | --- |
| 1 | Đo stage + checkpoint gap trước | Xác định đúng bottleneck; source có gap, chưa có timestamp live | Thấp / vừa; giữ schema log allowlist | Log bounded như trên; tắt flag |
| 2 | Reconcile nhanh hơn hoặc notify checkpoint → producer, giữ polling fallback | Có thể lớn với tài liệu dài nếu gap đo được lớn; hiện là giả thuyết | Cao / cao: Level 3 riêng, auth, idempotency, missed notification, lease | Thêm HTTP/Gateway/GCS/CPU VPS; rollback flag về polling, không xóa checkpoint |
| 3 | Đọc marker trước theo concurrency hữu hạn | 210 reads ở 200 trang đã xác minh từ source; latency gain chưa đo | Vừa / vừa; giữ đủ hash/order/validation và giới hạn burst | Số request không đổi, burst tăng; rollback sequential |
| 4 | Profile codec và seek trang xa bằng nguồn hợp lệ thật | JPEG lớn hơn PNG trong offline; seek thật chưa đo | Vừa / vừa; bảo toàn quality/native pixels/recovery | Benchmark 1 vCPU/2 GiB, đo cả RAM/retry; giữ path hiện tại khi không có gain |
| 5 | Browser pooling, đổi chunk/min instances | Có thể giảm startup nhưng chưa đủ bằng chứng | Cao / cao: isolation, budget, checkpoint contract | Có thể tăng RAM/idle cost; cần duyệt riêng, không triển khai ở PR73 |

Không giảm cả gate/poll xuống 5 s một cách cơ học: WAITING tick khoảng 5 Gateway
reads/job; ba job mỗi 15 s ~60 reads/phút, mỗi 5 s ~180, vượt read budget hiện hành
120/phút (ước tính source, chưa đo live). Tăng timer riêng vẫn gặp gate 15 s.
Mọi thay đổi cron/queue/cross-service phải có proposal và duyệt riêng.

## Verification

- Worker `npm.cmd run check`: PASS TypeScript, syntax, 3 print-policy tests.
- Loading Chromium regression: 6 PASS, 0 FAIL/SKIP, sau khi reproduce fail trước sửa.
- Các regression liên quan và cleanup: kết quả cuối ghi ở PR/final sau khi hoàn tất.
- CI của HEAD trước audit `5ef7eac`: run 41051648288 SUCCESS; Fast quality gate,
  integration, E2E smoke, Schedule đều success. Log Linux quality gate xác nhận
  qpdf/parser, durable resume, final assembly/hash và local HTTP integration chạy.
  Không dùng CI cũ để chứng minh commit mới.
- Local Docker Desktop engine không chạy; không có Linux runtime dùng được nên
  không tự chạy/cài Docker. Linux checks cho commit mới cần CI.
- Cloud Run/Drive khác Owner được phép tải, in thật, qpdf trong successful benchmark,
  Linux resource-capped latency, live queue/cold/upload: NOT VERIFIED.
- Artifact raw JSON chỉ trong `.artifacts/pdf-pr73-deep-audit/`; scratch/PDF được
  xóa sau kiểm. Không commit screenshot, log, PDF hoặc dữ liệu riêng.

## Documentation updated

Cập nhật feature doc `docs/features/pdf-worker.md` và consolidated report này.
Không đổi current-state thành production-ready. Không tạo report trùng.

## Rollback

Revert commit audit hoặc commit PR tương ứng; không migration/backfill, không đổi
checkpoint, API hoặc tài nguyên. Không xóa durable data. Các phương án architecture
ở trên chưa triển khai và có rollback riêng khi được duyệt.

## Remaining risks

Quiet window là heuristic, fingerprint không phủ thay đổi trang khác khi anchor/
total không đổi. Khoảng cách kiểm quyền tải/in/copy vẫn được ghi trong product
contract; fixture Print disabled không chứng minh được phép xử lý nguồn đó.
Không dùng nguồn bị hạn chế thật. PR cải thiện correctness và lifetime; chưa chứng
minh mục tiêu tăng tốc toàn job hay nghiệm thu production end-to-end.
