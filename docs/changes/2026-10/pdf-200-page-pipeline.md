# PDF 200 trang: pipeline theo phần, phục hồi và tiến độ

## Task level

Initial/final Level 3: migration additive, cross-service protocol, parser/resource
budgets, public download transport. Phạm vi gồm shared, Worker, Gateway, API outbox,
MySQL, Tools và regression. Không triển khai Cloud Run/IAM/secrets/traffic.

## Problem và root cause

PR #37 giảm JPEG nhưng vẫn ghép toàn bộ stream ảnh bằng pdf-lib trong một request.
Queue cũ chỉ có 5 attempts nên không thể dùng retry như vòng lặp 20 phần. API
không có checkpoint/progress, các tầng tải giới hạn 20 MiB/25–30s và Blob trên UI
không phù hợp file lớn. qpdf CPU limit 5s còn có thể làm PDF lớn hợp lệ bị nhận
nhầm INVALID_PDF khi subprocess bị signal; benchmark đã tái hiện lỗi này.

## Decision và changes

- V2 tách discovery / 10 trang mỗi task / merge; dùng deterministic task theo step,
  GCS create-only checkpoints, source-bound fingerprints/hash/range/expiry. API
  reconciler hiện có phát phần tiếp theo, không thêm Tasks permission cho Worker.
- Writer image-only PDF ghi từng JPEG xuống file, xref nhỏ; qpdf merge từ file.
  Source direct dài được snapshot GCS; Viewer luôn kiểm tra Print, >=200 DPI,
  PNG/native size và anchor. Không dùng view-only để vượt hạn chế trong v2.
- Migration 0029 giữ phiên bản job và progress cache; DB lease bảo vệ write cũ.
  GET/refresh đọc tiến độ đã lưu. Phần trăm tối đa 99 trước khi publish kết quả.
- Gate v2 mặc định tắt, source 20 MiB tách output 150 MiB; scratch yêu cầu operator
  review/provision, không âm thầm mở rộng production. Intake v2 tối đa 1 link,
  2 active/2 creations mỗi giờ; queue concurrency 1 và retry policy giữ nguyên.
- Gateway có capabilities/step/checkpoint routes chính xác và chống replay như cũ.
  Download v2 stream 150 MiB/180s; scoped form POST dùng native browser download,
  không tạo JS Blob lớn. Nginx tắt buffering cho attachment để không spool trên VPS.
- Parser v2 45 CPU s/50s, address space vẫn 512 MiB; signal/CPU kill là retryable
  TIMEOUT. Không tăng container RAM/VPS hoặc đổi base image.

## Verification

Docker local Linux/WSL, 1 CPU/2 GiB, no swap, offline, concurrency một; image cuối
đã tắt Sharp cache và đặt một encoder thread. Fake GCS
trên đĩa tách scratch 384 MiB; một lần thành công/mốc, không phải SLA. Nội dung
tổng hợp có text Việt, nét mảnh, texture màu deterministic, trang ngang và trang
chỉ chữ; native >=200 DPI. Pipeline chạy các bước liên tiếp để đo compute, không
gồm chờ reconciler mỗi phút. Không có Chromium/Drive/cloud queue trong bảng này.

| Trang | Phần | PDF bytes | Wall s | Bước lâu nhất s | Peak cgroup bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 17 | 2 | 12,804,772 | 9.03 | 3.84 | 523,366,400 |
| 50 | 5 | 36,280,884 | 24.75 | 7.08 | 586,104,832 |
| 100 | 10 | 71,871,518 | 48.54 | 14.03 | 663,609,344 |
| 200 | 20 | 143,746,350 | 96.48 | 27.60 | 824,827,904 |

Tất cả qua qpdf, đủ số trang, đúng SHA-256/thứ tự và native dimensions của mọi ảnh;
scratch rỗng sau từng step. Peak gồm cache/tmpfs và test verifier. Production không
load toàn bộ PDF như test-only verifier. Cap 150 MiB có headroom với fixture này,
không bảo đảm mọi sách 200 trang đều vừa; vượt cap vẫn báo lỗi, không giảm DPI.

Các lần FAIL trước khi chốt: parser CPU 5s kill ở final validation; verifier đọc
random I/O trên Windows bind timeout (đã copy sang scratch giống Worker); E2E dùng
hết quota submit sau các case retry (v2 fixture được seed qua service, không nới
rate gate); static XFF assertion cần 3 location thay vì 2 sau thêm streaming route.
Đây không phải bằng chứng PASS của nguồn bị giới hạn quyền.

Coverage gồm lost part checkpoint/result, transient mid-part failure, duplicate
delivery, restart, out-of-order task, immutable source, 50/51-page direct boundary,
>200 reject, browser thật capture noninitial range, changed anchor và Print denied.
MySQL kiểm tra migration/recovery, persisted progress và step-specific outbox.
Tools E2E kiểm tra refresh/recovery/100%/native POST download, public/private,
ticket replay/expiry và mobile layout. Gateway stream test đủ 150 MiB theo chunk.
Checks local cuối: `npm run check:ci` PASS (typecheck/lint/unit/build/repo/docs),
MySQL PDF integration 6/6 PASS, Tools MySQL/FakeCloud browser E2E PASS. Packaged
Docker Worker smoke 37/37 và Gateway smoke 18/18 PASS, không skip; `nginx -t` PASS.
Worker build gặp ECONNRESET hai lần trên bridge; npm ping thành công và build qua
Docker Desktop host network đạt, không sửa Dockerfile/base image. Image smoke
chạy source đóng gói, chỉ mount test read-only. CI cuối được ghi trong PR.
Không commit screenshot/log/PDF. Không chạy thêm toàn E2E legacy local vì routing
đang ẩn; các CI gates hiện hành vẫn giữ và được yêu cầu trước merge.

## Documentation updated

Product acceptance, v2 API/architecture/resource threat model, OpenAPI, feature,
current status và operations/cost/rollback. V1 contract tiếp tục mô tả compatibility.

## Rollback

Xem [runbook](../../operations/pdf-long-documents.md). Drain v2 trước khi tắt handling;
giữ columns/data/object cũ, revert application sau khi drain, không down-migrate
destructive. Migration hồi phục khi DDL xong nhưng chưa ghi ledger. Source PR không
đổi cấu hình cloud; merge có thể chạy workflow API/Web VPS hiện có theo user duyệt.

## Remaining risks

- Chưa chạy Viewer khác Owner được phép tải/in tại 17/50/100/200 trang trên Cloud Run;
  link user trước đó có Print disabled không phải happy path. Không xác nhận giấy in.
- Browser memory/cold start/egress/slow mobile download/network billing và lifecycle
  thực phải được operator kiểm chứng; hiện chỉ có local synthetic/image pipeline.
- Viewer first-page anchor + total không chứng minh snapshot khi trang khác bị sửa
  nhưng anchor/count không đổi. Layout/virtualization khác có thể fail an toàn.
- V2 source vẫn tối đa 20 MiB; PDF direct lớn hơn bị từ chối dù output cap là 150 MiB.
- Remote checkpoints chờ lifecycle bảy ngày, không bị xóa ngay; chi phí/retention và
  max instances phải review. VPS không chứa renderer/PDF tạm lâu dài.
