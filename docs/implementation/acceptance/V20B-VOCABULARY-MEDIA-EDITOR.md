# V20B — Vocabulary media editor acceptance

- [ ] Pixabay search luôn có `safesearch=true`, query tối đa 100 và cache ít nhất
  24 giờ; picker hiển thị nguồn Pixabay.
- [ ] Provider disable an toàn; fake provider bao phủ search/import/error/timeout.
- [ ] Frontend chỉ gửi provider + providerAssetId; arbitrary URL bị từ chối.
- [ ] Asset phải còn trong cache; allowlist/redirect limit 2/timeout 5 giây/max
  5 MiB/MIME sniff/256–4096 px/16 MP/JPEG-PNG-WebP được test.
- [ ] Unique provider + asset ID deduplicate cả request concurrent.
- [ ] Metadata nguồn, contributor, attribution, license và alt từ nghĩa đã duyệt
  được lưu.
- [ ] URL preview chỉ dùng tạm; selected asset được download và serve same-origin
  với immutable cache/nosniff.
- [ ] Binary nằm trong named volume, không nằm MySQL hoặc writable layer tạm.
- [ ] Picker/editor usable ở 360–430 px, không horizontal scroll và không có upload
  thủ công.
- [ ] Backup/restore smoke gồm media volume; targeted checks và full gate PASS.
