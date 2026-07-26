# V20B — Vocabulary media editor acceptance

- [x] Pixabay search luôn có `safesearch=true`, query tối đa 100 và cache ít nhất
  24 giờ; picker hiển thị nguồn Pixabay.
- [x] Provider disable an toàn; fake provider bao phủ search/import/error/timeout.
- [x] Frontend chỉ gửi provider + providerAssetId; arbitrary URL bị từ chối.
- [x] Asset phải còn trong cache; allowlist/redirect limit 2/timeout 5 giây/max
  5 MiB/MIME sniff/256–4096 px/16 MP/JPEG-PNG-WebP được test.
- [x] Unique provider + asset ID deduplicate cả request concurrent.
- [x] Metadata nguồn, contributor, attribution, license và alt từ nghĩa đã duyệt
  được lưu.
- [x] URL preview chỉ dùng tạm; selected asset được download và serve same-origin
  với immutable cache/nosniff.
- [x] Binary nằm trong named volume, không nằm MySQL hoặc writable layer tạm.
- [x] Picker/editor usable ở 360–430 px, không horizontal scroll và không có upload
  thủ công.
- [x] Backup/restore smoke gồm media volume; targeted checks và full gate PASS.
