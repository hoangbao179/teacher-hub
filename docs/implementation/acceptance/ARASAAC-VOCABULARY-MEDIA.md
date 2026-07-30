# ARASAAC Vocabulary Media Acceptance

- [x] ARASAAC là primary cho `ILLUSTRATION`/`ALL`; Pixabay chỉ xử lý `PHOTO` khi bật.
- [x] Provider map đúng ID, URL 300/500, attribution/license và loại violence/duplicate.
- [x] Timeout, 429, 5xx, malformed JSON và `resolveAsset` có lỗi ổn định.
- [x] Import cache miss xác minh lại ID, không nhận URL client và gom request đồng thời.
- [x] DB/file unique, SHA-256 dedupe và cleanup giữ đúng một media cùng hai rendition.
- [x] Lưu set xác minh TEMPORARY/ACTIVE và promote trong cùng transaction.
- [x] Assignment/public detail giữ đúng `stored_media_id`, GAME và THUMBNAIL.
- [x] Thumbnail ARASAAC dùng contain, WebP decode được và giữ alpha.
- [x] Picker/bulk không hardcode Pixabay, ẩn PHOTO khi Pixabay tắt và abort request cũ.
- [x] Mobile 390×844 và desktop 1366×768 không overflow/vỡ dialog.
- [x] Unit, integration, targeted E2E, typecheck, lint và build PASS.
