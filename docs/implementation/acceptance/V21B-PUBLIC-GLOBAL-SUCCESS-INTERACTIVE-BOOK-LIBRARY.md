# Acceptance — V21B Tủ sách Global Success tương tác có audio

## Catalog và routing

- [ ] Catalog có đúng 13 record, slug/id duy nhất.
- [ ] Lớp 1,2,7,8,9 có 1 sách; lớp 3–6 có 2 sách.
- [ ] `/sach` public, không login.
- [ ] 13 route `/sach/global-success/:bookSlug` hoạt động.
- [ ] Invalid slug hiển thị BookNotFound thân thiện.
- [ ] Không có filter Bộ sách.

## UI

- [ ] Có filter Tất cả và lớp 1–9.
- [ ] Chọn lớp 3–6 hiển thị đúng hai tập.
- [ ] Mỗi card có badge `Có bài nghe`.
- [ ] Không có giá/rating/số lượng bán giả.
- [ ] Homepage có CTA và public navigation có Tủ sách.

## Viewer và audio

- [ ] `/sach` không tạo iframe.
- [ ] Preview tạo đúng một iframe.
- [ ] Iframe src khớp catalog và chỉ thuộc allowlist `online.flipbuilder.com/sdtta/`.
- [ ] Iframe có `title`, `loading="lazy"`, `referrerPolicy`, `allow="autoplay; fullscreen"`, `allowFullScreen`.
- [ ] Không dùng `dangerouslySetInnerHTML`.
- [ ] Không dùng PDF.js hoặc audio player riêng.
- [ ] Người kiểm thử có thể bấm hotspot loa trong viewer và nghe âm thanh trên Chrome desktop.
- [ ] Người kiểm thử có thể bấm hotspot loa trong viewer và nghe âm thanh trên Chrome Android hoặc thiết bị mobile tương đương.
- [ ] Có fullscreen và mở tab mới.
- [ ] Có trạng thái tải chậm, không spinner vô hạn.

## Security/deploy

- [ ] CSP public thêm chính xác `https://online.flipbuilder.com` vào `frame-src`.
- [ ] Không dùng wildcard `https:`.
- [ ] Không mở rộng CSP Admin/Play không cần thiết.
- [ ] Direct URL `/sach` và `/sach/...` không 404 trên Nginx.
- [ ] Không có secret mới trong client.
- [ ] Không lưu PDF/audio trên VPS.

## SEO/prerender

- [ ] `/sach` và 13 books có title/description/canonical riêng.
- [ ] 14 route sách được prerender.
- [ ] Sitemap chứa 14 route mới, không trùng.
- [ ] Test sitemap không hard-code tổng cũ 154.
- [ ] Mỗi route có đúng một H1.

## Responsive/a11y

- [ ] Không horizontal overflow ở 360/390/400/430.
- [ ] Header không tràn.
- [ ] Mobile group/card rõ Tập 1/Tập 2.
- [ ] Viewer đủ lớn; action bar không che nội dung.
- [ ] Touch target chính >=48 px.
- [ ] Focus ring, aria-label và iframe title đầy đủ.

## Regression

- [ ] Homepage, `/hoc`, `/play`, `/admin` vẫn hoạt động.
- [ ] Existing build/lint/unit/E2E pass.
- [ ] Agent reports được tạo và chỉ mô tả thay đổi V21B.
