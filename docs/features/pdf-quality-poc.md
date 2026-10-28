# Thử nghiệm PDF — bằng chứng lịch sử và giới hạn suy luận

## Phạm vi bằng chứng

Các số dưới được bảo toàn từ ghi chép thử nghiệm trước đợt kiểm toán tài liệu
28/10/2026, **không chạy lại trong đợt này**, không phải số đo production hiện tại.
Chi tiết từng lần chạy nằm trong Git history của tài liệu này và các report PDF
đã hợp nhất. Artifact riêng tư/ảnh/PDF không commit, chỉ ở `.artifacts/`.
Trạng thái triển khai hiện hành chỉ tại [status](../implementation/status.md).

Cgroup peak gồm memory được kernel tính cho container, cache/tmpfs; RSS theo
process/tree có thể đếm trùng shared mapping và peak không đồng thời. Không cộng
RSS browser/Node vào cgroup peak để suy RAM vật lý. Disk logical bytes, tmpfs,
image size Docker, unpacked layers/cache và VM/OS là các khoản riêng. Giới hạn
container không phải cấu hình đủ cho cả VPS. Windows khoảng 1,4 GiB gần 300 DPI
trên Drive 17 trang khác workload Linux 5 trang; không so thành lợi thế hệ điều hành.

## PoC Node và Viewer local năm trang

Fixture owned synthetic có chữ Việt 6–12 pt, nét 0,25–1 pt, trang trắng thứ 3,
ảnh màu thứ 4, landscape thứ 5. PDF.js 300 DPI; so khổ, pixel và thứ tự gần nhất.
Không OCR, không benchmark mọi sách hoặc nghiệm thu giấy in.

| Codec trên Windows Node 24.18.0 | PDF byte | Encode + assemble giây | Peak encode RSS MiB | RMSE lớn nhất |
| --- | ---: | ---: | ---: | ---: |
| RGB PNG | 1.190.763 | 2,20 | 200,5 | 0 |
| Indexed 128 | 469.777 | 2,63 | 171,8 | 1,636 |
| Indexed 256 | 924.118 | 2,84 | 176,2 | 0,262 |
| JPEG 85 | 1.230.930 | 0,28 | 209,6 | 0,922 |
| JPEG 92 | 1.392.005 | 0,28 | 209,6 | 0,549 |
| JPEG 97 | 1.804.712 | 0,28 | 210,2 | 0,388 |

Indexed 256 là lựa chọn **của fixture PoC**, không phải codec Worker hiện tại
(JPEG 90/85/80). Giữ RGB khi cần lossless/màu chính xác. Monitor Windows corrected
đo whole tree 535,7 MiB, verification riêng có thể lớn hơn encode; không lấy delta
trước/sau encode làm peak tạm thời. Linux Node-only 1/1,5/2 GiB hoàn tất 6 run
RGB/indexed 256, cgroup peak 436,5–480,2 MiB, 9,38–12,65 giây; controlled 64 MiB
OOM và 2 giây timeout đều INCOMPLETE, cleanup đạt.

Browser PoC là PDF.js local offline, không Google Drive. Linux/WSL2 Docker,
Node 24.18.0, Playwright 1.61.1/Chromium 149.0.7827.55/PDF.js 6.4.299, host VM
khoảng 16 GB, quota 1 CPU/container, concurrency 1, không swap. Mode giữ canvas
cả tài liệu ở cap 4 GiB: cgroup 644,8 MiB/17,93 giây. Mode tuần tự:

| RAM cap | Cgroup peak MiB | Wall giây |
| --- | ---: | ---: |
| 4 GiB | 493,7 | 18,20 |
| 3 GiB | 491,8 | 18,02 |
| 2 GiB | 485,4 | 18,12 |
| 1,5 GiB | 489,3 | 18,35 |
| 1 GiB | 456,5 | 18,12 |
| 768 MiB | 481,1 | 18,43 |
| 512 MiB | 469,5 | 18,95 |

512 MiB đã có **4 lần hoàn tất và 1 OOM**, không phải xác suất lỗi hay capacity
ổn định. Không chọn 512 MiB vì một run đạt. Mode giữ canvas 512 MiB OOM được
supervisor phát hiện, dọn container/job; timeout browser 3 giây kết thúc khoảng
3,03 giây. Mode tuần tự đóng browser trước encode/verify, PDF ~763.414 byte,
đủ 5 trang, đúng chiều/khổ; sai số raster khác renderer gốc, chưa in giấy.
Image browser Docker báo ~376,5 MB, không gồm host/cache/layers unpacked.

## Drive thật trên fixture owned được phép in

Ghi nhận 22/10/2026: upload owned-synthetic-original.pdf, 5 trang, anonymous,
Download/Print bật, không session Google. Không chứng minh Viewer khác Owner,
nguồn khóa Print hoặc rollout Cloud Run. Linux Docker 1 CPU, không swap:

| RAM cap | Cgroup peak MiB | CPU giây | Wall giây | PDF byte |
| --- | ---: | ---: | ---: | ---: |
| 4 GiB | 546,8 | 16,05 | 17,50 | 647.534 |
| 2 GiB | 538,2 | 15,90 | 17,16 | 647.537 |
| 1 GiB | 579,8 | 15,43 | 16,93 | 647.536 |

