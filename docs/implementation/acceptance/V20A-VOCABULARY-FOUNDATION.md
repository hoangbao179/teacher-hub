# V20A — Vocabulary foundation acceptance

- [ ] Shared contract có đủ bốn age band và không có DTO duplicate client/server.
- [ ] Assignment contract tương lai bắt buộc `ageBand`; class name không được dùng
  để derive grade/age band.
- [ ] Migration mới forward-only sau `0015`, có FK/index/unique/check cần thiết và
  integration test trên MySQL.
- [ ] Topic suggestion giữ priority, loại trùng normalized word + meaning và không
  tự publish.
- [ ] Vocabulary set giới hạn 100 item; text/ageBand/source/media-kind validation
  đúng feature document.
- [ ] Import Public Unit nhận full snapshot qua authenticated API, validate toàn bộ
  trước transaction và rollback toàn bộ khi một item lỗi.
- [ ] `sourceReference` chỉ là metadata; backend không đọc `client/src` hoặc build
  artifact của Web.
- [ ] PUBLIC_UNIT emoji/local asset map thành `EMOJI`/`PUBLIC_ASSET`; URL tùy ý
  không được download.
- [ ] API chỉ dùng `/api`, pagination mặc định 20 và tối đa 50.
- [ ] Shared build, typecheck, backend unit/integration và `npm run check:full` PASS.
