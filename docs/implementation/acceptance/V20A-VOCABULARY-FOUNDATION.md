# V20A — Vocabulary foundation acceptance

- [x] Shared contract có đủ bốn age band và không có DTO duplicate client/server.
- [x] Assignment contract tương lai bắt buộc `ageBand`; class name không được dùng
  để derive grade/age band.
- [x] Migration mới forward-only sau `0015`, có FK/index/unique/check cần thiết và
  integration test trên MySQL.
- [x] Topic suggestion giữ priority, loại trùng normalized word + meaning và không
  tự publish.
- [x] Vocabulary set giới hạn 100 item; text/ageBand/source/media-kind validation
  đúng feature document.
- [x] Import Public Unit nhận full snapshot qua authenticated API, validate toàn bộ
  trước transaction và rollback toàn bộ khi một item lỗi.
- [x] `sourceReference` chỉ là metadata; backend không đọc `client/src` hoặc build
  artifact của Web.
- [x] PUBLIC_UNIT emoji/local asset map thành `EMOJI`/`PUBLIC_ASSET`; URL tùy ý
  không được download.
- [x] API chỉ dùng `/api`, pagination mặc định 20 và tối đa 50.
- [x] Shared build, typecheck, backend unit/integration và `npm run check:full` PASS.
