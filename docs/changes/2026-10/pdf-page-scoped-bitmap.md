# PDF Viewer: vùng trang độc lập

## Task level

Initial/final: Level 3 — sửa capture và readiness cho phát hành Cloud Run Worker.

## Problem và root cause

Job 139 trang dừng ở trang 11 do ancestor cấp 2 có nhiều heading. Resolver cũ
coi ancestor chung là một trang, nên từ chối cả khi heading và bitmap nằm trong
các vùng trang độc lập của hai lớp DOM.

## Decision và changes

Ưu tiên scope DOM nhỏ nhất, cho phép wrapper sâu hơn. Với lớp DOM tách biệt,
chỉ dùng vùng chứa duy nhất một heading, các vùng không chồng nhau và ảnh nằm
trọn trong đúng một vùng. Không dùng nearest-heading, thứ tự DOM hay ảnh trung
tâm làm bằng chứng. Nhiều ảnh, heading trùng hoặc ảnh qua biên vẫn fail-close.
Geometry tham gia identity/quiet window; scroll/resize và thay source/node phải
ổn định sau decode. Không đổi fingerprint, DPI, tổng trang, cap, deadline,
checkpoint hay logic truy cập nguồn.

Pin tĩnh được đồng bộ với live `00022-hap`/`a59482ce…` đã đọc từ Cloud Run.
Repository chưa đặt `PDF_WORKER_AUTO_DEPLOY_ENABLED`, nên không bật managed mode.

## Verification

Local: shared build, Worker check/typecheck, app typecheck/lint, repo/docs guards
PASS; Worker 118 PASS, 4 Linux-only skip (phải chạy qua CI Linux); 101 readiness/
release/workflow tests PASS; live readiness với pin production PASS.
Regression offline: trang 11/12 khác màu, native pixels/dimensions, split layers,
scroll/zoom, decode replacement, recycled node, duplicate/multiple-image,
overlap/boundary, chunk merge và fingerprint. Kết quả kiểm thử và staging ghi
trong PR; offline/health không chứng minh đủ 139 trang trên nguồn thật.

## Rollback và remaining risks

Chỉ stage `pdf-ci` ở 0%, giữ production `00022-hap` 100% cho đến khi kiểm được
fixture hợp lệ và job đang chạy an toàn. Không xóa checkpoint. Nếu đã promote,
chỉ trở về revision tương thích đã kiểm sau khi xác minh dispatch/job hiện hành;
đồng bộ lại readiness pin, không rollback VPS hoặc Gateway.

Viewer DOM không có vùng trang độc lập đo được vẫn bị từ chối. Khoảng cách
Print/canDownload đã ghi trong product contract không được giải quyết ở task này.
Sau promote cần PR cập nhật đồng thời revision/digest trong readiness và test,
rồi chạy live gate; không bỏ gate trong cửa sổ phát hành.