Đủ 5/5 trang, trắng/ngang đúng, kích thước sai ≤0,01 pt. Native portrait
2400×3396 khoảng 290 DPI; landscape 2400×1696 khoảng 205 DPI, không đồng đều
300 DPI. Thử zoom 500% bị clamp 400%, chờ bitmap lớn hơn timeout, không phải
bằng chứng có thêm chi tiết. Không upscale. RMSE mỗi trang so gốc lần lượt
6,640/16,031/0/7,888/5,567, chữ Việt 6 pt đọc được trên màn hình; chưa in giấy.
Temp job ~4,33 MiB và profile ~31,14 MiB là peak riêng; image 376.530.541 byte.
Forced timeout 5 giây kết thúc 5,11 giây, dọn partial. Không thử Drive <1 GiB,
không có Drive-specific OOM để chứng minh cleanup ngoài controlled PoC.

## Nén và pipeline dài tổng hợp

Hai phép đo khác nhau, không gộp thành benchmark renderer Drive:

| Trang | Codec + pdf-lib: PDF byte / wall giây / cgroup byte | V2 chia phần: PDF byte / wall giây / cgroup byte |
| --- | --- | --- |
| 17 | 12.968.929 / 6,08 / 410.836.992 | 12.804.772 / 9,03 / 523.366.400 |
| 50 | 36.725.538 / 17,13 / 501.235.712 | 36.280.884 / 24,75 / 586.104.832 |
| 100 | 72.745.873 / 32,88 / 655.745.024 | 71.871.518 / 48,54 / 663.609.344 |
| 200 | 145.498.609 / 66,38 / 1.031.639.040 | 143.746.350 / 96,48 / 824.827.904 |

Linux/WSL Docker 1 CPU/2 GiB, không swap/network, fixture native ≥200 DPI có
chữ Việt/nét mảnh/texture deterministic/trắng/ngang. Một run/mốc. Codec probe
dùng scratch nghiên cứu 256 MiB, cố ý vượt admission v1; không dùng cấu hình đó
cho production. V2 scratch 384 MiB, fake GCS ở đĩa riêng, step liên tiếp không
chờ timer/queue, longest step 3,84/7,08/14,03/27,60 giây. Validate qpdf, thứ tự/
hash ảnh/dimensions đạt, scratch sạch từng bước. Không có Chromium/Drive trong
hai bảng. PDF 200 trang vừa cap không bảo đảm mọi sách vừa cap.

Lỗi đã gặp có giá trị thiết kế: qpdf CPU 5 giây kill khi validate file lớn →
v2 dùng 45 CPU/50 wall giây; verifier random I/O Windows bind timeout khác
Worker scratch; pdf-lib giữ JPEG và buffer serialize nên cần writer file/merge;
queue 5 attempts không thể dùng retry làm vòng lặp 20 phần. Các quyết định này
đã nằm trong [contract v2](../api/pdf-worker-v2.md).

## Tái lập và phạm vi test

Node 24/npm 12; cài dependency riêng `scripts/pdf-poc`, input owned/được phép,
output directory mới. Ví dụ PowerShell hoặc Bash (path tương đối từ repo):

```text
npm ci --prefix scripts/pdf-poc
npm --prefix scripts/pdf-poc test
npm --prefix scripts/pdf-poc run check
node --expose-gc scripts/pdf-poc/benchmark.mjs <PDF_DUOC_PHEP> .artifacts/pdf-quality/RUN_MOI
node scripts/pdf-poc/linux-benchmark.mjs <PDF_DUOC_PHEP> .artifacts/pdf-linux/RUN_MOI
node scripts/pdf-poc/browser-linux-benchmark.mjs <PDF_DUOC_PHEP> .artifacts/pdf-browser/RUN_MOI --baseline-only
```

Placeholder phải thay trước chạy; Docker harness chỉ local engine, không remote
SSH/TCP. Browser probes có --matrix, --faults-only, --stability; không chạy song
song. Drive PoC dùng drive-policy pin SHA local original/title/count/Print, không
lấy tài liệu khóa quyền. Với authorized renderer smoke riêng trên Linux đã có
Worker dependency/qpdf/prlimit/browser (TÁC ĐỘNG TẢI NGUỒN THỬ ĐƯỢC PHÉP):

```bash
export PDF_AUTHORIZED_VIEWER_FILE_ID='<ID_VIEWER_DUOC_PHEP>'
export PDF_AUTHORIZED_VIEWER_E2E_APPROVED=true
npm --prefix workers/pdf run test:viewer:authorized
unset PDF_AUTHORIZED_VIEWER_E2E_APPROVED PDF_AUTHORIZED_VIEWER_FILE_ID
```

Smoke này báo capture NOT_VERIFIED, restricted NOT_SUPPORTED bất kể env; output
tạm bị xóa, chỉ metadata. Không chứng minh Tasks/GCS/website/v2 200 trang.
Test offline bảo vệ lazy-load/đổi node/decode/blank/landscape/anchor, byte/DPI,
abort/cleanup; im lặng DOM 750 ms không chứng minh Google không thay ảnh muộn.
Thiếu browser binary và qpdf/prlimit từng làm CI lỗi dù image/local đạt; CI phải
cài/probe đúng dependency, không skip Linux E2E. Số test đã đạt ở report cũ là
kết quả lịch sử, không lặp lại thành kết quả kiểm toán hiện tại.

Không triển khai renderer vào API 384 MiB hoặc VPS chung 1,5 GB. Chưa có nghiệm
thu giấy in, Drive Viewer khác Owner ở 200 trang, Cloud Run cold start/load/egress,
chi phí thực hay quyền đầy đủ từ các thử nghiệm này.
