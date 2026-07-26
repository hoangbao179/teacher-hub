# V20B — Vocabulary media editor

## Trạng thái

**PASS on 26/07/2026**

## Phạm vi

- Thêm Pixabay provider đầu tiên và fake provider cho test; provider disable bằng
  config, key chỉ ở server.
- Cache search tối thiểu 24 giờ, luôn `safesearch=true`, ghi nguồn Pixabay trong
  picker và không gọi provider trực tiếp từ page.
- Import bằng provider + providerAssetId từ cache; harden download, deduplicate,
  rendition và metadata theo feature document.
- Lưu binary vào `vocabulary-media:/app/data/vocabulary-media`; serve same-origin
  bằng media ID immutable.
- Xây image picker/editor responsive, gồm `NONE`, `EMOJI`, `PUBLIC_ASSET`,
  `STORED_MEDIA`; không có upload thủ công.

## Ngoài phạm vi

- Assignment publish/game/result; arbitrary URL import; binary trong MySQL.

## Dependency và verification

Phụ thuộc V20A. Test dùng fake provider; không gọi Pixabay thật trong CI. Chạy
security/integration/UI targeted checks, backup smoke và full gate theo
[acceptance V20B](../acceptance/V20B-VOCABULARY-MEDIA-EDITOR.md).

Dependency xử lý ảnh là `sharp` 0.34.5, tương thích Node 24 của repository. Ảnh
ngoài chỉ được decode sau các gate host/redirect/byte/MIME, rồi chuyển thành hai
rendition WebP; không giữ filename hay URL binary của provider làm URL runtime.
