# Vocabulary Media Hardening Acceptance

- [x] PENDING không hiển thị thành EMPTY; 429 giữ cursor và resume sau cooldown.
- [x] Bulk chỉ chạy batch tối đa 8 và một request client tại một thời điểm.
- [x] Provider coordinator dùng chung chặn upstream trong cooldown.
- [x] Query fallback tuần tự, bỏ noise và ưu tiên manifest local.
- [x] Import trả mã 429/502/504/422 cụ thể, retry có giới hạn và không lộ URL.
- [x] Upload một JPEG/PNG/WebP tối đa 5 MiB, Sharp decode, hai WebP và dedupe SHA-256.
- [x] Media tạm được promote khi lưu set; cleanup 24 giờ bảo vệ mọi tham chiếu assignment.
- [x] Reconciliation và metrics đếm đủ game + thumbnail bytes.
- [x] Public media không còn limiter 60 request/phút/IP và dùng immutable cache.
- [x] Targeted server/client/browser tests PASS.
- [x] Một từ bulk phát sinh tối đa hai search request và không cố tìm đủ 12 ảnh.
- [x] Đổi ILLUSTRATION/PHOTO không giữ state cũ và không tự search.
- [x] Tìm lại có controller/lock riêng và chỉ gọi candidate được bấm.
- [x] Internal provider interval chờ tuần tự, không trả 429 giả.
- [x] Import source 429 không sleep; transient download chỉ retry một lần.
- [x] Thumbnail sau import trả WebP decode được từ cùng storage root.
- [x] Admin CSP cho phép `blob:` và `cdn.pixabay.com`, không dùng wildcard.
